import pandas as pd
import numpy as np
from loguru import logger
from typing import Optional

from indicators.trend import add_trend_indicators
from indicators.momentum import add_momentum_indicators
from indicators.volatility import add_volatility_indicators
from core.strategy import evaluate_entry, evaluate_exit
import config


class BacktestEngine:
    """
    Vectorised-style backtester that walks candle-by-candle.
    Uses the same signal logic as the live bot.
    """

    def __init__(
        self,
        symbol: str,
        df_1h: pd.DataFrame,
        df_4h: pd.DataFrame,
        initial_capital: float = config.INITIAL_CAPITAL,
    ):
        self.symbol = symbol
        self.initial_capital = initial_capital
        self.df_1h = self._prepare(df_1h, df_4h)
        self.trades: list[dict] = []

    # ─── Data preparation ────────────────────────────────────────────────────

    def _prepare(self, df_1h: pd.DataFrame, df_4h: pd.DataFrame) -> pd.DataFrame:
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

        return df.dropna(subset=["rsi", f"ema_{config.EMA_FAST}"])

    # ─── Main loop ───────────────────────────────────────────────────────────

    def run(self) -> list[dict]:
        capital = self.initial_capital
        position: Optional[dict] = None
        equity_curve = [capital]

        df = self.df_1h
        n = len(df)
        warmup = max(config.EMA_MACRO, config.ATR_LOOKBACK_DAYS * 24)

        logger.info(
            f"Backtest starting for {self.symbol} | "
            f"{n} candles | capital={capital:.2f}"
        )

        for i in range(warmup, n):
            window = df.iloc[: i + 1]
            row = df.iloc[i]
            price = float(row["close"])

            # ── Manage open position ──────────────────────────────────────
            if position is not None:
                pos = position
                current_price = price

                # Update trailing
                if current_price > pos["highest_price"]:
                    pos["highest_price"] = current_price
                if not pos["trailing_active"]:
                    pnl_pct = (current_price - pos["entry"]) / pos["entry"]
                    if pnl_pct >= config.TRAILING_ACTIVATION_PCT:
                        pos["trailing_active"] = True

                should_exit, reason = evaluate_exit(
                    window,
                    pos["entry"],
                    pos["highest_price"],
                    pos["trailing_active"],
                )

                if should_exit:
                    pnl_usdt = (current_price - pos["entry"]) * pos["qty"]
                    pnl_pct = (current_price - pos["entry"]) / pos["entry"] * 100
                    # Return margin + PnL (futures) or full notional (spot)
                    margin = pos.get("margin", pos["entry"] * pos["qty"])
                    capital += margin + pnl_usdt

                    self.trades.append(
                        {
                            "symbol": self.symbol,
                            "entry_price": pos["entry"],
                            "exit_price": current_price,
                            "quantity": pos["qty"],
                            "pnl_usdt": round(pnl_usdt, 4),
                            "pnl_pct": round(pnl_pct, 4),
                            "exit_reason": reason,
                            "entry_time": str(pos["entry_time"]),
                            "exit_time": str(df.index[i]),
                        }
                    )
                    position = None

            # ── Look for new entry ────────────────────────────────────────
            if position is None:
                # volatility filter already inside evaluate_entry
                signal = evaluate_entry(window)
                signal.symbol = self.symbol

                if signal.action == "buy":
                    leverage = config.FUTURES_LEVERAGE if config.USE_FUTURES else 1
                    sl = price * (1 - config.STOP_LOSS_PCT)
                    risk_amount = capital * config.MAX_RISK_PER_TRADE
                    price_risk = config.STOP_LOSS_PCT

                    # Notional position value (amplified by leverage)
                    ideal_value = risk_amount / price_risk
                    max_margin = capital * 0.95
                    max_value = max_margin * leverage
                    position_value = min(ideal_value, max_value)

                    # Margin actually reserved from capital
                    margin_used = position_value / leverage
                    qty = round(position_value / price, 6)

                    if qty > 0 and margin_used <= capital:
                        capital -= margin_used   # only deduct margin, not notional
                        position = {
                            "entry": price,
                            "qty": qty,
                            "sl": sl,
                            "tp": price * (1 + config.TAKE_PROFIT_PCT),
                            "entry_time": df.index[i],
                            "highest_price": price,
                            "trailing_active": False,
                            "margin": margin_used,
                        }

            # Equity = cash + open position value
            # Futures: cash + margin + unrealised PnL  (not the full notional)
            # Spot   : cash + qty * current_price
            if position:
                unrealised = (price - position["entry"]) * position["qty"]
                margin = position.get("margin", position["entry"] * position["qty"])
                pos_equity = margin + unrealised
            else:
                pos_equity = 0.0
            equity_curve.append(capital + pos_equity)

        # Close any open position at last price
        if position is not None:
            last_price = float(df.iloc[-1]["close"])
            pnl_usdt = (last_price - position["entry"]) * position["qty"]
            pnl_pct = (last_price - position["entry"]) / position["entry"] * 100
            self.trades.append(
                {
                    "symbol": self.symbol,
                    "entry_price": position["entry"],
                    "exit_price": last_price,
                    "quantity": position["qty"],
                    "pnl_usdt": round(pnl_usdt, 4),
                    "pnl_pct": round(pnl_pct, 4),
                    "exit_reason": "end_of_data",
                    "entry_time": str(position["entry_time"]),
                    "exit_time": str(df.index[-1]),
                }
            )
            margin = position.get("margin", position["entry"] * position["qty"])
            capital += margin + pnl_usdt

        self._equity = equity_curve
        self._final_capital = capital
        logger.info(
            f"Backtest complete: {len(self.trades)} trades | "
            f"final capital={capital:.2f} USDT"
        )
        return self.trades

    @property
    def equity_curve(self) -> list[float]:
        return getattr(self, "_equity", [self.initial_capital])

    @property
    def final_capital(self) -> float:
        return getattr(self, "_final_capital", self.initial_capital)
