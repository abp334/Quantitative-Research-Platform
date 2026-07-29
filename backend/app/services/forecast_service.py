"""Managed multi-horizon price forecasting and market intelligence.

The public API deliberately exposes market outcomes rather than model internals.  This
module trains a compact regression ensemble on one stock's stationary price/volume
features, validates it on the most recent unseen history, and produces a price path with
empirical uncertainty bands.
"""

from __future__ import annotations

from datetime import date, timedelta
from math import erf, sqrt
from time import monotonic
from typing import Any, Sequence

import numpy as np
import pandas as pd
from anyio import to_thread
from sklearn.ensemble import ExtraTreesRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sqlalchemy.ext.asyncio import AsyncSession

from app.ml.features.indicators import atr, bollinger_bands, macd, rsi
from app.repositories import OhlcvRepository, StockRepository

FORECAST_DAYS = (5, 10, 20)
MIN_HISTORY = 320
MAX_TRAIN_ROWS = 2200

_scanner_cache: dict[tuple[int, int], tuple[float, list[dict[str, Any]]]] = {}
_forecast_cache: dict[tuple[int, int, date], tuple[float, dict[str, Any]]] = {}


def _bars_frame(bars: Sequence[Any]) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "date": [b.date for b in bars],
            "open": [float(b.open) for b in bars],
            "high": [float(b.high) for b in bars],
            "low": [float(b.low) for b in bars],
            "close": [float(b.close) for b in bars],
            "volume": [float(b.volume) for b in bars],
        }
    ).sort_values("date").reset_index(drop=True)


