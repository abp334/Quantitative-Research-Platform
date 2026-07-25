"""Walk-forward validation utilities for time-series ML."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterator

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)


@dataclass(frozen=True)
class WalkForwardFold:
    fold: int
    train_end: int
    test_start: int
    test_end: int


def expanding_walk_forward_splits(
    n_samples: int,
    min_train: int,
    test_size: int,
    step_size: int,
    max_folds: int = 8,
) -> list[WalkForwardFold]:
    """
    Generate expanding-window walk-forward folds.

    Train is always [0, train_end); test is [test_start, test_end).
    Caps the number of folds for tractable training on large panels.
    """
    if n_samples < min_train + test_size:
        return []

    # Auto-widen step on large datasets so we stay within max_folds
    remaining = n_samples - min_train
    inferred_step = max(step_size, int(np.ceil(remaining / max_folds)))
    step = max(step_size, inferred_step)

    folds: list[WalkForwardFold] = []
    fold_idx = 0
    train_end = min_train
    while fold_idx < max_folds:
        test_start = train_end
        test_end = min(test_start + test_size, n_samples)
        if test_start >= n_samples or test_end - test_start < max(10, test_size // 5):
            break
        folds.append(
            WalkForwardFold(
                fold=fold_idx,
                train_end=train_end,
                test_start=test_start,
                test_end=test_end,
            )
        )
        fold_idx += 1
        train_end += step
        if test_end >= n_samples:
            break
    return folds


def compute_classification_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_prob: np.ndarray,
) -> dict:
    """Compute standard binary classification metrics."""
    metrics: dict = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "confusion_matrix": confusion_matrix(y_true, y_pred).tolist(),
    }
    try:
        metrics["roc_auc"] = float(roc_auc_score(y_true, y_prob))
        fpr, tpr, thresholds = roc_curve(y_true, y_prob)
        metrics["roc_curve"] = {
            "fpr": _finite_list(fpr),
            "tpr": _finite_list(tpr),
            "thresholds": _finite_list(thresholds),
        }
    except ValueError:
        metrics["roc_auc"] = None
        metrics["roc_curve"] = None
    return metrics


def _finite_list(arr: np.ndarray) -> list[float]:
    """Convert array to JSON-safe floats (no NaN/Inf)."""
    out: list[float] = []
    for v in np.asarray(arr, dtype=float).tolist():
        if v is None or not np.isfinite(v):
            # ROC thresholds often start with +inf
            out.append(1.0 if (isinstance(v, float) and v > 0) else 0.0)
        else:
            out.append(float(v))
    return out


def aggregate_fold_metrics(fold_metrics: list[dict]) -> dict:
    """Average numeric metrics across folds; keep last ROC/confusion as representative."""
    if not fold_metrics:
        return {}

    keys = ["accuracy", "precision", "recall", "f1", "roc_auc"]
    agg: dict = {}
    for key in keys:
        vals = [m[key] for m in fold_metrics if m.get(key) is not None]
        agg[key] = float(np.mean(vals)) if vals else None

    # Sum confusion matrices
    cms = [np.array(m["confusion_matrix"]) for m in fold_metrics if m.get("confusion_matrix")]
    if cms:
        agg["confusion_matrix"] = np.sum(cms, axis=0).astype(int).tolist()
    else:
        agg["confusion_matrix"] = None

    # Use last fold ROC as display curve
    agg["roc_curve"] = fold_metrics[-1].get("roc_curve")
    return agg


def iter_learning_curve_sizes(
    n_train: int, n_points: int = 5
) -> Iterator[int]:
    """Yield increasing training subset sizes for a learning curve."""
    min_size = max(50, n_train // (n_points + 1))
    sizes = np.linspace(min_size, n_train, n_points, dtype=int)
    for size in sizes:
        yield int(size)
