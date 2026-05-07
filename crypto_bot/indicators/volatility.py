import pandas as pd
import pandas_ta as ta
from config import ATR_PERIOD, ATR_MULTIPLIER, ATR_LOOKBACK_DAYS, BB_PERIOD, BB_STD


def calculate_atr(df: pd.DataFrame, period: int = ATR_PERIOD) -> pd.Series:
    return ta.atr(df["high"], df["low"], df["close"], length=period)


def calculate_bollinger_bands(
    df: pd.DataFrame, period: int = BB_PERIOD, std: float = BB_STD
) -> pd.DataFrame:
    return ta.bbands(df["close"], length=period, std=std)


def add_volatility_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["atr"] = calculate_atr(df)

    # Rolling 30-day average ATR (hourly bars → 30d * 24h = 720 bars)
    lookback_bars = ATR_LOOKBACK_DAYS * 24
    df["atr_avg_30d"] = df["atr"].rolling(window=lookback_bars, min_periods=1).mean()

    # High-volatility filter: True means volatility is too high to trade
    df["high_volatility"] = df["atr"] > (ATR_MULTIPLIER * df["atr_avg_30d"])

    bb = calculate_bollinger_bands(df)
    df["bb_upper"] = bb[f"BBU_{BB_PERIOD}_{BB_STD}"]
    df["bb_lower"] = bb[f"BBL_{BB_PERIOD}_{BB_STD}"]
    df["bb_mid"] = bb[f"BBM_{BB_PERIOD}_{BB_STD}"]
    df["bb_width"] = (df["bb_upper"] - df["bb_lower"]) / df["bb_mid"]

    return df
