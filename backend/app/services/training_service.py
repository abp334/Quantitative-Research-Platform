"""Model training service with Optuna + walk-forward validation."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import joblib
import numpy as np
import optuna
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.session import AsyncSessionLocal
from app.ml.evaluation.walk_forward import (
    aggregate_fold_metrics,
    compute_classification_metrics,
    expanding_walk_forward_splits,
    iter_learning_curve_sizes,
)
from app.ml.explainability.shap_explain import extract_native_importance, global_mean_abs_shap
from app.ml.features.indicators import FEATURE_COLUMNS
from app.ml.training.models import SUPPORTED_ALGORITHMS, build_model, make_optuna_objective
from app.models import ModelArtifact, ModelMetric, TrainingJob
from app.repositories import FeatureRepository, StockRepository, TrainingRepository
from app.services.feature_service import ALLOWED_HORIZONS, FeatureService

logger = get_logger(__name__)
optuna.logging.set_verbosity(optuna.logging.WARNING)


class TrainingService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.training = TrainingRepository(session)
        self.features = FeatureRepository(session)
        self.stocks = StockRepository(session)
        self.settings = get_settings()

    async def start_job(self, config: dict[str, Any]) -> TrainingJob:
        horizon = int(config.get("prediction_horizon", 1))
        if horizon not in ALLOWED_HORIZONS:
            raise ValueError(f"prediction_horizon must be one of {sorted(ALLOWED_HORIZONS)}")
        config["prediction_horizon"] = horizon

        symbols = config.get("symbols") or self.settings.default_symbols_list
        config["symbols"] = symbols

        feature_run_id = config.get("feature_run_id")
        if feature_run_id is None:
            feature_svc = FeatureService(self.session)
            feature_run_id = await feature_svc.ensure_horizon_run(symbols, horizon)
            config["feature_run_id"] = feature_run_id

        job = await self.training.create_job(config=config, feature_run_id=feature_run_id)
        await self.session.commit()
        return job

    async def run_job(self, job_id: int) -> None:
        async with AsyncSessionLocal() as session:
            service = TrainingService(session)
            await service._execute(job_id)

    async def _set_progress(
        self,
        job: TrainingJob,
        message: str,
        detail: Optional[dict[str, Any]] = None,
    ) -> None:
        job.progress = message
        if detail is not None:
            job.progress_detail = detail
        await self.session.commit()

    async def _execute(self, job_id: int) -> None:
        job = await self.training.get_job(job_id)
        if not job:
            logger.error("Training job %s not found", job_id)
            return

        job.status = "running"
        job.started_at = datetime.now(timezone.utc)
        t0 = time.perf_counter()
        await self._set_progress(job, "Loading features", {"pct": 5, "phase": "load"})

        try:
            config = job.config
            feature_run_id = config["feature_run_id"]
            symbols = config.get("symbols") or self.settings.default_symbols_list
            algorithms = config.get("algorithms") or list(SUPPORTED_ALGORITHMS)
            n_trials = int(config.get("optuna_trials") or self.settings.optuna_trials)
            horizon = int(config.get("prediction_horizon", 1))

            stock_map = {s.symbol: s for s in await self.stocks.list_stocks()}
            stock_ids = [stock_map[s].id for s in symbols if s in stock_map]
            if not stock_ids:
                raise ValueError(f"No matching stocks for symbols: {symbols}")

            rows = await self.features.get_training_frame(feature_run_id, stock_ids)
            if len(rows) < self.settings.walk_forward_min_train_days + 50:
                raise ValueError(
                    f"Insufficient feature rows for training: {len(rows)} "
                    f"(feature_run_id={feature_run_id}, symbols={len(stock_ids)}). "
                    "The selected feature run does not cover these tickers, or history is too short. "
                    "Re-run training (features will regenerate for the selected symbols), "
                    "or start with liquid names like RELIANCE, TCS, INFY, HDFCBANK, SBIN "
                    "and horizon 1 before scaling to the full universe."
                )

            rows = sorted(rows, key=lambda r: (r.date, r.stock_id))
            X = np.array([[r.features[c] for c in FEATURE_COLUMNS] for r in rows], dtype=float)
            y = np.array([r.target for r in rows], dtype=int)
            mask = np.isfinite(X).all(axis=1) & np.isfinite(y)
            X, y = X[mask], y[mask]

            models_dir = Path(self.settings.models_dir)
            models_dir.mkdir(parents=True, exist_ok=True)

            n_algos = max(len(algorithms), 1)
            for algo_idx, algorithm in enumerate(algorithms):
                if algorithm not in SUPPORTED_ALGORITHMS:
                    logger.warning("Skipping unsupported algorithm: %s", algorithm)
                    continue

                algo_t0 = time.perf_counter()
                base_pct = 10 + int(80 * algo_idx / n_algos)

                await self._set_progress(
                    job,
                    f"Tuning {algorithm}",
                    {
                        "pct": base_pct,
                        "phase": "optuna",
                        "algorithm": algorithm,
                        "trial": 0,
                        "n_trials": n_trials,
                        "elapsed_seconds": round(time.perf_counter() - t0, 1),
                    },
                )

                best_params = await self._tune_async(
                    job, algorithm, X, y, n_trials, t0, base_pct
                )

                folds = expanding_walk_forward_splits(
                    n_samples=len(X),
                    min_train=self.settings.walk_forward_min_train_days,
                    test_size=self.settings.walk_forward_test_days,
                    step_size=self.settings.walk_forward_step_days,
                )
                fold_metrics: list[dict] = []
                for fold in folds:
                    await self._set_progress(
                        job,
                        f"Walk-forward {algorithm} fold {fold.fold + 1}/{len(folds)}",
                        {
                            "pct": base_pct + int(15 * (fold.fold + 1) / max(len(folds), 1)),
                            "phase": "walk_forward",
                            "algorithm": algorithm,
                            "fold": fold.fold + 1,
                            "n_folds": len(folds),
                            "elapsed_seconds": round(time.perf_counter() - t0, 1),
                            "eta_seconds": None,
                        },
                    )
                    model = build_model(algorithm, best_params)
                    X_train, y_train = X[: fold.train_end], y[: fold.train_end]
                    X_test, y_test = X[fold.test_start : fold.test_end], y[fold.test_start : fold.test_end]
                    if len(np.unique(y_train)) < 2 or len(y_test) == 0:
                        continue
                    model.fit(X_train, y_train)
                    proba = model.predict_proba(X_test)[:, 1]
                    pred = (proba >= 0.5).astype(int)
                    metrics = compute_classification_metrics(y_test, pred, proba)
                    metrics["fold"] = fold.fold
                    fold_metrics.append(metrics)

                learning_curve = self._learning_curve(algorithm, best_params, X, y, folds)
                agg = aggregate_fold_metrics(fold_metrics)
                agg["learning_curve"] = learning_curve

                final_model = build_model(algorithm, best_params)
                final_model.fit(X, y)

                native_imp = extract_native_importance(final_model, algorithm, FEATURE_COLUMNS)
                try:
                    shap_imp = global_mean_abs_shap(final_model, algorithm, X, FEATURE_COLUMNS)
                except Exception:
                    logger.exception("SHAP global importance failed for %s", algorithm)
                    shap_imp = native_imp

                artifact_name = f"{algorithm}_h{horizon}_job{job_id}"
                artifact_path = models_dir / f"{artifact_name}.joblib"
                joblib.dump(
                    {
                        "model": final_model,
                        "algorithm": algorithm,
                        "feature_names": FEATURE_COLUMNS,
                        "best_params": best_params,
                        "background_X": X[-min(200, len(X)) :],
                        "prediction_horizon": horizon,
                    },
                    artifact_path,
                )

                train_duration = round(time.perf_counter() - algo_t0, 2)
                artifact = ModelArtifact(
                    name=artifact_name,
                    algorithm=algorithm,
                    artifact_path=str(artifact_path),
                    best_params=best_params,
                    feature_names=FEATURE_COLUMNS,
                    global_importance=shap_imp,
                    feature_run_id=feature_run_id,
                    training_job_id=job.id,
                    is_active=True,
                    meta={
                        "prediction_horizon": horizon,
                        "train_duration_seconds": train_duration,
                        "feature_count": len(FEATURE_COLUMNS),
                        "inference_ms_estimate": 5.0,
                        "symbols": symbols,
                    },
                )
                await self.training.save_model(artifact)

                for fm in fold_metrics:
                    await self.training.save_metric(
                        ModelMetric(
                            model_id=artifact.id,
                            fold=fm["fold"],
                            accuracy=fm.get("accuracy"),
                            precision=fm.get("precision"),
                            recall=fm.get("recall"),
                            f1=fm.get("f1"),
                            roc_auc=fm.get("roc_auc"),
                            confusion_matrix=fm.get("confusion_matrix"),
                            roc_curve=fm.get("roc_curve"),
                        )
                    )

                await self.training.save_metric(
                    ModelMetric(
                        model_id=artifact.id,
                        fold=-1,
                        accuracy=agg.get("accuracy"),
                        precision=agg.get("precision"),
                        recall=agg.get("recall"),
                        f1=agg.get("f1"),
                        roc_auc=agg.get("roc_auc"),
                        confusion_matrix=agg.get("confusion_matrix"),
                        roc_curve=agg.get("roc_curve"),
                        learning_curve=learning_curve,
                        extra={"train_duration_seconds": train_duration},
                    )
                )
                await self.session.commit()
                logger.info(
                    "Trained %s: agg metrics %s",
                    algorithm,
                    {k: agg.get(k) for k in ("accuracy", "f1", "roc_auc")},
                )

            job.status = "completed"
            job.progress = "Done"
            job.progress_detail = {
                "pct": 100,
                "phase": "done",
                "elapsed_seconds": round(time.perf_counter() - t0, 1),
            }
            job.finished_at = datetime.now(timezone.utc)
            await self.session.commit()
        except Exception as exc:
            logger.exception("Training job %s failed", job_id)
            await self.session.rollback()
            job = await self.training.get_job(job_id)
            if job:
                job.status = "failed"
                job.error_message = str(exc)[:2000]
                job.finished_at = datetime.now(timezone.utc)
                await self.session.commit()

    async def _tune_async(
        self,
        job: TrainingJob,
        algorithm: str,
        X: np.ndarray,
        y: np.ndarray,
        n_trials: int,
        t0: float,
        base_pct: int,
    ) -> dict[str, Any]:
        min_train = self.settings.walk_forward_min_train_days
        if len(X) < min_train + 50:
            return {}

        val_size = min(self.settings.walk_forward_test_days, len(X) // 5)
        train_end = min_train
        X_train, y_train = X[: train_end - val_size], y[: train_end - val_size]
        X_val, y_val = X[train_end - val_size : train_end], y[train_end - val_size : train_end]

        if len(X_train) < 100 or len(np.unique(y_val)) < 2:
            return {}

        study = optuna.create_study(
            direction="maximize", sampler=optuna.samplers.TPESampler(seed=42)
        )
        objective = make_optuna_objective(algorithm, X_train, y_train, X_val, y_val)

        def _callback(study: optuna.Study, trial: optuna.trial.FrozenTrial) -> None:
            # Sync callback — progress updated between trials via optimize loop below
            pass

        for i in range(n_trials):
            study.optimize(objective, n_trials=1, show_progress_bar=False, callbacks=[_callback])
            elapsed = time.perf_counter() - t0
            per_trial = elapsed / max(i + 1, 1)
            remaining_trials = n_trials - (i + 1)
            await self._set_progress(
                job,
                f"Tuning {algorithm} trial {i + 1}/{n_trials}",
                {
                    "pct": base_pct + int(10 * (i + 1) / n_trials),
                    "phase": "optuna",
                    "algorithm": algorithm,
                    "trial": i + 1,
                    "n_trials": n_trials,
                    "elapsed_seconds": round(elapsed, 1),
                    "eta_seconds": round(per_trial * remaining_trials, 1),
                },
            )

        logger.info(
            "Optuna best for %s: %.4f params=%s",
            algorithm,
            study.best_value,
            study.best_params,
        )
        return dict(study.best_params)

    def _learning_curve(
        self,
        algorithm: str,
        params: dict[str, Any],
        X: np.ndarray,
        y: np.ndarray,
        folds: list,
    ) -> dict:
        learning_curve: dict = {"train_sizes": [], "train_scores": [], "val_scores": []}
        if not folds:
            return learning_curve
        first = folds[0]
        X_full, y_full = X[: first.train_end], y[: first.train_end]
        split = int(len(X_full) * 0.8)
        X_tr, y_tr = X_full[:split], y_full[:split]
        X_va, y_va = X_full[split:], y_full[split:]
        for size in iter_learning_curve_sizes(len(X_tr), n_points=5):
            m = build_model(algorithm, params)
            m.fit(X_tr[:size], y_tr[:size])
            tr_acc = float(m.score(X_tr[:size], y_tr[:size]))
            va_acc = float(m.score(X_va, y_va)) if len(X_va) else tr_acc
            learning_curve["train_sizes"].append(size)
            learning_curve["train_scores"].append(tr_acc)
            learning_curve["val_scores"].append(va_acc)
        return learning_curve
