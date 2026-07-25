"""Feature engineering endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.repositories import FeatureRepository
from app.schemas import FeatureGenerateRequest, FeatureRowOut, FeatureRunOut
from app.services.feature_service import FeatureService

router = APIRouter(prefix="/features", tags=["features"])


@router.post("/generate", response_model=FeatureRunOut)
async def generate_features(
    body: FeatureGenerateRequest,
    db: AsyncSession = Depends(get_db),
) -> FeatureRunOut:
    service = FeatureService(db)
    try:
        result = await service.generate(
            name=body.name,
            symbols=body.symbols,
            prediction_horizon=body.prediction_horizon,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Feature generation failed: {exc}") from exc
    return FeatureRunOut(**result)


@router.get("/runs", response_model=list[FeatureRunOut])
async def list_feature_runs(db: AsyncSession = Depends(get_db)) -> list[FeatureRunOut]:
    runs = await FeatureRepository(db).list_runs()
    return [FeatureRunOut.model_validate(r) for r in runs]


@router.get("/runs/{run_id}", response_model=FeatureRunOut)
async def get_feature_run(run_id: int, db: AsyncSession = Depends(get_db)) -> FeatureRunOut:
    run = await FeatureRepository(db).get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Feature run not found")
    return FeatureRunOut.model_validate(run)


@router.get("/{symbol}", response_model=list[FeatureRowOut])
async def get_symbol_features(
    symbol: str,
    feature_run_id: Optional[int] = Query(None),
    limit: int = Query(500, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
) -> list[FeatureRowOut]:
    service = FeatureService(db)
    try:
        rows = await service.get_symbol_features(symbol, feature_run_id, limit)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return [FeatureRowOut(**r) for r in rows]
