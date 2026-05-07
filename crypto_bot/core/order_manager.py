import pandas as pd
from loguru import logger
from typing import Optional

from core.exchange import ExchangeWrapper
from core.portfolio import Portfolio, Position
from core.risk_manager import RiskManager
from database.db_manager import DBManager
import config


class OrderManager:
    """Orchestrates opening and closing positions across exchange, portfolio, and DB."""

    def __init__(
        self,
        exchange: ExchangeWrapper,
        portfolio: Portfolio,
        risk_manager: RiskManager,
        db: DBManager,
        notifier=None,
    ):
        self.exchange = exchange
        self.portfolio = portfolio
        self.risk = risk_manager
        self.db = db
        self.notifier = notifier

    # ─── Open ────────────────────────────────────────────────────────────────

    def open_long(self, symbol: str, entry_price: float) -> bool:
        if symbol in self.portfolio.positions:
            logger.debug(f"Already have an open position in {symbol}, skipping")
            return False

        open_count = len(self.portfolio.positions)
        if not self.risk.can_open_trade(symbol, open_count):
            return False

        sl = self.risk.calculate_stop_loss(entry_price)
        tp = self.risk.calculate_take_profit(entry_price)
        qty = self.risk.calculate_position_size(entry_price, sl)

        if qty <= 0:
            logger.warning(f"Calculated zero quantity for {symbol}, skipping")
            return False

        if config.TRADING_MODE == "live":
            try:
                order = self.exchange.create_market_buy(symbol, qty)
                entry_price = float(order.get("average", entry_price))
                qty = float(order.get("filled", qty))
            except Exception as exc:
                logger.error(f"Failed to execute market buy for {symbol}: {exc}")
                return False

        position = Position(
            symbol=symbol,
            entry_price=entry_price,
            quantity=qty,
            stop_loss=sl,
            take_profit=tp,
            opened_at=pd.Timestamp.utcnow(),
            highest_price=entry_price,
        )
        self.portfolio.open_position(position)
        self.risk.register_open_trade(symbol)

        self.db.insert_trade_open(
            symbol=symbol,
            side="buy",
            entry_price=entry_price,
            quantity=qty,
            mode=config.TRADING_MODE,
        )

        if self.notifier:
            self.notifier.send_trade_open(symbol, entry_price, sl, tp, qty)

        return True

    # ─── Close ───────────────────────────────────────────────────────────────

    def close_long(self, symbol: str, exit_price: float, reason: str) -> Optional[dict]:
        pos = self.portfolio.positions.get(symbol)
        if pos is None:
            return None

        qty = pos.quantity

        if config.TRADING_MODE == "live":
            try:
                order = self.exchange.create_market_sell(symbol, qty)
                exit_price = float(order.get("average", exit_price))
            except Exception as exc:
                logger.error(f"Failed to execute market sell for {symbol}: {exc}")
                return None

        trade = self.portfolio.close_position(symbol, exit_price, reason)
        if trade is None:
            return None

        self.risk.register_closed_trade(symbol, trade["pnl_usdt"])

        self.db.update_trade_close(
            symbol=symbol,
            exit_price=exit_price,
            pnl_usdt=trade["pnl_usdt"],
            pnl_pct=trade["pnl_pct"],
            exit_reason=reason,
        )

        if self.notifier:
            self.notifier.send_trade_close(
                symbol,
                trade["entry_price"],
                exit_price,
                trade["pnl_usdt"],
                trade["pnl_pct"],
                reason,
                self.risk.summary(),
            )

        return trade

    # ─── Position management tick ─────────────────────────────────────────────

    def manage_open_positions(
        self, current_prices: dict[str, float], df_map: dict
    ) -> None:
        """Call every loop tick to update trailing stops and check exits."""
        from core.strategy import evaluate_exit

        for symbol, pos in list(self.portfolio.positions.items()):
            price = current_prices.get(symbol)
            if price is None:
                continue

            pos.update_trailing(price)

            df = df_map.get(symbol)
            if df is None:
                continue

            should_exit, reason = evaluate_exit(
                df, pos.entry_price, pos.highest_price, pos.trailing_active
            )
            if should_exit:
                self.close_long(symbol, price, reason)
