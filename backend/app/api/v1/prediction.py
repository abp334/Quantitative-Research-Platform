"""Prediction and explainability endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas import PredictRequest, PredictionOut
from app.services.prediction_service import PredictionService

router = APIRouter(tags=["prediction"])


@router.post("/predict", response_model=PredictionOut)
async def predict(
    body: PredictRequest,
    db: AsyncSession = Depends(get_db),
) -> PredictionOut:
    service = PredictionService(db)
    try:
        result = await service.predict(
            symbol=body.symbol,
            as_of_date=body.as_of_date,
            prediction_horizon=body.prediction_horizon,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc

    return PredictionOut(
        id=result["id"],
        symbol=result["symbol"],
        as_of_date=result["as_of_date"],
        label=result["label"],
        probability_up=result["probability_up"],
        confidence=result["confidence"],
        prediction_horizon=result.get("prediction_horizon", 1),
        summary_text=result.get("summary_text"),
    )
