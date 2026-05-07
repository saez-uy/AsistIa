import pandas as pd
from loguru import logger
from dataclasses import dataclass
from typing import Optional

from indicators.trend import add_trend_indicators
from indicators.momentum import add_momentum_indicators
from indicators.volatility import add_volatility_indicators
import config


@dataclass
class Signal:
    action: str          # "buy" | "sell" | "hold"
    symbol: str
    price: float
    reasons: list[str]
    signal_count: int    # how many of the 4 conditions matched (for buy)
    timestamp: pd.Timestamp


def prepare_dataframe(df_1h: pd.DataFrame, df_4h: pd.DataFrame) -> pd.DataFrame:
    """Merge 1h and 4h frames, compute all indicators on the 1h frame."""
    df = df_1h.copy()
    df = add_trend_indicators(df)
    df = add_momentum_indicators(df)
    df = add_volatility_indicators(df)

    # Align 4h EMA_200 onto 1h index via forward-fill
    df_4h_ind = add_trend_indicators(df_4h)
    df_4h_ind = df_4h_ind[[f"ema_{config.EMA_MACRO}"]].rename(
        columns={f"ema_{config.EMA_MACRO}": "ema_macro_4h"}
    )
    df = df.join(df_4h_ind, how="left")
    df["ema_macro_4h"] = df["ema_macro_4h"].ffill()

    return df


def evaluate_entry(df: pd.DataFrame) -> Signal:
    """Evaluate the last closed candle for an entry signal.

    Gate: price must be above EMA(200) on 4h (macro bull trend) — always required.
    Then at least MIN_SIGNALS_REQUIRED of the 3 technical signals must also fire.
    This avoids entering longs during macro downtrends.
    """
    row = df.iloc[-1]
    symbol = "UNKNOWN"  # filled by caller
    price = float(row["close"])
    ts = df.index[-1]

    # ── Mandatory macro filter ────────────────────────────────────────────────
    ema_macro = row.get("ema_macro_4h")
    macro_bull = (
        ema_macro is not None
        and not pd.isna(ema_macro)
        and price > float(ema_macro)
    )
    if not macro_bull:
        return Signal("hold", symbol, price, ["Blocked: price below EMA(200) 4h"], 0, ts)

    # Volatility filter
    if bool(row.get("high_volatility", False)):
        logger.debug("Entry blocked: abnormally high volatility (ATR filter)")
        return Signal("hold", symbol, price, ["Blocked: high volatility"], 0, ts)

    # ── Technical signals (need MIN_SIGNALS_REQUIRED of these 3) ─────────────
    technical: list[tuple[bool, str]] = [
        (
            bool(row.get("rsi_cross_up_oversold", 0)),
            f"RSI({config.RSI_PERIOD}) crossed above {config.RSI_OVERSOLD}",
        ),
        (
            bool(row.get("ema_cross_up", 0)),
            f"EMA({config.EMA_FAST}) crossed above EMA({config.EMA_SLOW})",
        ),
        (
            bool(row.get("macd_hist_cross_up", 0)),
            "MACD histogram flipped positive",
        ),
    ]

    matched = [(ok, r) for ok, r in technical if ok]
    signal_count = len(matched)
    reasons = [r for _, r in matched] + [f"Price above EMA({config.EMA_MACRO}) on 4h"]

    if signal_count >= config.MIN_SIGNALS_REQUIRED:
        logger.info(
            f"BUY signal ({signal_count}/3 technical + macro): {', '.join(reasons)}"
        )
        return Signal("buy", symbol, price, reasons, signal_count, ts)

    return Signal("hold", symbol, price, reasons, signal_count, ts)


def evaluate_exit(
    df: pd.DataFrame,
    entry_price: float,
    current_highest: float,
    trailing_active: bool,
) -> tuple[bool, str]:
    """
    Return (should_exit, reason).
    Trailing stop, TP, SL, and signal-based exit.
    """
    row = df.iloc[-1]
    price = float(row["close"])
    pnl_pct = (price - entry_price) / entry_price

    # Stop loss
    if pnl_pct <= -config.STOP_LOSS_PCT:
        return True, "sl"

    # Take profit
    if pnl_pct >= config.TAKE_PROFIT_PCT:
        return True, "tp"

    # Trailing stop
    if trailing_active:
        drawdown_from_high = (price - current_highest) / current_highest
        if drawdown_from_high <= -config.TRAILING_STOP_PCT:
            return True, "trailing"

    # Signal-based exit: RSI overbought AND MACD declining
    rsi_overbought = float(row.get("rsi", 0)) > config.RSI_OVERBOUGHT
    macd_declining = bool(row.get("macd_hist_declining", 0))
    if rsi_overbought and macd_declining:
        return True, "signal"

    return False, "hold"
