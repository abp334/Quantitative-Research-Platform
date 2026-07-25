"""Manual technical indicators implemented with NumPy/Pandas (no TA-Lib)."""

from __future__ import annotations

import numpy as np
import pandas as pd


def sma(series: pd.Series, window: int) -> pd.Series:
    return series.rolling(window=window, min_periods=window).mean()


def ema(series: pd.Series, window: int) -> pd.Series:
    return series.ewm(span=window, adjust=False, min_periods=window).mean()


def rsi(series: pd.Series, window: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)
    avg_gain = gain.ewm(alpha=1 / window, min_periods=window, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / window, min_periods=window, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def macd(
    series: pd.Series,
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    macd_line = ema(series, fast) - ema(series, slow)
    signal_line = ema(macd_line, signal)
    hist = macd_line - signal_line
    return macd_line, signal_line, hist


def atr(high: pd.Series, low: pd.Series, close: pd.Series, window: int = 14) -> pd.Series:
    prev_close = close.shift(1)
    tr = pd.concat(
        [
            (high - low),
            (high - prev_close).abs(),
            (low - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    return tr.rolling(window=window, min_periods=window).mean()


def bollinger_bands(
    series: pd.Series, window: int = 20, num_std: float = 2.0
) -> tuple[pd.Series, pd.Series, pd.Series]:
    mid = sma(series, window)
    std = series.rolling(window=window, min_periods=window).std()
    upper = mid + num_std * std
    lower = mid - num_std * std
    return upper, mid, lower


def momentum(series: pd.Series, window: int = 10) -> pd.Series:
    return series.diff(window)


def roc(series: pd.Series, window: int = 10) -> pd.Series:
    prev = series.shift(window)
    return ((series - prev) / prev.replace(0, np.nan)) * 100.0


def rolling_mean(series: pd.Series, window: int) -> pd.Series:
    return series.rolling(window=window, min_periods=window).mean()


def rolling_std(series: pd.Series, window: int) -> pd.Series:
    return series.rolling(window=window, min_periods=window).std()


def rolling_volatility(returns: pd.Series, window: int = 20) -> pd.Series:
    return returns.rolling(window=window, min_periods=window).std() * np.sqrt(252)


def daily_return(series: pd.Series) -> pd.Series:
    return series.pct_change()


def log_return(series: pd.Series) -> pd.Series:
    return np.log(series / series.shift(1))


def build_feature_frame(df: pd.DataFrame, horizon: int = 1) -> pd.DataFrame:
    """
    Build a full feature matrix for a single-symbol OHLCV frame.

    Expects columns: date, open, high, low, close, volume (sorted by date ascending).
    Target is direction over ``horizon`` trading days:
    1 if Close[t+horizon] > Close[t] else 0.
    Features at time t use only information available at t (no look-ahead).
    """
    if horizon < 1:
        raise ValueError("horizon must be >= 1")

    out = df.copy().sort_values("date").reset_index(drop=True)
    close = out["close"].astype(float)
    high = out["high"].astype(float)
    low = out["low"].astype(float)
    volume = out["volume"].astype(float)

    out["sma_5"] = sma(close, 5)
    out["sma_10"] = sma(close, 10)
    out["sma_20"] = sma(close, 20)
    out["sma_50"] = sma(close, 50)
    out["ema_12"] = ema(close, 12)
    out["ema_26"] = ema(close, 26)
    out["rsi_14"] = rsi(close, 14)

    macd_line, signal_line, hist = macd(close)
    out["macd"] = macd_line
    out["macd_signal"] = signal_line
    out["macd_hist"] = hist

    out["atr_14"] = atr(high, low, close, 14)

    bb_upper, bb_mid, bb_lower = bollinger_bands(close, 20, 2.0)
    out["bb_upper"] = bb_upper
    out["bb_mid"] = bb_mid
    out["bb_lower"] = bb_lower
    out["bb_width"] = (bb_upper - bb_lower) / bb_mid.replace(0, np.nan)
    out["bb_pct"] = (close - bb_lower) / (bb_upper - bb_lower).replace(0, np.nan)

    out["momentum_10"] = momentum(close, 10)
    out["roc_10"] = roc(close, 10)
    out["rolling_mean_10"] = rolling_mean(close, 10)
    out["rolling_std_10"] = rolling_std(close, 10)
    out["daily_return"] = daily_return(close)
    out["log_return"] = log_return(close)
    out["rolling_volatility_20"] = rolling_volatility(out["daily_return"], 20)

    for lag in (1, 2, 3, 5, 10):
        out[f"close_lag_{lag}"] = close.shift(lag)
        out[f"return_lag_{lag}"] = out["daily_return"].shift(lag)

    out["volume_change"] = volume.pct_change()
    out["price_change"] = close.diff()
    out["high_low_range"] = (high - low) / close.replace(0, np.nan)
    out["close_open_return"] = (close - out["open"].astype(float)) / out["open"].astype(float).replace(
        0, np.nan
    )

    future_close = close.shift(-horizon)
    out["target"] = (future_close > close).astype("float")
    out.loc[out.index[-horizon:], "target"] = np.nan

    return out


FEATURE_COLUMNS: list[str] = [
    "sma_5",
    "sma_10",
    "sma_20",
    "sma_50",
    "ema_12",
    "ema_26",
    "rsi_14",
    "macd",
    "macd_signal",
    "macd_hist",
    "atr_14",
    "bb_upper",
    "bb_mid",
    "bb_lower",
    "bb_width",
    "bb_pct",
    "momentum_10",
    "roc_10",
    "rolling_mean_10",
    "rolling_std_10",
    "daily_return",
    "log_return",
    "rolling_volatility_20",
    "close_lag_1",
    "close_lag_2",
    "close_lag_3",
    "close_lag_5",
    "close_lag_10",
    "return_lag_1",
    "return_lag_2",
    "return_lag_3",
    "return_lag_5",
    "return_lag_10",
    "volume_change",
    "price_change",
    "high_low_range",
    "close_open_return",
]
