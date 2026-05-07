import pandas as pd
from dataclasses import dataclass, field
from typing import Optional
from loguru import logger
import config


@dataclass
class Position:
    symbol: str
    entry_price: float
    quantity: float
    stop_loss: float
    take_profit: float
    opened_at: pd.Timestamp
    highest_price: float = 0.0
    trailing_active: bool = False
    mode: str = config.TRADING_MODE

    @property
    def value(self) -> float:
        return self.quantity * self.entry_price

    def update_trailing(self, current_price: float) -> None:
        if current_price > self.highest_price:
            self.highest_price = current_price
            if not self.trailing_active:
                pnl_pct = (current_price - self.entry_price) / self.entry_price
                if pnl_pct >= config.TRAILING_ACTIVATION_PCT:
                    self.trailing_active = True
                    logger.info(
                        f"Trailing stop ACTIVATED for {self.symbol} "
                        f"at {current_price:.4f} (+{pnl_pct*100:.2f}%)"
                    )

    def current_pnl(self, current_price: float) -> tuple[float, float]:
        pnl_usdt = (current_price - self.entry_price) * self.quantity
        pnl_pct = (current_price - self.entry_price) / self.entry_price * 100
        return round(pnl_usdt, 4), round(pnl_pct, 4)


class Portfolio:
    """Tracks all open positions and cash balance."""

    def __init__(self, initial_capital: float = config.INITIAL_CAPITAL):
        self.cash = initial_capital
        self.positions: dict[str, Position] = {}

    def open_position(self, position: Position) -> None:
        cost = position.entry_price * position.quantity
        if cost > self.cash:
            logger.warning(
                f"Insufficient cash to open {position.symbol}: "
                f"need {cost:.2f}, have {self.cash:.2f}"
            )
            return
        self.cash -= cost
        self.positions[position.symbol] = position
        logger.info(
            f"[{position.mode.upper()}] Opened {position.symbol} LONG @ "
            f"{position.entry_price:.4f} | qty={position.quantity} | "
            f"SL={position.stop_loss:.4f} | TP={position.take_profit:.4f}"
        )

    def close_position(
        self, symbol: str, exit_price: float, reason: str
    ) -> Optional[dict]:
        pos = self.positions.pop(symbol, None)
        if pos is None:
            logger.warning(f"Tried to close {symbol} but no open position found")
            return None

        proceeds = exit_price * pos.quantity
        self.cash += proceeds
        pnl_usdt, pnl_pct = pos.current_pnl(exit_price)

        trade_record = {
            "symbol": symbol,
            "entry_price": pos.entry_price,
            "exit_price": exit_price,
            "quantity": pos.quantity,
            "pnl_usdt": pnl_usdt,
            "pnl_pct": pnl_pct,
            "exit_reason": reason,
            "opened_at": pos.opened_at,
            "mode": pos.mode,
        }
        logger.info(
            f"[{pos.mode.upper()}] Closed {symbol} @ {exit_price:.4f} | "
            f"PnL: {pnl_usdt:+.2f} USDT ({pnl_pct:+.2f}%) | reason={reason}"
        )
        return trade_record

    def total_value(self, prices: dict[str, float]) -> float:
        pos_value = sum(
            pos.quantity * prices.get(sym, pos.entry_price)
            for sym, pos in self.positions.items()
        )
        return self.cash + pos_value

    def summary(self, prices: dict[str, float]) -> dict:
        return {
            "cash": round(self.cash, 2),
            "open_positions": len(self.positions),
            "total_value": round(self.total_value(prices), 2),
            "positions": [
                {
                    "symbol": sym,
                    "entry": pos.entry_price,
                    "qty": pos.quantity,
                    "trailing_active": pos.trailing_active,
                }
                for sym, pos in self.positions.items()
            ],
        }
