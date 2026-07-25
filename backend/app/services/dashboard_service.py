"""Enriched dashboard aggregation service."""

from __future__ import annotations

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import ModelArtifact, ModelMetric, Prediction
from app.repositories import (
    FeatureRepository,
    OhlcvRepository,
    PredictionRepository,
    StockRepository,
    TrainingRepository,
)
from app.schemas import (
    ActivityItem,
    DashboardStats,
    FeatureRunOut,
    ModelArtifactOut,
    ModelMetricOut,
    TrainingJobOut,
)


class DashboardService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.stocks = StockRepository(session)
        self.ohlcv = OhlcvRepository(session)
        self.features = FeatureRepository(session)
        self.training = TrainingRepository(session)
        self.predictions = PredictionRepository(session)

    async def stats(self) -> DashboardStats:
        models = await self.training.list_models()
        ranked = []
        accuracies: list[float] = []
        for m in models:
            agg = next((x for x in (m.metrics or []) if x.fold == -1), None)
            if agg and agg.accuracy is not None:
                accuracies.append(agg.accuracy)
            auc = agg.roc_auc if agg and agg.roc_auc is not None else -1.0
            f1 = agg.f1 if agg and agg.f1 is not None else -1.0
            ranked.append((auc, f1, m, agg))
        ranked.sort(key=lambda t: (t[0], t[1]), reverse=True)

        best_out = None
        if ranked and ranked[0][0] >= 0:
            m, agg = ranked[0][2], ranked[0][3]
            best_out = _model_out(m, agg, rank=1)

        latest_run = await self.features.latest_run()
        latest_job = await self.training.latest_job()

        latest_pred = None
        result = await self.session.execute(
            select(Prediction)
            .options(selectinload(Prediction.stock), selectinload(Prediction.model))
            .order_by(desc(Prediction.created_at))
            .limit(1)
        )
        pred = result.scalar_one_or_none()
        if pred:
            latest_pred = {
                "id": pred.id,
                "symbol": pred.stock.symbol if pred.stock else None,
                "label": pred.label,
                "probability_up": pred.probability_up,
                "confidence": pred.confidence,
                "as_of_date": str(pred.as_of_date),
                "created_at": pred.created_at.isoformat() if pred.created_at else None,
                "summary_text": pred.summary_text,
            }

        activity: list[ActivityItem] = []
        if latest_job:
            activity.append(
                ActivityItem(
                    kind="training",
                    message=f"Training job #{latest_job.id} — {latest_job.status}",
                    created_at=latest_job.created_at,
                    ref_id=latest_job.id,
                )
            )
        if latest_run:
            activity.append(
                ActivityItem(
                    kind="features",
                    message=f"Feature run #{latest_run.id} — {latest_run.row_count} rows",
                    created_at=latest_run.created_at,
                    ref_id=latest_run.id,
                )
            )
        if pred:
            activity.append(
                ActivityItem(
                    kind="prediction",
                    message=f"Predicted {latest_pred['symbol']} → {pred.label}",
                    created_at=pred.created_at,
                    ref_id=pred.id,
                )
            )

        stock_count = await self.stocks.count()
        return DashboardStats(
            stock_count=stock_count,
            bar_count=await self.ohlcv.count(),
            feature_run_count=await self.features.count_runs(),
            model_count=await self.training.count_models(),
            prediction_count=await self.predictions.count(),
            average_accuracy=(sum(accuracies) / len(accuracies)) if accuracies else None,
            best_model=best_out,
            latest_feature_run=FeatureRunOut.model_validate(latest_run) if latest_run else None,
            latest_training_job=TrainingJobOut.model_validate(latest_job) if latest_job else None,
            latest_prediction=latest_pred,
            recent_activity=activity,
            system_status="ok" if stock_count > 0 else "awaiting_data",
        )


def _model_out(m: ModelArtifact, agg: ModelMetric | None, rank: int | None = None) -> ModelArtifactOut:
    metrics = [
        ModelMetricOut(
            fold=x.fold,
            accuracy=x.accuracy,
            precision=x.precision,
            recall=x.recall,
            f1=x.f1,
            roc_auc=x.roc_auc,
            confusion_matrix=x.confusion_matrix,
            roc_curve=x.roc_curve,
            learning_curve=x.learning_curve,
            extra=x.extra,
        )
        for x in (m.metrics or [])
    ]
    meta = m.meta or {}
    return ModelArtifactOut(
        id=m.id,
        name=m.name,
        algorithm=m.algorithm,
        best_params=m.best_params,
        feature_names=m.feature_names,
        global_importance=m.global_importance,
        feature_run_id=m.feature_run_id,
        training_job_id=m.training_job_id,
        is_active=m.is_active,
        meta=meta,
        created_at=m.created_at,
        metrics=metrics,
        rank=rank,
        train_duration_seconds=meta.get("train_duration_seconds"),
        prediction_horizon=meta.get("prediction_horizon", 1),
    )
