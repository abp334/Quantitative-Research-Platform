"""Research insights, backtesting, and PDF report endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas import BacktestOut, BacktestRequest, InsightsOut
from app.services.backtest_service import BacktestService
from app.services.insights_service import InsightsService
from app.services.report_service import ReportService

router = APIRouter(tags=["research"])


@router.get("/insights", response_model=InsightsOut)
async def get_insights(db: AsyncSession = Depends(get_db)) -> InsightsOut:
    return await InsightsService(db).build()


@router.post("/backtest", response_model=BacktestOut)
async def run_backtest(
    body: BacktestRequest,
    db: AsyncSession = Depends(get_db),
) -> BacktestOut:
    try:
        result = await BacktestService(db).run(
            symbol=body.symbol,
            model_id=body.model_id,
            confidence_threshold=body.confidence_threshold,
            start_date=body.start_date,
            end_date=body.end_date,
            prediction_horizon=body.prediction_horizon,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Backtest failed: {exc}") from exc
    return BacktestOut(**result)


@router.get("/reports/research.pdf")
async def download_research_report(db: AsyncSession = Depends(get_db)) -> Response:
    try:
        pdf = await ReportService(db).build_pdf()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {exc}") from exc
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=nexus_quant_research_report.pdf"},
    )
