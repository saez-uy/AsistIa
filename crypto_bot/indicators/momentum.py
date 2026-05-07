import pandas as pd
import pandas_ta as ta
from config import RSI_PERIOD, RSI_OVERSOLD, STOCH_K, STOCH_D, STOCH_SMOOTH


def calculate_rsi(df: pd.DataFrame, period: int = RSI_PERIOD) -> pd.Series:
    return ta.rsi(df["close"], length=period)


def calculate_stochastic(
    df: pd.DataFrame,
    k: int = STOCH_K,
    d: int = STOCH_D,
    smooth_k: int = STOCH_SMOOTH,
) -> pd.DataFrame:
    return ta.stoch(df["high"], df["low"], df["close"], k=k, d=d, smooth_k=smooth_k)


def add_momentum_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["rsi"] = calculate_rsi(df)

    stoch = calculate_stochastic(df)
    df["stoch_k"] = stoch[f"STOCHk_{STOCH_K}_{STOCH_D}_{STOCH_SMOOTH}"]
    df["stoch_d"] = stoch[f"STOCHd_{STOCH_K}_{STOCH_D}_{STOCH_SMOOTH}"]

    # RSI crosses above oversold level
    df["rsi_cross_up_oversold"] = (
        (df["rsi"] > RSI_OVERSOLD) & (df["rsi"].shift(1) <= RSI_OVERSOLD)
    ).astype(int)

    return df
