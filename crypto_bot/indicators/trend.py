import pandas as pd
import pandas_ta as ta
from config import EMA_FAST, EMA_SLOW, EMA_MACRO, MACD_FAST, MACD_SLOW, MACD_SIGNAL


def calculate_ema(df: pd.DataFrame, period: int, column: str = "close") -> pd.Series:
    return ta.ema(df[column], length=period)


def calculate_macd(
    df: pd.DataFrame,
    fast: int = MACD_FAST,
    slow: int = MACD_SLOW,
    signal: int = MACD_SIGNAL,
) -> pd.DataFrame:
    macd = ta.macd(df["close"], fast=fast, slow=slow, signal=signal)
    return macd


def add_trend_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df[f"ema_{EMA_FAST}"] = calculate_ema(df, EMA_FAST)
    df[f"ema_{EMA_SLOW}"] = calculate_ema(df, EMA_SLOW)
    df[f"ema_{EMA_MACRO}"] = calculate_ema(df, EMA_MACRO)

    macd = calculate_macd(df)
    df["macd"] = macd[f"MACD_{MACD_FAST}_{MACD_SLOW}_{MACD_SIGNAL}"]
    df["macd_signal"] = macd[f"MACDs_{MACD_FAST}_{MACD_SLOW}_{MACD_SIGNAL}"]
    df["macd_hist"] = macd[f"MACDh_{MACD_FAST}_{MACD_SLOW}_{MACD_SIGNAL}"]

    # EMA crossover: 1 when fast crosses above slow
    df["ema_cross_up"] = (
        (df[f"ema_{EMA_FAST}"] > df[f"ema_{EMA_SLOW}"])
        & (df[f"ema_{EMA_FAST}"].shift(1) <= df[f"ema_{EMA_SLOW}"].shift(1))
    ).astype(int)

    # MACD histogram flip from negative to positive
    df["macd_hist_cross_up"] = (
        (df["macd_hist"] > 0) & (df["macd_hist"].shift(1) <= 0)
    ).astype(int)

    # MACD starting to decline (for exit signal)
    df["macd_hist_declining"] = (
        (df["macd_hist"] < df["macd_hist"].shift(1))
        & (df["macd_hist"].shift(1) < df["macd_hist"].shift(2))
    ).astype(int)

    return df
