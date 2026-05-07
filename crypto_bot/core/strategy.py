import pandas as pd
from loguru import logger
from dataclasses import dataclass, field
from typing import Optional

from indicators.trend import add_trend_indicators
from indicators.momentum import add_momentum_indicators
from indicators.volatility import add_volatility_indicators
import config


@dataclass
class Signal:
    action: str          # "buy" | "sell" | "hold"  (sell = open short)
    symbol: str
    price: float
    reasons: list[str]
    signal_count: int
    timestamp: pd.Timestamp


def prepare_dataframe(df_1h: pd.DataFrame, df_4h: pd.DataFrame) -> pd.DataFrame:
    df = df_1h.copy()
    df = add_trend_indicators(df)
    df = add_momentum_indicators(df)
    df = add_volatility_indicators(df)

    df_4h_ind = add_trend_indicators(df_4h)
    df_4h_ema = df_4h_ind[[f"ema_{config.EMA_MACRO}"]].rename(
        columns={f"ema_{config.EMA_MACRO}": "ema_macro_4h"}
    )
    df = df.join(df_4h_ema, how="left")
    df["ema_macro_4h"] = df["ema_macro_4h"].ffill()
    return df


def _volatility_blocked(row) -> bool:
    return bool(row.get("high_volatility", False))


def _macro_state(row, price: float) -> str:
    """Returns 'bull', 'bear', or 'neutral'."""
    ema = row.get("ema_macro_4h")
    if ema is None or pd.isna(ema):
        return "neutral"
    return "bull" if price > float(ema) else "bear"


def evaluate_entry(df: pd.DataFrame) -> Signal:
    """Evaluate last candle for LONG or SHORT entry.

    Gate: price vs EMA(200) on 4h determines direction.
    Then MIN_SIGNALS_REQUIRED of 3 technical signals must confirm.
    """
    row = df.iloc[-1]
    symbol = "UNKNOWN"
    price = float(row["close"])
    ts = df.index[-1]

    if _volatility_blocked(row):
        logger.debug("Entry blocked: high volatility")
        return Signal("hold", symbol, price, ["Blocked: high volatility"], 0, ts)

    macro = _macro_state(row, price)

    if macro == "bull":
        technicals = [
            (bool(row.get("rsi_cross_up_oversold", 0)),
             f"RSI({config.RSI_PERIOD}) crossed above {config.RSI_OVERSOLD}"),
            (bool(row.get("ema_cross_up", 0)),
             f"EMA({config.EMA_FAST}) crossed above EMA({config.EMA_SLOW})"),
            (bool(row.get("macd_hist_cross_up", 0)),
             "MACD histogram flipped positive"),
        ]
        matched = [(ok, r) for ok, r in technicals if ok]
        if len(matched) >= config.MIN_SIGNALS_REQUIRED:
            reasons = [r for _, r in matched] + [f"Price above EMA({config.EMA_MACRO}) 4h ↑"]
            logger.info(f"LONG signal ({len(matched)}/3 + macro): {', '.join(reasons)}")
            return Signal("buy", symbol, price, reasons, len(matched), ts)

    elif macro == "bear":
        technicals = [
            (bool(row.get("rsi_cross_down_overbought", 0)),
             f"RSI({config.RSI_PERIOD}) crossed below {config.RSI_OVERBOUGHT_EXIT}"),
            (bool(row.get("ema_cross_down", 0)),
             f"EMA({config.EMA_FAST}) crossed below EMA({config.EMA_SLOW})"),
            (bool(row.get("macd_hist_cross_down", 0)),
             "MACD histogram flipped negative"),
        ]
        matched = [(ok, r) for ok, r in technicals if ok]
        if len(matched) >= config.MIN_SIGNALS_REQUIRED:
            reasons = [r for _, r in matched] + [f"Price below EMA({config.EMA_MACRO}) 4h ↓"]
            logger.info(f"SHORT signal ({len(matched)}/3 + macro): {', '.join(reasons)}")
            return Signal("sell", symbol, price, reasons, len(matched), ts)

    return Signal("hold", symbol, price, [], 0, ts)


def evaluate_exit(
    df: pd.DataFrame,
    entry_price: float,
    extreme_price: float,   # highest seen for LONG, lowest seen for SHORT
    trailing_active: bool,
    side: str = "long",
) -> tuple[bool, str]:
    """Return (should_exit, reason) for both long and short positions."""
    row = df.iloc[-1]
    price = float(row["close"])

    if side == "long":
        pnl_pct = (price - entry_price) / entry_price

        if pnl_pct <= -config.STOP_LOSS_PCT:
            return True, "sl"
        if pnl_pct >= config.TAKE_PROFIT_PCT:
            return True, "tp"
        if trailing_active:
            drawdown = (price - extreme_price) / extreme_price
            if drawdown <= -config.TRAILING_STOP_PCT:
                return True, "trailing"
        # Signal exit: RSI overbought AND MACD declining
        if float(row.get("rsi", 0)) > config.RSI_OVERBOUGHT and bool(row.get("macd_hist_declining", 0)):
            return True, "signal"

    elif side == "short":
        pnl_pct = (entry_price - price) / entry_price  # inverted for shorts

        if pnl_pct <= -config.STOP_LOSS_PCT:           # price rose too much
            return True, "sl"
        if pnl_pct >= config.TAKE_PROFIT_PCT:           # price fell enough
            return True, "tp"
        if trailing_active:
            rally = (price - extreme_price) / extreme_price  # extreme = lowest seen
            if rally >= config.TRAILING_STOP_PCT:
                return True, "trailing"
        # Signal exit: RSI oversold AND MACD rising
        if float(row.get("rsi", 50)) < config.RSI_OVERSOLD and bool(row.get("macd_hist_rising", 0)):
            return True, "signal"

    return False, "hold"
