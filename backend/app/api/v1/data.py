"""Data import and OHLCV exploration endpoints."""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.repositories import OhlcvRepository, StockRepository
from app.schemas import DatasetStatsOut, OhlcvBarOut, StockOut
import numpy as np

router = APIRouter(prefix="/data", tags=["data"])


@router.get("/stocks", response_model=list[StockOut])
async def list_stocks(db: AsyncSession = Depends(get_db)) -> list[StockOut]:
    stocks = await StockRepository(db).list_stocks()
    return [StockOut.model_validate(s) for s in stocks]


@router.get("/stocks/{symbol}", response_model=StockOut)
async def get_stock(symbol: str, db: AsyncSession = Depends(get_db)) -> StockOut:
    stock = await StockRepository(db).get_by_symbol(symbol)
    if not stock:
        raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")
    return StockOut.model_validate(stock)


@router.get("/stocks/{symbol}/ohlcv", response_model=list[OhlcvBarOut])
async def get_ohlcv(
    symbol: str,
    start: Optional[date] = Query(None),
    end: Optional[date] = Query(None),
    limit: Optional[int] = Query(None, ge=1, le=10000),
    db: AsyncSession = Depends(get_db),
) -> list[OhlcvBarOut]:
    stock = await StockRepository(db).get_by_symbol(symbol)
    if not stock:
        raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")
    bars = await OhlcvRepository(db).get_bars(stock.id, start=start, end=end, limit=limit)
    return [
        OhlcvBarOut(
            date=b.date,
            open=float(b.open),
            high=float(b.high),
            low=float(b.low),
            close=float(b.close),
            volume=int(b.volume),
            vwap=float(b.vwap) if b.vwap is not None else None,
            prev_close=float(b.prev_close) if b.prev_close is not None else None,
            turnover=float(b.turnover) if b.turnover is not None else None,
            trades=int(b.trades) if b.trades is not None else None,
            deliverable_volume=int(b.deliverable_volume) if b.deliverable_volume is not None else None,
            pct_deliverable=float(b.pct_deliverable) if b.pct_deliverable is not None else None,
        )
        for b in bars
    ]


@router.get("/stocks/{symbol}/stats", response_model=DatasetStatsOut)
async def get_stock_stats(
    symbol: str,
    start: Optional[date] = Query(None),
    end: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> DatasetStatsOut:
    stock = await StockRepository(db).get_by_symbol(symbol)
    if not stock:
        raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")
    bars = await OhlcvRepository(db).get_bars(stock.id, start=start, end=end)
    if not bars:
        return DatasetStatsOut(symbol=symbol, row_count=0)

    closes = np.array([float(b.close) for b in bars], dtype=float)
    volumes = np.array([float(b.volume) for b in bars], dtype=float)
    rets = np.diff(closes) / closes[:-1]
    rets = rets[np.isfinite(rets)]
    # Simple outlier count: |z| > 3 on returns
    outlier_count = 0
    if len(rets) > 10 and np.std(rets) > 0:
        z = (rets - np.mean(rets)) / np.std(rets)
        outlier_count = int(np.sum(np.abs(z) > 3))

    return DatasetStatsOut(
        symbol=symbol,
        row_count=len(bars),
        start_date=bars[0].date,
        end_date=bars[-1].date,
        missing_ohlc=0,
        outlier_count=outlier_count,
        mean_close=float(np.mean(closes)),
        std_close=float(np.std(closes)),
        mean_volume=float(np.mean(volumes)),
        mean_daily_return=float(np.mean(rets)) if len(rets) else None,
        volatility_ann=float(np.std(rets) * np.sqrt(252)) if len(rets) else None,
    )
