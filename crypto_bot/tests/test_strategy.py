import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
import pandas as pd
import numpy as np

from indicators.trend import add_trend_indicators
from indicators.momentum import add_momentum_indicators
from indicators.volatility import add_volatility_indicators
from core.risk_manager import RiskManager
from core.strategy import evaluate_exit
import config


# ─── Fixtures ────────────────────────────────────────────────────────────────

def make_ohlcv(n: int = 500, base_price: float = 40000.0, trend: float = 0.0) -> pd.DataFrame:
    """Generate synthetic OHLCV with a configurable upward/downward trend."""
    rng = np.random.default_rng(42)
    closes = base_price + np.cumsum(
        rng.normal(loc=trend, scale=base_price * 0.005, size=n)
    )
    highs = closes + rng.uniform(0, base_price * 0.003, size=n)
    lows = closes - rng.uniform(0, base_price * 0.003, size=n)
    opens = closes + rng.normal(0, base_price * 0.002, size=n)
    volumes = rng.uniform(100, 1000, size=n)

    idx = pd.date_range("2024-01-01", periods=n, freq="1h", tz="UTC")
    return pd.DataFrame(
        {"open": opens, "high": highs, "low": lows, "close": closes, "volume": volumes},
        index=idx,
    )


# ─── Indicator tests ──────────────────────────────────────────────────────────

class TestTrendIndicators:
    def test_ema_columns_exist(self):
        df = make_ohlcv(300)
        df = add_trend_indicators(df)
        assert f"ema_{config.EMA_FAST}" in df.columns
        assert f"ema_{config.EMA_SLOW}" in df.columns
        assert f"ema_{config.EMA_MACRO}" in df.columns

    def test_macd_columns_exist(self):
        df = make_ohlcv(300)
        df = add_trend_indicators(df)
        assert "macd" in df.columns
        assert "macd_hist" in df.columns
        assert "macd_hist_cross_up" in df.columns

    def test_ema_cross_up_is_binary(self):
        df = make_ohlcv(300)
        df = add_trend_indicators(df)
        vals = df["ema_cross_up"].dropna().unique()
        assert set(vals).issubset({0, 1})


class TestMomentumIndicators:
    def test_rsi_bounds(self):
        df = make_ohlcv(200)
        df = add_momentum_indicators(df)
        rsi = df["rsi"].dropna()
        assert (rsi >= 0).all() and (rsi <= 100).all()

    def test_rsi_cross_oversold(self):
        df = make_ohlcv(200)
        df = add_momentum_indicators(df)
        vals = df["rsi_cross_up_oversold"].dropna().unique()
        assert set(vals).issubset({0, 1})


class TestVolatilityIndicators:
    def test_atr_positive(self):
        df = make_ohlcv(200)
        df = add_volatility_indicators(df)
        assert (df["atr"].dropna() >= 0).all()

    def test_high_volatility_boolean(self):
        df = make_ohlcv(200)
        df = add_volatility_indicators(df)
        assert df["high_volatility"].dtype == bool


# ─── Risk Manager tests ───────────────────────────────────────────────────────

class TestRiskManager:
    def test_position_size_calculation(self):
        rm = RiskManager(initial_capital=500.0)
        entry = 40000.0
        sl = entry * (1 - config.STOP_LOSS_PCT)
        qty = rm.calculate_position_size(entry, sl)
        risk_spent = (entry - sl) * qty
        assert pytest.approx(risk_spent, rel=1e-3) == 500.0 * config.MAX_RISK_PER_TRADE

    def test_max_open_trades_limit(self):
        rm = RiskManager(initial_capital=500.0)
        assert rm.can_open_trade("BTC/USDT", config.MAX_OPEN_TRADES) is False

    def test_circuit_breaker(self):
        rm = RiskManager(initial_capital=500.0)
        rm.capital = 500.0 * (1 - config.MAX_DAILY_LOSS - 0.001)
        assert rm._daily_loss_exceeded() is True

    def test_stop_loss_price(self):
        rm = RiskManager()
        sl = rm.calculate_stop_loss(40000.0)
        assert abs(sl - 40000.0 * (1 - config.STOP_LOSS_PCT)) < 0.01

    def test_take_profit_price(self):
        rm = RiskManager()
        tp = rm.calculate_take_profit(40000.0)
        assert abs(tp - 40000.0 * (1 + config.TAKE_PROFIT_PCT)) < 0.01

    def test_trailing_activation(self):
        rm = RiskManager()
        entry = 40000.0
        not_yet = entry * (1 + config.TRAILING_ACTIVATION_PCT - 0.001)
        activated = entry * (1 + config.TRAILING_ACTIVATION_PCT + 0.001)
        assert rm.should_activate_trailing(entry, not_yet) is False
        assert rm.should_activate_trailing(entry, activated) is True

    def test_capital_updates_on_close(self):
        rm = RiskManager(initial_capital=500.0)
        rm.register_open_trade("BTC/USDT")
        rm.register_closed_trade("BTC/USDT", pnl_usdt=10.0)
        assert rm.capital == pytest.approx(510.0)


# ─── Strategy exit tests ──────────────────────────────────────────────────────

class TestStrategyExit:
    def _make_df_with_price(self, price: float) -> pd.DataFrame:
        df = make_ohlcv(300, base_price=price)
        df = add_trend_indicators(df)
        df = add_momentum_indicators(df)
        df = add_volatility_indicators(df)
        # Force last candle to exactly `price`
        df.iloc[-1, df.columns.get_loc("close")] = price
        return df

    def test_stop_loss_triggered(self):
        entry = 40000.0
        sl_price = entry * (1 - config.STOP_LOSS_PCT - 0.001)
        df = self._make_df_with_price(sl_price)
        exit_, reason = evaluate_exit(df, entry, entry, False)
        assert exit_ is True and reason == "sl"

    def test_take_profit_triggered(self):
        entry = 40000.0
        tp_price = entry * (1 + config.TAKE_PROFIT_PCT + 0.001)
        df = self._make_df_with_price(tp_price)
        exit_, reason = evaluate_exit(df, entry, entry, False)
        assert exit_ is True and reason == "tp"

    def test_trailing_stop_triggered(self):
        entry = 40000.0
        highest = entry * 1.025    # above trailing activation
        current = highest * (1 - config.TRAILING_STOP_PCT - 0.001)
        df = self._make_df_with_price(current)
        exit_, reason = evaluate_exit(df, entry, highest, trailing_active=True)
        assert exit_ is True and reason == "trailing"

    def test_no_exit_in_range(self):
        entry = 40000.0
        normal_price = entry * 1.005
        df = self._make_df_with_price(normal_price)
        exit_, _ = evaluate_exit(df, entry, entry, False)
        assert exit_ is False
