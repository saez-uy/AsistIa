import pandas as pd
from config import RSI_PERIOD, RSI_OVERSOLD, STOCH_K, STOCH_D, STOCH_SMOOTH


def calculate_rsi(series: pd.Series, period: int = RSI_PERIOD) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    # Wilder's smoothing (equivalent to EMA with alpha=1/period)
    avg_gain = gain.ewm(alpha=1 / period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, float("nan"))
    return 100 - (100 / (1 + rs))


def calculate_stochastic(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    k: int = STOCH_K,
    d: int = STOCH_D,
    smooth_k: int = STOCH_SMOOTH,
) -> pd.DataFrame:
    lowest_low = low.rolling(k).min()
    highest_high = high.rolling(k).max()
    raw_k = 100 * (close - lowest_low) / (highest_high - lowest_low).replace(0, float("nan"))
    stoch_k = raw_k.rolling(smooth_k).mean()
    stoch_d = stoch_k.rolling(d).mean()
    return pd.DataFrame({"stoch_k": stoch_k, "stoch_d": stoch_d})


def add_momentum_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["rsi"] = calculate_rsi(df["close"])

    stoch = calculate_stochastic(df["high"], df["low"], df["close"])
    df["stoch_k"] = stoch["stoch_k"]
    df["stoch_d"] = stoch["stoch_d"]

    df["rsi_cross_up_oversold"] = (
        (df["rsi"] > RSI_OVERSOLD) & (df["rsi"].shift(1) <= RSI_OVERSOLD)
    ).astype(int)

    return df
