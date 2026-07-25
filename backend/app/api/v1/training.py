"""Training, experiments, and model comparison endpoints."""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import get_db
from app.models import TrainingJob
from app.repositories import TrainingRepository
from app.schemas import (
    ExperimentOut,
    ModelArtifactOut,
    ModelCompareOut,
    ModelMetricOut,
    TrainRequest,
    TrainingJobOut,
)
from app.services.nl_templates import best_model_explanation
from app.services.training_service import TrainingService

router = APIRouter(tags=["training"])


@router.post("/train", response_model=TrainingJobOut)
async def start_training(
    body: TrainRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> TrainingJobOut:
    settings = get_settings()
    config = {
        "symbols": body.symbols or settings.default_symbols_list,
        "feature_run_id": body.feature_run_id,
        "algorithms": body.algorithms,
        "optuna_trials": body.optuna_trials or settings.optuna_trials,
        "prediction_horizon": body.prediction_horizon,
    }
    service = TrainingService(db)
    try:
        job = await service.start_job(config)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    background_tasks.add_task(service.run_job, job.id)
    return TrainingJobOut.model_validate(job)


@router.get("/train/jobs", response_model=list[TrainingJobOut])
async def list_training_jobs(db: AsyncSession = Depends(get_db)) -> list[TrainingJobOut]:
    jobs = await TrainingRepository(db).list_jobs()
    return [TrainingJobOut.model_validate(j) for j in jobs]


@router.get("/train/jobs/{job_id}", response_model=TrainingJobOut)
async def get_training_job(job_id: int, db: AsyncSession = Depends(get_db)) -> TrainingJobOut:
    job = await TrainingRepository(db).get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")
    return TrainingJobOut.model_validate(job)


@router.get("/experiments", response_model=list[ExperimentOut])
async def list_experiments(db: AsyncSession = Depends(get_db)) -> list[ExperimentOut]:
    result = await db.execute(
        select(TrainingJob).order_by(TrainingJob.created_at.desc()).limit(50)
    )
    jobs = list(result.scalars().all())
    models = await TrainingRepository(db).list_models()
    by_job: dict[int, list] = {}
    for m in models:
        if m.training_job_id:
            by_job.setdefault(m.training_job_id, []).append(m)

    out: list[ExperimentOut] = []
    for job in jobs:
        duration = None
        if job.started_at and job.finished_at:
            duration = (job.finished_at - job.started_at).total_seconds()
        out.append(
            ExperimentOut(
                id=job.id,
                status=job.status,
                config=job.config or {},
                progress=job.progress,
                progress_detail=job.progress_detail,
                created_at=job.created_at,
                started_at=job.started_at,
                finished_at=job.finished_at,
                duration_seconds=duration,
                models=[_serialize_model(m) for m in by_job.get(job.id, [])],
            )
        )
    return out


@router.get("/experiments/{job_id}", response_model=ExperimentOut)
async def get_experiment(job_id: int, db: AsyncSession = Depends(get_db)) -> ExperimentOut:
    job = await TrainingRepository(db).get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Experiment not found")
    models = [
        m for m in await TrainingRepository(db).list_models() if m.training_job_id == job_id
    ]
    duration = None
    if job.started_at and job.finished_at:
        duration = (job.finished_at - job.started_at).total_seconds()
    return ExperimentOut(
        id=job.id,
        status=job.status,
        config=job.config or {},
        progress=job.progress,
        progress_detail=job.progress_detail,
        created_at=job.created_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
        duration_seconds=duration,
        models=[_serialize_model(m) for m in models],
    )


@router.get("/models", response_model=list[ModelArtifactOut])
async def list_models(db: AsyncSession = Depends(get_db)) -> list[ModelArtifactOut]:
    models = await TrainingRepository(db).list_models()
    return _rank_models(models)


@router.get("/models/compare", response_model=ModelCompareOut)
async def compare_models(db: AsyncSession = Depends(get_db)) -> ModelCompareOut:
    models = await TrainingRepository(db).list_models()
    ranked = _rank_models(models)
    best_id = ranked[0].id if ranked else None
    explanation = best_model_explanation(
        [
            {
                "algorithm": m.algorithm,
                "roc_auc": next((x.roc_auc for x in m.metrics if x.fold == -1), None),
                "precision": next((x.precision for x in m.metrics if x.fold == -1), None),
                "f1": next((x.f1 for x in m.metrics if x.fold == -1), None),
            }
            for m in ranked
        ]
    )
    return ModelCompareOut(models=ranked, best_model_id=best_id, explanation=explanation)


@router.get("/models/{model_id}", response_model=ModelArtifactOut)
async def get_model(model_id: int, db: AsyncSession = Depends(get_db)) -> ModelArtifactOut:
    model = await TrainingRepository(db).get_model(model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return _serialize_model(model)


@router.get("/models/{model_id}/importance")
async def model_importance(model_id: int, db: AsyncSession = Depends(get_db)) -> dict:
    model = await TrainingRepository(db).get_model(model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return {
        "model_id": model.id,
        "algorithm": model.algorithm,
        "global_importance": model.global_importance or {},
        "best_params": model.best_params or {},
        "meta": model.meta or {},
    }


def _serialize_model(model, rank: int | None = None) -> ModelArtifactOut:
    metrics = [
        ModelMetricOut(
            fold=m.fold,
            accuracy=m.accuracy,
            precision=m.precision,
            recall=m.recall,
            f1=m.f1,
            roc_auc=m.roc_auc,
            confusion_matrix=m.confusion_matrix,
            roc_curve=m.roc_curve,
            learning_curve=m.learning_curve,
            extra=m.extra,
        )
        for m in (model.metrics or [])
    ]
    meta = model.meta or {}
    return ModelArtifactOut(
        id=model.id,
        name=model.name,
        algorithm=model.algorithm,
        best_params=model.best_params,
        feature_names=model.feature_names,
        global_importance=model.global_importance,
        feature_run_id=model.feature_run_id,
        training_job_id=model.training_job_id,
        is_active=model.is_active,
        meta=meta,
        created_at=model.created_at,
        metrics=metrics,
        rank=rank,
        train_duration_seconds=meta.get("train_duration_seconds"),
        prediction_horizon=meta.get("prediction_horizon", 1),
    )


def _rank_models(models) -> list[ModelArtifactOut]:
    scored = []
    for m in models:
        agg = next((x for x in (m.metrics or []) if x.fold == -1), None)
        auc = agg.roc_auc if agg and agg.roc_auc is not None else -1.0
        f1 = agg.f1 if agg and agg.f1 is not None else -1.0
        scored.append((auc, f1, m))
    scored.sort(key=lambda t: (t[0], t[1]), reverse=True)
    return [_serialize_model(m, rank=i + 1) for i, (_, __, m) in enumerate(scored)]