def build_market_features(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Create stationary features using information available at each row only."""
    close = df["close"].astype(float)
    high = df["high"].astype(float)
    low = df["low"].astype(float)
    open_ = df["open"].astype(float)
    volume = df["volume"].astype(float)
    out = pd.DataFrame({"date": df["date"], "close": close})

    for window in (1, 2, 3, 5, 10, 20, 60):
        out[f"return_{window}"] = close.pct_change(window)
    for window in (5, 10, 20, 50, 100):
        average = close.rolling(window).mean()
        out[f"distance_sma_{window}"] = close / average - 1.0
    daily = close.pct_change()
    for window in (5, 10, 20, 60):
        out[f"volatility_{window}"] = daily.rolling(window).std() * np.sqrt(252)

    out["rsi_14"] = rsi(close, 14) / 100.0
    macd_line, macd_signal, macd_hist = macd(close)
    out["macd_norm"] = macd_line / close
    out["macd_signal_norm"] = macd_signal / close
    out["macd_hist_norm"] = macd_hist / close
    out["atr_norm"] = atr(high, low, close, 14) / close
    bb_upper, bb_mid, bb_lower = bollinger_bands(close, 20)
    out["bb_width"] = (bb_upper - bb_lower) / bb_mid
    out["bb_position"] = (close - bb_lower) / (bb_upper - bb_lower)

    volume_mean = volume.rolling(20).mean()
    volume_std = volume.rolling(20).std()
    out["volume_ratio"] = volume / volume_mean
    out["volume_zscore"] = (volume - volume_mean) / volume_std
    out["intraday_range"] = (high - low) / close
    out["close_location"] = (close - low) / (high - low).replace(0, np.nan)
    out["open_gap"] = open_ / close.shift(1) - 1.0
    out["drawdown_20"] = close / close.rolling(20).max() - 1.0
    out["drawdown_60"] = close / close.rolling(60).max() - 1.0

    feature_columns = [c for c in out.columns if c not in {"date", "close"}]
    out[feature_columns] = out[feature_columns].replace([np.inf, -np.inf], np.nan)
    return out, feature_columns


def _future_business_dates(last_date: date, days: int) -> list[date]:
    dates: list[date] = []
    cursor = last_date
    while len(dates) < days:
        cursor += timedelta(days=1)
        if cursor.weekday() < 5:
            dates.append(cursor)
    return dates


def _normal_cdf(value: float) -> float:
    return 0.5 * (1.0 + erf(value / sqrt(2.0)))


def _factor_snapshot(df: pd.DataFrame, frame: pd.DataFrame) -> tuple[list[dict], dict]:
    latest = frame.iloc[-1]
    close = float(df["close"].iloc[-1])
    sma20 = float(df["close"].rolling(20).mean().iloc[-1])
    sma50 = float(df["close"].rolling(50).mean().iloc[-1])
    momentum = float(latest["return_20"])
    rsi_value = float(latest["rsi_14"] * 100)
    volume_ratio = float(latest["volume_ratio"])
    volatility = float(latest["volatility_20"])

    trend_score = float(np.clip(((close / sma20 - 1) * 12 + (sma20 / sma50 - 1) * 8), -1, 1))
    momentum_score = float(np.clip(momentum * 8 + (rsi_value - 50) / 50, -1, 1))
    volume_score = float(np.clip((volume_ratio - 1) * 0.8, -1, 1))
    vol_score = float(np.clip(1 - volatility / 0.45, -1, 1))
    mean_reversion_score = float(np.clip((0.5 - float(latest["bb_position"])) * 1.5, -1, 1))

    def state(score: float) -> str:
        return "positive" if score > 0.15 else "negative" if score < -0.15 else "neutral"

    factors = [
        {
            "name": "Trend structure",
            "state": state(trend_score),
            "score": round(trend_score, 4),
            "description": f"Price is {'above' if close >= sma20 else 'below'} its 20-session average and the medium-term trend is {'rising' if sma20 >= sma50 else 'softening'}.",
        },
        {
            "name": "Momentum",
            "state": state(momentum_score),
            "score": round(momentum_score, 4),
            "description": f"20-session return is {momentum * 100:+.1f}% with RSI at {rsi_value:.0f}.",
        },
        {
            "name": "Trading activity",
            "state": state(volume_score),
            "score": round(volume_score, 4),
            "description": f"Latest volume is {volume_ratio:.1f}× its 20-session average.",
        },
        {
            "name": "Volatility environment",
            "state": state(vol_score),
            "score": round(vol_score, 4),
            "description": f"Recent annualised volatility is {volatility * 100:.1f}%.",
        },
        {
            "name": "Price stretch",
            "state": state(mean_reversion_score),
            "score": round(mean_reversion_score, 4),
            "description": "Position inside the recent trading envelope indicates whether price is stretched.",
        },
    ]

    recent = df.tail(60)
    support = float(recent["low"].quantile(0.12))
    resistance = float(recent["high"].quantile(0.88))
    if close > sma20 > sma50:
        regime = "Bullish trend"
    elif close < sma20 < sma50:
        regime = "Bearish trend"
    else:
        regime = "Range / transition"
    risk = "High" if volatility >= 0.38 else "Moderate" if volatility >= 0.22 else "Low"
    context = {
        "regime": regime,
        "risk_level": risk,
        "annualized_volatility": round(volatility, 6),
        "support": round(support, 4),
        "resistance": round(resistance, 4),
        "rsi": round(rsi_value, 2),
        "volume_ratio": round(volume_ratio, 3),
    }
    return factors, context


def fit_price_forecast(df: pd.DataFrame, days: int) -> dict[str, Any]:
    """Fit an ensemble and return a validated price distribution."""
    if days not in FORECAST_DAYS:
        raise ValueError(f"days must be one of {list(FORECAST_DAYS)}")
    if len(df) < MIN_HISTORY:
        raise ValueError(f"At least {MIN_HISTORY} historical sessions are required")

    frame, features = build_market_features(df)
    targets: list[str] = []
    for step in range(1, days + 1):
        key = f"target_{step}"
        frame[key] = df["close"].shift(-step) / df["close"] - 1.0
        targets.append(key)

    usable = frame.dropna(subset=features + targets).tail(MAX_TRAIN_ROWS).copy()
    latest_features = frame.dropna(subset=features).iloc[-1]
    if len(usable) < 220:
        raise ValueError("Not enough clean history to build a reliable forecast")

    X = usable[features].to_numpy(dtype=float)
    y = usable[targets].to_numpy(dtype=float)
    train_end = max(160, int(len(X) * 0.68))
    calibration_start = train_end + days
    calibration_end = int(len(X) * 0.84)
    test_start = calibration_end + days
    if test_start >= len(X) - 40:
        raise ValueError("Not enough history for purged forecast validation")
    X_train, y_train = X[:train_end], y[:train_end]
    X_cal, y_cal = X[calibration_start:calibration_end], y[calibration_start:calibration_end]
    X_test, y_test = X[test_start:], y[test_start:]

    models = [
        make_pipeline(StandardScaler(), Ridge(alpha=18.0)),
        RandomForestRegressor(
            n_estimators=120,
            max_depth=8,
            min_samples_leaf=6,
            max_features=0.75,
            random_state=42,
            n_jobs=-1,
        ),
        ExtraTreesRegressor(
            n_estimators=120,
            max_depth=10,
            min_samples_leaf=5,
            max_features=0.8,
            random_state=43,
            n_jobs=-1,
        ),
    ]
    calibration_predictions: list[np.ndarray] = []
    test_predictions: list[np.ndarray] = []
    future_predictions: list[np.ndarray] = []
    X_latest = latest_features[features].to_numpy(dtype=float).reshape(1, -1)
    for model in models:
        model.fit(X_train, y_train)
        calibration_predictions.append(np.asarray(model.predict(X_cal)).reshape(len(X_cal), days))
        test_predictions.append(np.asarray(model.predict(X_test)).reshape(len(X_test), days))
        # Refit on all known targets before producing the current forecast.
        model.fit(X, y)
        future_predictions.append(np.asarray(model.predict(X_latest)).reshape(days))

    errors = np.array([np.mean(np.abs(p - y_cal)) for p in calibration_predictions])
    weights = 1.0 / np.maximum(errors, 1e-5)
    weights = weights / weights.sum()
    calibration_pred = sum(w * p for w, p in zip(weights, calibration_predictions))
    test_pred = sum(w * p for w, p in zip(weights, test_predictions))
    future_return = sum(w * p for w, p in zip(weights, future_predictions))

    # Prevent isolated extrapolations beyond what the stock has historically demonstrated.
    for i in range(days):
        lo, hi = np.quantile(y[:, i], [0.015, 0.985])
        future_return[i] = float(np.clip(future_return[i], lo, hi))

    calibration_residuals = y_cal - calibration_pred
    residual_low = np.quantile(calibration_residuals, 0.10, axis=0)
    residual_high = np.quantile(calibration_residuals, 0.90, axis=0)
    recent_daily_vol = float(df["close"].pct_change().tail(60).std())
    current_price = float(df["close"].iloc[-1])
    future_dates = _future_business_dates(df["date"].iloc[-1], days)

    points: list[dict[str, Any]] = []
    for i in range(days):
        step = i + 1
        statistical_width = recent_daily_vol * sqrt(step) * 0.8
        low_return = min(future_return[i] + residual_low[i], future_return[i] - statistical_width)
        high_return = max(future_return[i] + residual_high[i], future_return[i] + statistical_width)
        points.append(
            {
                "day": step,
                "date": future_dates[i],
                "predicted_price": round(current_price * (1 + future_return[i]), 4),
                "lower_price": round(max(0.01, current_price * (1 + low_return)), 4),
                "upper_price": round(current_price * (1 + high_return), 4),
                "predicted_return": round(float(future_return[i]), 7),
            }
        )

    final_residual_std = max(float(np.std(calibration_residuals[:, -1])), 1e-5)
    probability_up = float(np.clip(_normal_cdf(float(future_return[-1]) / final_residual_std), 0.03, 0.97))
    direction_accuracy = float(np.mean((test_pred[:, -1] >= 0) == (y_test[:, -1] >= 0)))
    mae = float(np.mean(np.abs(test_pred[:, -1] - y_test[:, -1])))
    rmse = float(np.sqrt(np.mean((test_pred[:, -1] - y_test[:, -1]) ** 2)))
    low_test = test_pred[:, -1] + residual_low[-1]
    high_test = test_pred[:, -1] + residual_high[-1]
    coverage = float(np.mean((y_test[:, -1] >= low_test) & (y_test[:, -1] <= high_test)))
    confidence = float(
        np.clip(
            abs(probability_up - 0.5) * 1.35
            + max(direction_accuracy - 0.5, 0) * 0.8
            - min(mae / max(recent_daily_vol * sqrt(days), 1e-5), 1) * 0.15,
            0.05,
            0.95,
        )
    )

    recent_validation = []
    test_dates = usable["date"].iloc[test_start:].tolist()
    for idx in range(max(0, len(y_test) - 36), len(y_test)):
        recent_validation.append(
            {
                "date": test_dates[idx],
                "predicted_return": round(float(test_pred[idx, -1]), 7),
                "actual_return": round(float(y_test[idx, -1]), 7),
                "direction_correct": bool((test_pred[idx, -1] >= 0) == (y_test[idx, -1] >= 0)),
            }
        )

    factors, context = _factor_snapshot(df, frame)
    final_point = points[-1]
    expected_return = float(future_return[-1])
    bias = "Bullish" if probability_up >= 0.57 else "Bearish" if probability_up <= 0.43 else "Neutral"
    strongest = sorted(factors, key=lambda item: abs(item["score"]), reverse=True)[:2]
    narrative = (
        f"The {days}-session forecast has a {bias.lower()} bias with a base estimate of "
        f"{expected_return * 100:+.2f}%. {strongest[0]['description']} "
        f"The expected range remains wide enough to treat this as a probability, not a target."
    )
    scenarios = {
        "bear": {
            "label": "Bear case",
            "price": final_point["lower_price"],
            "return": round(final_point["lower_price"] / current_price - 1, 7),
        },
        "base": {
            "label": "Base case",
            "price": final_point["predicted_price"],
            "return": round(expected_return, 7),
        },
        "bull": {
            "label": "Bull case",
            "price": final_point["upper_price"],
            "return": round(final_point["upper_price"] / current_price - 1, 7),
        },
    }
    return {
        "as_of_date": df["date"].iloc[-1],
        "current_price": round(current_price, 4),
        "horizon_days": days,
        "bias": bias,
        "probability_up": round(probability_up, 6),
        "confidence": round(confidence, 6),
        "expected_return": round(expected_return, 7),
        "target_price": final_point["predicted_price"],
        "expected_low": final_point["lower_price"],
        "expected_high": final_point["upper_price"],
        "forecast_points": points,
        "scenarios": scenarios,
        "market_context": context,
        "factors": factors,
        "narrative": narrative,
        "validation": {
            "direction_accuracy": round(direction_accuracy, 6),
            "mae_percent": round(mae * 100, 5),
            "rmse_percent": round(rmse * 100, 5),
            "interval_coverage": round(coverage, 6),
            "validation_samples": len(y_test),
            "recent": recent_validation,
        },
    }


def _fast_scan_signal(df: pd.DataFrame, horizon: int) -> dict[str, float | str]:
    frame, features = build_market_features(df)
    frame["target"] = df["close"].shift(-horizon) / df["close"] - 1
    usable = frame.dropna(subset=features + ["target"]).tail(1400)
    latest = frame.dropna(subset=features).iloc[-1]
    if len(usable) < 180:
        raise ValueError("insufficient history")
    X = usable[features].to_numpy(dtype=float)
    y = usable["target"].to_numpy(dtype=float)
    split = max(120, int(len(X) * 0.8))
    test_start = min(split + horizon, len(X) - 30)
    model = make_pipeline(StandardScaler(), Ridge(alpha=20.0))
    model.fit(X[:split], y[:split])
    validation = model.predict(X[test_start:])
    accuracy = float(np.mean((validation >= 0) == (y[test_start:] >= 0)))
    model.fit(X, y)
    predicted = float(model.predict(latest[features].to_numpy(dtype=float).reshape(1, -1))[0])
    residual_std = max(float(np.std(y[test_start:] - validation)), 1e-5)
    probability = float(np.clip(_normal_cdf(predicted / residual_std), 0.05, 0.95))
    vol = float(df["close"].pct_change().tail(20).std() * np.sqrt(252))
    score = (probability - 0.5) * 160 + (accuracy - 0.5) * 40 - max(vol - 0.35, 0) * 20
    return {
        "expected_return": round(predicted, 7),
        "probability_up": round(probability, 6),
        "validation_accuracy": round(accuracy, 6),
        "volatility": round(vol, 6),
        "score": round(float(np.clip(score, -100, 100)), 2),
    }


class ForecastService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.stocks = StockRepository(session)
        self.ohlcv = OhlcvRepository(session)

    async def forecast(self, symbol: str, days: int) -> dict[str, Any]:
        stock = await self.stocks.get_by_symbol(symbol)
        if not stock:
            raise ValueError(f"Stock not found: {symbol}")
        bars = await self.ohlcv.get_bars(stock.id, limit=2600)
        if not bars:
            raise ValueError(f"No price history is available for {stock.symbol}")
        cache_key = (stock.id, days, bars[-1].date)
        cached = _forecast_cache.get(cache_key)
        if cached and monotonic() - cached[0] < 300:
            return cached[1]
        result = await to_thread.run_sync(fit_price_forecast, _bars_frame(bars), days)
        output = {
            "symbol": stock.symbol,
            "company_name": stock.company_name,
            "industry": stock.industry,
            **result,
        }
        _forecast_cache[cache_key] = (monotonic(), output)
        return output

    async def scanner(self, horizon: int = 5, limit: int = 50) -> list[dict[str, Any]]:
        if horizon not in FORECAST_DAYS:
            raise ValueError(f"horizon must be one of {list(FORECAST_DAYS)}")
        cache_key = (horizon, limit)
        cached = _scanner_cache.get(cache_key)
        if cached and monotonic() - cached[0] < 300:
            return cached[1]

        results: list[dict[str, Any]] = []
        for stock in await self.stocks.list_stocks():
            bars = await self.ohlcv.get_bars(stock.id, limit=1800)
            if len(bars) < MIN_HISTORY:
                continue
            try:
                signal = await to_thread.run_sync(_fast_scan_signal, _bars_frame(bars), horizon)
            except (ValueError, np.linalg.LinAlgError):
                continue
            results.append(
                {
                    "symbol": stock.symbol,
                    "company_name": stock.company_name,
                    "industry": stock.industry,
                    "as_of_date": bars[-1].date,
                    "last_price": round(float(bars[-1].close), 4),
                    **signal,
                }
            )
        results.sort(key=lambda item: item["score"], reverse=True)
        output = results[:limit]
        _scanner_cache[cache_key] = (monotonic(), output)
        return output
