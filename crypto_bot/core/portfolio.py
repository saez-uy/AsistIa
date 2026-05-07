import pandas as pd
from dataclasses import dataclass
from typing import Optional
from loguru import logger
import config


@dataclass
class Position:
    symbol: str
    side: str            # "long" | "short"
    entry_price: float
    quantity: float
    stop_loss: float
    take_profit: float
    opened_at: pd.Timestamp
    extreme_price: float = 0.0   # highest for long, lowest for short
    trailing_active: bool = False
    mode: str = config.TRADING_MODE

    @property
    def value(self) -> float:
        return self.quantity * self.entry_price

    def update_trailing(self, current_price: float) -> None:
        if self.side == "long":
            if current_price > self.extreme_price:
                self.extreme_price = current_price
                if not self.trailing_active:
                    pnl_pct = (current_price - self.entry_price) / self.entry_price
                    if pnl_pct >= config.TRAILING_ACTIVATION_PCT:
                        self.trailing_active = True
                        logger.info(
                            f"Trailing ACTIVATED (long) {self.symbol} "
                            f"@ {current_price:.4f} (+{pnl_pct*100:.2f}%)"
                        )
        else:  # short
            if current_price < self.extreme_price or self.extreme_price == 0:
                self.extreme_price = current_price
                if not self.trailing_active:
                    pnl_pct = (self.entry_price - current_price) / self.entry_price
                    if pnl_pct >= config.TRAILING_ACTIVATION_PCT:
                        self.trailing_active = True
                        logger.info(
                            f"Trailing ACTIVATED (short) {self.symbol} "
                            f"@ {current_price:.4f} (+{pnl_pct*100:.2f}%)"
                        )

    def current_pnl(self, current_price: float) -> tuple[float, float]:
        if self.side == "long":
            pnl_usdt = (current_price - self.entry_price) * self.quantity
            pnl_pct = (current_price - self.entry_price) / self.entry_price * 100
        else:
            pnl_usdt = (self.entry_price - current_price) * self.quantity
            pnl_pct = (self.entry_price - current_price) / self.entry_price * 100
        return round(pnl_usdt, 4), round(pnl_pct, 4)


class Portfolio:
    def __init__(self, initial_capital: float = config.INITIAL_CAPITAL):
        self.cash = initial_capital
        self.positions: dict[str, Position] = {}

    def open_position(self, position: Position) -> None:
        cost = position.entry_price * position.quantity
        leverage = config.FUTURES_LEVERAGE if config.USE_FUTURES else 1
        margin = cost / leverage
        if margin > self.cash:
            logger.warning(
                f"Insufficient cash to open {position.symbol} {position.side.upper()}: "
                f"need {margin:.2f}, have {self.cash:.2f}"
            )
            return
        self.cash -= margin
        self.positions[position.symbol] = position
        direction = "▲ LONG" if position.side == "long" else "▼ SHORT"
        logger.info(
            f"[{position.mode.upper()}] Opened {direction} {position.symbol} "
            f"@ {position.entry_price:.4f} | qty={position.quantity} | "
            f"SL={position.stop_loss:.4f} | TP={position.take_profit:.4f}"
        )

    def close_position(self, symbol: str, exit_price: float, reason: str) -> Optional[dict]:
        pos = self.positions.pop(symbol, None)
        if pos is None:
            logger.warning(f"Tried to close {symbol} but no open position found")
            return None

        leverage = config.FUTURES_LEVERAGE if config.USE_FUTURES else 1
        margin = pos.entry_price * pos.quantity / leverage
        pnl_usdt, pnl_pct = pos.current_pnl(exit_price)
        self.cash += margin + pnl_usdt   # return margin + PnL

        direction = "▲ LONG" if pos.side == "long" else "▼ SHORT"
        logger.info(
            f"[{pos.mode.upper()}] Closed {direction} {symbol} @ {exit_price:.4f} | "
            f"PnL: {pnl_usdt:+.2f} USDT ({pnl_pct:+.2f}%) | reason={reason}"
        )
        return {
            "symbol": symbol,
            "side": pos.side,
            "entry_price": pos.entry_price,
            "exit_price": exit_price,
            "quantity": pos.quantity,
            "pnl_usdt": pnl_usdt,
            "pnl_pct": pnl_pct,
            "exit_reason": reason,
            "opened_at": pos.opened_at,
            "mode": pos.mode,
        }

    def total_value(self, prices: dict[str, float]) -> float:
        leverage = config.FUTURES_LEVERAGE if config.USE_FUTURES else 1
        pos_value = 0.0
        for sym, pos in self.positions.items():
            price = prices.get(sym, pos.entry_price)
            margin = pos.entry_price * pos.quantity / leverage
            pnl, _ = pos.current_pnl(price)
            pos_value += margin + pnl
        return self.cash + pos_value

    def summary(self, prices: dict[str, float]) -> dict:
        return {
            "cash": round(self.cash, 2),
            "open_positions": len(self.positions),
            "total_value": round(self.total_value(prices), 2),
            "positions": [
                {
                    "symbol": sym,
                    "side": pos.side,
                    "entry": pos.entry_price,
                    "qty": pos.quantity,
                    "trailing_active": pos.trailing_active,
                }
                for sym, pos in self.positions.items()
            ],
        }
