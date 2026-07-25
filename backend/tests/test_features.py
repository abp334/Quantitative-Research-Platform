"""Unit tests for feature engineering indicators."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.ml.features.indicators import (
    FEATURE_COLUMNS,
    build_feature_frame,
    ema,
    rsi,
    sma,
)


def _sample_ohlcv(n: int = 120) -> pd.DataFrame:
    rng = np.random.default_rng(42)
    close = 100 + np.cumsum(rng.normal(0, 1, size=n))
    high = close + rng.uniform(0.5, 2.0, size=n)
    low = close - rng.uniform(0.5, 2.0, size=n)
    open_ = close + rng.normal(0, 0.5, size=n)
    dates = pd.date_range("2018-01-01", periods=n, freq="B").date
    return pd.DataFrame(
        {
            "date": dates,
            "open": open_,
            "high": high,
            "low": low,
            "close": close,
            "volume": rng.integers(1000, 5000, size=n),
        }
    )


def test_sma_matches_manual() -> None:
    s = pd.Series([1.0, 2.0, 3.0, 4.0, 5.0])
    result = sma(s, 3)
    assert pd.isna(result.iloc[1])
    assert result.iloc[2] == pytest.approx(2.0)
    assert result.iloc[4] == pytest.approx(4.0)


def test_ema_finite_after_window() -> None:
    s = pd.Series(np.arange(1, 31, dtype=float))
    result = ema(s, 10)
    assert result.iloc[9:].notna().all()


def test_rsi_bounded() -> None:
    df = _sample_ohlcv()
    values = rsi(df["close"], 14).dropna()
    assert ((values >= 0) & (values <= 100)).all()


def test_build_feature_frame_no_lookahead_target() -> None:
    df = _sample_ohlcv(150)
    featured = build_feature_frame(df, horizon=1)

    for i in range(len(featured) - 1):
        expected = 1.0 if featured.loc[i + 1, "close"] > featured.loc[i, "close"] else 0.0
        if pd.notna(featured.loc[i, "target"]):
            assert featured.loc[i, "target"] == expected

    assert pd.isna(featured.loc[len(featured) - 1, "target"])
    assert featured.loc[10, "close_lag_1"] == pytest.approx(featured.loc[9, "close"])


def test_build_feature_frame_horizon_3() -> None:
    df = _sample_ohlcv(150)
    featured = build_feature_frame(df, horizon=3)
    for i in range(len(featured) - 3):
        expected = 1.0 if featured.loc[i + 3, "close"] > featured.loc[i, "close"] else 0.0
        if pd.notna(featured.loc[i, "target"]):
            assert featured.loc[i, "target"] == expected
    assert featured.tail(3)["target"].isna().all()


def test_feature_columns_present() -> None:
    featured = build_feature_frame(_sample_ohlcv(150))
    for col in FEATURE_COLUMNS:
        assert col in featured.columns
