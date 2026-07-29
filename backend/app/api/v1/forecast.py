"""User-facing multi-horizon forecast and opportunity scanner endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas import ForecastOut, ForecastRequest, ScannerItemOut
from app.services.forecast_service import FORECAST_DAYS, ForecastService

router = APIRouter(tags=["market intelligence"])


@router.post("/forecast", response_model=ForecastOut)
async def forecast(
    body: ForecastRequest,
    db: AsyncSession = Depends(get_db),
) -> ForecastOut:
    try:
        result = await ForecastService(db).forecast(body.symbol, body.horizon_days)
        return ForecastOut.model_validate(result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Forecast failed: {exc}") from exc


@router.get("/market/scanner", response_model=list[ScannerItemOut])
async def market_scanner(
    horizon: int = Query(default=5),
    limit: int = Query(default=50, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> list[ScannerItemOut]:
    if horizon not in FORECAST_DAYS:
        raise HTTPException(status_code=400, detail=f"horizon must be one of {list(FORECAST_DAYS)}")
    try:
        rows = await ForecastService(db).scanner(horizon=horizon, limit=limit)
        return [ScannerItemOut.model_validate(row) for row in rows]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Scanner failed: {exc}") from exc
