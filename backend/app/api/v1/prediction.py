"""Prediction and explainability endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas import ExplainOut, PredictRequest, PredictionOut, ShapContribution
from app.services.prediction_service import PredictionService

router = APIRouter(tags=["prediction"])


def _contribs(items: list) -> list[ShapContribution]:
    return [ShapContribution(**c) for c in items]


@router.post("/predict", response_model=PredictionOut)
async def predict(
    body: PredictRequest,
    db: AsyncSession = Depends(get_db),
) -> PredictionOut:
    service = PredictionService(db)
    try:
        result = await service.predict(
            symbol=body.symbol,
            model_id=body.model_id,
            as_of_date=body.as_of_date,
            prediction_horizon=body.prediction_horizon,
            auto_select=body.auto_select,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc

    return PredictionOut(
        id=result["id"],
        model_id=result["model_id"],
        model_algorithm=result.get("model_algorithm"),
        symbol=result["symbol"],
        as_of_date=result["as_of_date"],
        label=result["label"],
        probability_up=result["probability_up"],
        confidence=result["confidence"],
        prediction_horizon=result.get("prediction_horizon", 1),
        summary_text=result.get("summary_text"),
        narrative=result.get("narrative"),
        top_features=_contribs(result["top_features"]),
        positive_contributions=_contribs(result["positive_contributions"]),
        negative_contributions=_contribs(result["negative_contributions"]),
        waterfall=_contribs(result.get("waterfall", [])),
    )


@router.get("/explain/{prediction_id}", response_model=ExplainOut)
async def explain(prediction_id: int, db: AsyncSession = Depends(get_db)) -> ExplainOut:
    service = PredictionService(db)
    try:
        result = await service.explain(prediction_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return ExplainOut(
        prediction_id=result["prediction_id"],
        symbol=result["symbol"],
        label=result["label"],
        probability_up=result["probability_up"],
        confidence=result["confidence"],
        prediction_horizon=result.get("prediction_horizon", 1),
        summary_text=result.get("summary_text"),
        narrative=result.get("narrative"),
        top_features=_contribs(result["top_features"]),
        positive_contributions=_contribs(result["positive_contributions"]),
        negative_contributions=_contribs(result["negative_contributions"]),
        waterfall=_contribs(result.get("waterfall", [])),
        global_importance=result.get("global_importance"),
    )
