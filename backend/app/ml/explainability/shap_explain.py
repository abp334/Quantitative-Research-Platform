"""SHAP-based explainability helpers."""

from __future__ import annotations

from typing import Any

import numpy as np
import shap


def explain_prediction(
    model: Any,
    algorithm: str,
    X_row: np.ndarray,
    feature_names: list[str],
    background: np.ndarray | None = None,
) -> dict[str, Any]:
    """
    Compute SHAP values for a single prediction row.

    Returns feature contributions sorted by absolute impact.
    """
    X_row = np.asarray(X_row, dtype=float).reshape(1, -1)
    shap_vals = _compute_shap(model, algorithm, X_row, background)

    contributions = []
    for name, value, sv in zip(feature_names, X_row[0], shap_vals[0]):
        contributions.append(
            {
                "feature": name,
                "value": float(value) if np.isfinite(value) else 0.0,
                "shap": float(sv) if np.isfinite(sv) else 0.0,
            }
        )

    contributions.sort(key=lambda c: abs(c["shap"]), reverse=True)
    positive = [c for c in contributions if c["shap"] > 0]
    negative = [c for c in contributions if c["shap"] < 0]

    return {
        "top_features": contributions[:15],
        "positive_contributions": positive[:10],
        "negative_contributions": negative[:10],
        "all_contributions": contributions,
    }


def global_mean_abs_shap(
    model: Any,
    algorithm: str,
    X: np.ndarray,
    feature_names: list[str],
    max_samples: int = 500,
) -> dict[str, float]:
    """Mean |SHAP| across a sample of rows as global importance."""
    X = np.asarray(X, dtype=float)
    if len(X) > max_samples:
        rng = np.random.default_rng(42)
        idx = rng.choice(len(X), size=max_samples, replace=False)
        X = X[idx]

    background = X[: min(100, len(X))]
    shap_vals = _compute_shap(model, algorithm, X, background)
    mean_abs = np.mean(np.abs(shap_vals), axis=0)
    importance = {
        name: float(v) for name, v in zip(feature_names, mean_abs) if np.isfinite(v)
    }
    return dict(sorted(importance.items(), key=lambda kv: kv[1], reverse=True))


def _compute_shap(
    model: Any,
    algorithm: str,
    X: np.ndarray,
    background: np.ndarray | None,
) -> np.ndarray:
    if algorithm == "logistic_regression":
        # Pipeline: explain the linear classifier on scaled features
        scaler = model.named_steps["scaler"]
        clf = model.named_steps["clf"]
        X_scaled = scaler.transform(X)
        bg = scaler.transform(background) if background is not None else X_scaled
        explainer = shap.LinearExplainer(clf, bg)
        values = explainer.shap_values(X_scaled)
        if isinstance(values, list):
            values = values[1]
        return np.asarray(values)

    if algorithm in ("random_forest", "xgboost"):
        explainer = shap.TreeExplainer(model)
        values = explainer.shap_values(X)
        if isinstance(values, list):
            # binary RF returns [class0, class1]
            values = values[1]
        return np.asarray(values)

    # Fallback
    bg = background if background is not None else X[: min(50, len(X))]
    explainer = shap.KernelExplainer(model.predict_proba, bg)
    values = explainer.shap_values(X, nsamples=100)
    if isinstance(values, list):
        values = values[1]
    return np.asarray(values)


def extract_native_importance(model: Any, algorithm: str, feature_names: list[str]) -> dict[str, float]:
    """Extract model-native feature importances where available."""
    if algorithm == "logistic_regression":
        clf = model.named_steps["clf"]
        coefs = np.abs(clf.coef_).ravel()
        return dict(
            sorted(
                {n: float(v) for n, v in zip(feature_names, coefs)}.items(),
                key=lambda kv: kv[1],
                reverse=True,
            )
        )
    if algorithm in ("random_forest", "xgboost"):
        imp = model.feature_importances_
        return dict(
            sorted(
                {n: float(v) for n, v in zip(feature_names, imp)}.items(),
                key=lambda kv: kv[1],
                reverse=True,
            )
        )
    return {}
