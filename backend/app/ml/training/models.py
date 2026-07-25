"""Model factories and Optuna hyperparameter search spaces."""

from __future__ import annotations

from typing import Any, Callable

import optuna
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier


SUPPORTED_ALGORITHMS = ("logistic_regression", "random_forest", "xgboost")


def build_model(algorithm: str, params: dict[str, Any] | None = None) -> Any:
    """Instantiate a classifier pipeline for the given algorithm."""
    params = params or {}
    if algorithm == "logistic_regression":
        clf = LogisticRegression(
            max_iter=params.get("max_iter", 1000),
            C=params.get("C", 1.0),
            class_weight=params.get("class_weight", "balanced"),
            solver=params.get("solver", "lbfgs"),
            random_state=42,
        )
        return Pipeline([("scaler", StandardScaler()), ("clf", clf)])

    if algorithm == "random_forest":
        return RandomForestClassifier(
            n_estimators=params.get("n_estimators", 200),
            max_depth=params.get("max_depth", 8),
            min_samples_split=params.get("min_samples_split", 5),
            min_samples_leaf=params.get("min_samples_leaf", 2),
            class_weight=params.get("class_weight", "balanced_subsample"),
            random_state=42,
            n_jobs=-1,
        )

    if algorithm == "xgboost":
        return XGBClassifier(
            n_estimators=params.get("n_estimators", 200),
            max_depth=params.get("max_depth", 5),
            learning_rate=params.get("learning_rate", 0.05),
            subsample=params.get("subsample", 0.8),
            colsample_bytree=params.get("colsample_bytree", 0.8),
            min_child_weight=params.get("min_child_weight", 3),
            reg_lambda=params.get("reg_lambda", 1.0),
            objective="binary:logistic",
            eval_metric="logloss",
            random_state=42,
            n_jobs=-1,
            verbosity=0,
        )

    raise ValueError(f"Unsupported algorithm: {algorithm}")


def suggest_params(trial: optuna.Trial, algorithm: str) -> dict[str, Any]:
    """Optuna search space per algorithm."""
    if algorithm == "logistic_regression":
        return {
            "C": trial.suggest_float("C", 1e-3, 10.0, log=True),
            "max_iter": 1000,
            "class_weight": "balanced",
            "solver": "lbfgs",
        }
    if algorithm == "random_forest":
        return {
            "n_estimators": trial.suggest_int("n_estimators", 100, 400, step=50),
            "max_depth": trial.suggest_int("max_depth", 4, 16),
            "min_samples_split": trial.suggest_int("min_samples_split", 2, 20),
            "min_samples_leaf": trial.suggest_int("min_samples_leaf", 1, 10),
            "class_weight": "balanced_subsample",
        }
    if algorithm == "xgboost":
        return {
            "n_estimators": trial.suggest_int("n_estimators", 100, 400, step=50),
            "max_depth": trial.suggest_int("max_depth", 3, 10),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
            "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
            "reg_lambda": trial.suggest_float("reg_lambda", 0.1, 10.0, log=True),
        }
    raise ValueError(f"Unsupported algorithm: {algorithm}")


def make_optuna_objective(
    algorithm: str,
    X_train,
    y_train,
    X_val,
    y_val,
) -> Callable[[optuna.Trial], float]:
    """Create an Optuna objective maximizing validation ROC-AUC (fallback F1)."""
    from sklearn.metrics import f1_score, roc_auc_score

    def objective(trial: optuna.Trial) -> float:
        params = suggest_params(trial, algorithm)
        model = build_model(algorithm, params)
        model.fit(X_train, y_train)
        if hasattr(model, "predict_proba"):
            proba = model.predict_proba(X_val)[:, 1]
        else:
            proba = model.decision_function(X_val)
            proba = (proba - proba.min()) / (proba.max() - proba.min() + 1e-9)
        try:
            return float(roc_auc_score(y_val, proba))
        except ValueError:
            preds = (proba >= 0.5).astype(int)
            return float(f1_score(y_val, preds, zero_division=0))

    return objective
