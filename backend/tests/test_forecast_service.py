from __future__ import annotations

import numpy as np
import pandas as pd

from app.services.forecast_service import build_market_features, fit_price_forecast


def _history(rows: int = 520) -> pd.DataFrame:
    rng = np.random.default_rng(14)
    trend = np.linspace(0, 0.35, rows)
    returns = trend / rows + rng.normal(0, 0.012, rows)
    close = 500 * np.exp(np.cumsum(returns))
    return pd.DataFrame(
        {
            "date": pd.date_range("2018-01-01", periods=rows, freq="B").date,
            "open": close * (1 + rng.normal(0, 0.003, rows)),
            "high": close * (1 + rng.uniform(0.002, 0.018, rows)),
            "low": close * (1 - rng.uniform(0.002, 0.018, rows)),
            "close": close,
            "volume": rng.integers(100_000, 2_000_000, rows),
        }
    )


def test_market_features_do_not_use_future_rows() -> None:
    original = _history()
    changed = original.copy()
    changed.loc[changed.index[-10:], "close"] *= 1.8
    first, columns = build_market_features(original)
    second, _ = build_market_features(changed)
    comparison_row = len(original) - 11
    np.testing.assert_allclose(
        first.loc[comparison_row, columns].to_numpy(float),
        second.loc[comparison_row, columns].to_numpy(float),
        rtol=1e-10,
        atol=1e-10,
    )


def test_forecast_returns_path_ranges_and_purged_validation() -> None:
    result = fit_price_forecast(_history(), days=5)
    assert len(result["forecast_points"]) == 5
    assert result["forecast_points"][-1]["predicted_price"] == result["target_price"]
    assert all(
        point["lower_price"] <= point["predicted_price"] <= point["upper_price"]
        for point in result["forecast_points"]
    )
    assert 0 <= result["probability_up"] <= 1
    assert 0 <= result["confidence"] <= 1
    assert result["market_context"]["support"] < result["market_context"]["resistance"]
    assert result["validation"]["validation_samples"] >= 40
    assert result["validation"]["recent"]
