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

    def run(self) -> list[dict]:
        capital = self.initial_capital
        position: Optional[dict] = None
        equity_curve = [capital]
        leverage = config.FUTURES_LEVERAGE if config.USE_FUTURES else 1

        df = self.df_1h
        n = len(df)
        warmup = max(config.EMA_MACRO, config.ATR_LOOKBACK_DAYS * 24)

        logger.info(
            f"Backtest {self.symbol} | {n} candles | capital={capital:.2f} | "
            f"{'futures ' + str(leverage) + 'x' if config.USE_FUTURES else 'spot'}"
        )

        for i in range(warmup, n):
            window = df.iloc[: i + 1]
            price = float(df.iloc[i]["close"])

            # ── Manage open position ──────────────────────────────────────────
            if position is not None:
                pos = position
                # Update extreme price
                if pos["side"] == "long":
                    if price > pos["extreme"]:
                        pos["extreme"] = price
                    if not pos["trailing_active"] and (price - pos["entry"]) / pos["entry"] >= config.TRAILING_ACTIVATION_PCT:
                        pos["trailing_active"] = True
                else:  # short
                    if price < pos["extreme"]:
                        pos["extreme"] = price
                    if not pos["trailing_active"] and (pos["entry"] - price) / pos["entry"] >= config.TRAILING_ACTIVATION_PCT:
                        pos["trailing_active"] = True

                should_exit, reason = evaluate_exit(
                    window, pos["entry"], pos["extreme"], pos["trailing_active"], pos["side"]
                )

                if should_exit:
                    if pos["side"] == "long":
                        pnl_usdt = (price - pos["entry"]) * pos["qty"]
                    else:
                        pnl_usdt = (pos["entry"] - price) * pos["qty"]

                    pnl_pct = pnl_usdt / (pos["entry"] * pos["qty"]) * 100
                    capital += pos["margin"] + pnl_usdt

                    self.trades.append({
                        "symbol": self.symbol,
                        "side": pos["side"],
                        "entry_price": pos["entry"],
                        "exit_price": price,
                        "quantity": pos["qty"],
                        "pnl_usdt": round(pnl_usdt, 4),
                        "pnl_pct": round(pnl_pct, 4),
                        "exit_reason": reason,
                        "entry_time": str(pos["entry_time"]),
                        "exit_time": str(df.index[i]),
                    })
                    position = None

            # ── Look for new entry ────────────────────────────────────────────
            if position is None:
                signal = evaluate_entry(window)
                signal.symbol = self.symbol

                if signal.action in ("buy", "sell"):
                    side = "long" if signal.action == "buy" else "short"

                    # SHORT requires futures
                    if side == "short" and not config.USE_FUTURES:
                        pass
                    else:
                        sl_price = (
                            price * (1 - config.STOP_LOSS_PCT) if side == "long"
                            else price * (1 + config.STOP_LOSS_PCT)
                        )
                        risk_amount = capital * config.MAX_RISK_PER_TRADE
                        ideal_value = risk_amount / config.STOP_LOSS_PCT
                        max_margin = capital * 0.95
                        max_value = max_margin * leverage
                        position_value = min(ideal_value, max_value)
                        margin_used = position_value / leverage
                        qty = round(position_value / price, 6)

                        if qty > 0 and margin_used <= capital:
                            capital -= margin_used
                            position = {
                                "side": side,
                                "entry": price,
                                "qty": qty,
                                "margin": margin_used,
                                "extreme": price,
                                "entry_time": df.index[i],
                                "trailing_active": False,
                            }

            # ── Equity snapshot ───────────────────────────────────────────────
            if position:
                if position["side"] == "long":
                    unrealised = (price - position["entry"]) * position["qty"]
                else:
                    unrealised = (position["entry"] - price) * position["qty"]
                equity_curve.append(capital + position["margin"] + unrealised)
            else:
                equity_curve.append(capital)

        # Close open position at last bar
        if position is not None:
            last_price = float(df.iloc[-1]["close"])
            if position["side"] == "long":
                pnl_usdt = (last_price - position["entry"]) * position["qty"]
            else:
                pnl_usdt = (position["entry"] - last_price) * position["qty"]
            pnl_pct = pnl_usdt / (position["entry"] * position["qty"]) * 100
            self.trades.append({
                "symbol": self.symbol,
                "side": position["side"],
                "entry_price": position["entry"],
                "exit_price": last_price,
                "quantity": position["qty"],
                "pnl_usdt": round(pnl_usdt, 4),
                "pnl_pct": round(pnl_pct, 4),
                "exit_reason": "end_of_data",
                "entry_time": str(position["entry_time"]),
                "exit_time": str(df.index[-1]),
            })
            capital += position["margin"] + pnl_usdt

        self._equity = equity_curve
        self._final_capital = capital
        longs = sum(1 for t in self.trades if t["side"] == "long")
        shorts = sum(1 for t in self.trades if t["side"] == "short")
        logger.info(
            f"Backtest done: {len(self.trades)} trades "
            f"(↑{longs} long / ↓{shorts} short) | capital={capital:.2f}"
        )
        return self.trades

    @property
    def equity_curve(self) -> list[float]:
        return getattr(self, "_equity", [self.initial_capital])

    @property
    def final_capital(self) -> float:
        return getattr(self, "_final_capital", self.initial_capital)
