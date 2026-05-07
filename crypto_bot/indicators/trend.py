import pandas as pd
from config import EMA_FAST, EMA_SLOW, EMA_MACRO, MACD_FAST, MACD_SLOW, MACD_SIGNAL


def calculate_ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def calculate_macd(
    series: pd.Series,
    fast: int = MACD_FAST,
    slow: int = MACD_SLOW,
    signal: int = MACD_SIGNAL,
) -> pd.DataFrame:
    ema_fast = calculate_ema(series, fast)
    ema_slow = calculate_ema(series, slow)
    macd_line = ema_fast - ema_slow
    signal_line = calculate_ema(macd_line, signal)
    histogram = macd_line - signal_line
    return pd.DataFrame({"macd": macd_line, "macd_signal": signal_line, "macd_hist": histogram})


def add_trend_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df[f"ema_{EMA_FAST}"] = calculate_ema(df["close"], EMA_FAST)
    df[f"ema_{EMA_SLOW}"] = calculate_ema(df["close"], EMA_SLOW)
    df[f"ema_{EMA_MACRO}"] = calculate_ema(df["close"], EMA_MACRO)

    macd = calculate_macd(df["close"])
    df["macd"] = macd["macd"]
    df["macd_signal"] = macd["macd_signal"]
    df["macd_hist"] = macd["macd_hist"]

    df["ema_cross_up"] = (
        (df[f"ema_{EMA_FAST}"] > df[f"ema_{EMA_SLOW}"])
        & (df[f"ema_{EMA_FAST}"].shift(1) <= df[f"ema_{EMA_SLOW}"].shift(1))
    ).astype(int)

    df["macd_hist_cross_up"] = (
        (df["macd_hist"] > 0) & (df["macd_hist"].shift(1) <= 0)
    ).astype(int)

    df["macd_hist_declining"] = (
        (df["macd_hist"] < df["macd_hist"].shift(1))
        & (df["macd_hist"].shift(1) < df["macd_hist"].shift(2))
    ).astype(int)

    return df
