import pandas as pd
from config import ATR_PERIOD, ATR_MULTIPLIER, ATR_LOOKBACK_DAYS, BB_PERIOD, BB_STD


def calculate_atr(
    high: pd.Series, low: pd.Series, close: pd.Series, period: int = ATR_PERIOD
) -> pd.Series:
    prev_close = close.shift(1)
    tr = pd.concat(
        [
            high - low,
            (high - prev_close).abs(),
            (low - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    # Wilder's smoothing
    return tr.ewm(alpha=1 / period, adjust=False).mean()


def calculate_bollinger_bands(
    series: pd.Series, period: int = BB_PERIOD, std: float = BB_STD
) -> pd.DataFrame:
    mid = series.rolling(period).mean()
    sigma = series.rolling(period).std()
    return pd.DataFrame(
        {"bb_upper": mid + std * sigma, "bb_mid": mid, "bb_lower": mid - std * sigma}
    )


def add_volatility_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["atr"] = calculate_atr(df["high"], df["low"], df["close"])

    lookback_bars = ATR_LOOKBACK_DAYS * 24
    df["atr_avg_30d"] = df["atr"].rolling(window=lookback_bars, min_periods=1).mean()
    df["high_volatility"] = df["atr"] > (ATR_MULTIPLIER * df["atr_avg_30d"])

    bb = calculate_bollinger_bands(df["close"])
    df["bb_upper"] = bb["bb_upper"]
    df["bb_mid"] = bb["bb_mid"]
    df["bb_lower"] = bb["bb_lower"]
    df["bb_width"] = (df["bb_upper"] - df["bb_lower"]) / df["bb_mid"]

    return df
