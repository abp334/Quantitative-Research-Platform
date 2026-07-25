"""Template-based natural language explanations (no LLMs)."""

from __future__ import annotations

from typing import Any


def _friendly_name(feature: str) -> str:
    mapping = {
        "rsi_14": "RSI",
        "macd": "MACD",
        "macd_signal": "MACD signal",
        "macd_hist": "MACD histogram",
        "atr_14": "ATR",
        "momentum_10": "Momentum",
        "roc_10": "Rate of Change",
        "rolling_volatility_20": "Rolling volatility",
        "bb_width": "Bollinger width",
        "bb_pct": "Bollinger %B",
        "daily_return": "Daily return",
        "volume_change": "Volume change",
        "price_change": "Price change",
    }
    if feature in mapping:
        return mapping[feature]
    if feature.startswith("sma_"):
        return f"SMA({feature.split('_')[1]})"
    if feature.startswith("ema_"):
        return f"EMA({feature.split('_')[1]})"
    if feature.startswith("close_lag_"):
        return f"Close lag {feature.split('_')[-1]}"
    if feature.startswith("return_lag_"):
        return f"Return lag {feature.split('_')[-1]}"
    return feature.replace("_", " ")


def shap_narrative(top_features: list[dict[str, Any]], n: int = 3) -> str:
    if not top_features:
        return "Insufficient SHAP contributions were available to explain this prediction."
    names = [_friendly_name(f["feature"]) for f in top_features[:n]]
    if len(names) == 1:
        return f"The prediction was primarily influenced by {names[0]}."
    if len(names) == 2:
        return f"The prediction was primarily influenced by {names[0]} and {names[1]}."
    return (
        f"The prediction was primarily influenced by {names[0]}, {names[1]} and {names[2]}."
    )


def prediction_summary(
    symbol: str,
    label: str,
    probability_up: float,
    confidence: float,
    algorithm: str,
    horizon: int,
    top_features: list[dict[str, Any]],
) -> str:
    direction = "an upward" if label == "UP" else "a downward"
    horizon_txt = "next trading day" if horizon == 1 else f"next {horizon} trading days"
    drivers = shap_narrative(top_features)
    return (
        f"{symbol}: the {algorithm.replace('_', ' ')} model predicts {direction} move "
        f"over the {horizon_txt} with P(UP)={probability_up:.1%} and "
        f"confidence={confidence:.1%}. {drivers}"
    )


def best_model_explanation(ranked: list[dict[str, Any]]) -> str:
    if not ranked:
        return "No trained models are available for comparison yet."
    best = ranked[0]
    algo = best["algorithm"].replace("_", " ")
    auc = best.get("roc_auc")
    precision = best.get("precision")
    parts = [f"{algo} ranks first overall"]
    if auc is not None:
        parts.append(f"with the highest ROC AUC ({auc:.3f})")
    if precision is not None:
        parts.append(f"while maintaining solid precision ({precision:.3f})")
    return " ".join(parts) + "."
