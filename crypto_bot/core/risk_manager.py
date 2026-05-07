from loguru import logger
import config


class RiskManager:
    """Enforces position sizing, daily loss limits, and portfolio-level risk."""

    def __init__(self, initial_capital: float = config.INITIAL_CAPITAL):
        self.initial_capital = initial_capital
        self.capital = initial_capital
        self.daily_start_capital = initial_capital
        self._open_risk: dict[str, float] = {}  # symbol -> risk fraction committed

    # ─── Position sizing ─────────────────────────────────────────────────────

    # Maximum fraction of cash to spend on a single position (leaves buffer for fees)
    MAX_POSITION_CAPITAL_FRACTION = 0.95

    def calculate_position_size(
        self, entry_price: float, stop_loss_price: float
    ) -> float:
        """Return quantity to buy using fixed-fractional sizing.

        Targets 2% capital at risk, but caps position value at 95% of cash
        so small accounts (<$700) can still trade without exceeding balance.
        """
        risk_amount = self.capital * config.MAX_RISK_PER_TRADE
        price_risk = abs(entry_price - stop_loss_price) / entry_price
        if price_risk == 0:
            logger.warning("price_risk is zero, skipping position")
            return 0.0

        # Ideal position value from risk formula
        ideal_position_value = risk_amount / price_risk

        # Cap to available cash so we never exceed balance
        max_position_value = self.capital * self.MAX_POSITION_CAPITAL_FRACTION
        position_value = min(ideal_position_value, max_position_value)

        if position_value < ideal_position_value:
            actual_risk_pct = (position_value * price_risk) / self.capital * 100
            logger.debug(
                f"Position capped to {max_position_value:.2f} USDT "
                f"(actual risk: {actual_risk_pct:.2f}% vs target {config.MAX_RISK_PER_TRADE*100:.1f}%)"
            )

        quantity = position_value / entry_price
        return round(quantity, 6)

    def calculate_stop_loss(self, entry_price: float) -> float:
        return round(entry_price * (1 - config.STOP_LOSS_PCT), 8)

    def calculate_take_profit(self, entry_price: float) -> float:
        return round(entry_price * (1 + config.TAKE_PROFIT_PCT), 8)

    # ─── Pre-trade checks ────────────────────────────────────────────────────

    def can_open_trade(self, symbol: str, open_trades_count: int) -> bool:
        if open_trades_count >= config.MAX_OPEN_TRADES:
            logger.info(
                f"Trade blocked for {symbol}: max open trades "
                f"({config.MAX_OPEN_TRADES}) reached"
            )
            return False

        if self._total_open_risk() + config.MAX_RISK_PER_TRADE > config.MAX_PORTFOLIO_RISK:
            logger.info(
                f"Trade blocked for {symbol}: portfolio risk limit "
                f"({config.MAX_PORTFOLIO_RISK*100:.1f}%) would be exceeded"
            )
            return False

        if self._daily_loss_exceeded():
            logger.warning(
                "CIRCUIT BREAKER: daily loss limit reached, no new trades today"
            )
            return False

        return True

    def _total_open_risk(self) -> float:
        return sum(self._open_risk.values())

    def _daily_loss_exceeded(self) -> bool:
        loss_pct = (self.daily_start_capital - self.capital) / self.daily_start_capital
        return loss_pct >= config.MAX_DAILY_LOSS

    # ─── State updates ───────────────────────────────────────────────────────

    def register_open_trade(self, symbol: str) -> None:
        self._open_risk[symbol] = config.MAX_RISK_PER_TRADE
        logger.debug(
            f"Registered open risk for {symbol}. "
            f"Total risk: {self._total_open_risk()*100:.2f}%"
        )

    def register_closed_trade(self, symbol: str, pnl_usdt: float) -> None:
        self._open_risk.pop(symbol, None)
        self.capital += pnl_usdt
        logger.debug(
            f"Closed trade for {symbol}. PnL: {pnl_usdt:+.2f} USDT. "
            f"Capital: {self.capital:.2f} USDT"
        )

    def reset_daily_stats(self) -> None:
        self.daily_start_capital = self.capital
        logger.info(f"Daily stats reset. Capital: {self.capital:.2f} USDT")

    # ─── Trailing stop tracking ───────────────────────────────────────────────

    def should_activate_trailing(self, entry_price: float, current_price: float) -> bool:
        pnl_pct = (current_price - entry_price) / entry_price
        return pnl_pct >= config.TRAILING_ACTIVATION_PCT

    # ─── Reporting ───────────────────────────────────────────────────────────

    def summary(self) -> dict:
        return {
            "capital": round(self.capital, 2),
            "initial_capital": self.initial_capital,
            "total_return_pct": round(
                (self.capital - self.initial_capital) / self.initial_capital * 100, 2
            ),
            "open_risk_pct": round(self._total_open_risk() * 100, 2),
            "daily_loss_pct": round(
                (self.daily_start_capital - self.capital)
                / self.daily_start_capital
                * 100,
                2,
            ),
        }
