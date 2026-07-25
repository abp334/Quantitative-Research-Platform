"""Data access repositories."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Optional, Sequence

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    FeatureRow,
    FeatureRun,
    ModelArtifact,
    ModelMetric,
    OhlcvBar,
    Prediction,
    Stock,
    TrainingJob,
)


class StockRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def upsert_stock(
        self,
        symbol: str,
        company_name: Optional[str] = None,
        industry: Optional[str] = None,
        series: Optional[str] = None,
        isin: Optional[str] = None,
    ) -> Stock:
        result = await self.session.execute(select(Stock).where(Stock.symbol == symbol))
        stock = result.scalar_one_or_none()
        if stock is None:
            stock = Stock(
                symbol=symbol,
                company_name=company_name,
                industry=industry,
                series=series,
                isin=isin,
            )
            self.session.add(stock)
            await self.session.flush()
        else:
            if company_name:
                stock.company_name = company_name
            if industry:
                stock.industry = industry
            if series:
                stock.series = series
            if isin:
                stock.isin = isin
        return stock

    async def list_stocks(self) -> Sequence[Stock]:
        result = await self.session.execute(select(Stock).order_by(Stock.symbol))
        return result.scalars().all()

    async def get_by_symbol(self, symbol: str) -> Optional[Stock]:
        result = await self.session.execute(
            select(Stock).where(Stock.symbol == symbol.upper())
        )
        return result.scalar_one_or_none()

    async def count(self) -> int:
        result = await self.session.execute(select(func.count()).select_from(Stock))
        return int(result.scalar_one())

    async def delete_symbols_not_in(self, keep_symbols: set[str]) -> list[str]:
        """Delete stocks whose symbol is not in keep_symbols. Cascades OHLCV/features/predictions."""
        keep = {s.upper() for s in keep_symbols}
        result = await self.session.execute(select(Stock))
        stocks = list(result.scalars().all())
        removed: list[str] = []
        for stock in stocks:
            if stock.symbol.upper() not in keep:
                removed.append(stock.symbol)
                await self.session.delete(stock)
        if removed:
            await self.session.flush()
        return removed


class OhlcvRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def replace_bars_for_stock(self, stock_id: int, rows: list[dict[str, Any]]) -> tuple[int, int]:
        """Delete existing bars for stock and bulk-insert new ones. Returns (inserted, 0)."""
        await self.session.execute(delete(OhlcvBar).where(OhlcvBar.stock_id == stock_id))
        if not rows:
            return 0, 0

        payload = [{**row, "stock_id": stock_id} for row in rows]
        chunk_size = 2000
        inserted = 0
        for i in range(0, len(payload), chunk_size):
            chunk = payload[i : i + chunk_size]
            await self.session.execute(pg_insert(OhlcvBar).values(chunk))
            inserted += len(chunk)
        await self.session.flush()
        return inserted, 0

    async def upsert_bars(self, stock_id: int, rows: list[dict[str, Any]]) -> tuple[int, int]:
        """PostgreSQL ON CONFLICT upsert. Returns approximate (inserted, updated)."""
        if not rows:
            return 0, 0

        existing = await self.session.execute(
            select(func.count()).select_from(OhlcvBar).where(OhlcvBar.stock_id == stock_id)
        )
        before = int(existing.scalar_one())

        payload = [{**row, "stock_id": stock_id} for row in rows]
        chunk_size = 2000
        for i in range(0, len(payload), chunk_size):
            chunk = payload[i : i + chunk_size]
            stmt = pg_insert(OhlcvBar).values(chunk)
            update_cols = {
                c.name: stmt.excluded[c.name]
                for c in OhlcvBar.__table__.columns
                if c.name not in ("id", "stock_id", "date")
            }
            stmt = stmt.on_conflict_do_update(
                constraint="uq_ohlcv_stock_date",
                set_=update_cols,
            )
            await self.session.execute(stmt)

        await self.session.flush()
        after_result = await self.session.execute(
            select(func.count()).select_from(OhlcvBar).where(OhlcvBar.stock_id == stock_id)
        )
        after = int(after_result.scalar_one())
        inserted = max(0, after - before)
        updated = max(0, len(rows) - inserted)
        return inserted, updated

    async def get_bars(
        self,
        stock_id: int,
        start: Optional[date] = None,
        end: Optional[date] = None,
        limit: Optional[int] = None,
    ) -> Sequence[OhlcvBar]:
        if limit and not start and not end:
            stmt = (
                select(OhlcvBar)
                .where(OhlcvBar.stock_id == stock_id)
                .order_by(OhlcvBar.date.desc())
                .limit(limit)
            )
            result = await self.session.execute(stmt)
            rows = list(result.scalars().all())
            rows.reverse()
            return rows

        stmt = select(OhlcvBar).where(OhlcvBar.stock_id == stock_id)
        if start:
            stmt = stmt.where(OhlcvBar.date >= start)
        if end:
            stmt = stmt.where(OhlcvBar.date <= end)
        stmt = stmt.order_by(OhlcvBar.date.asc())
        if limit:
            stmt = stmt.limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count(self) -> int:
        result = await self.session.execute(select(func.count()).select_from(OhlcvBar))
        return int(result.scalar_one())

    async def delete_all(self) -> None:
        await self.session.execute(delete(OhlcvBar))


class FeatureRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_run(self, name: str, params: Optional[dict] = None) -> FeatureRun:
        run = FeatureRun(name=name, status="running", params=params or {})
        self.session.add(run)
        await self.session.flush()
        return run

    async def get_run(self, run_id: int) -> Optional[FeatureRun]:
        result = await self.session.execute(select(FeatureRun).where(FeatureRun.id == run_id))
        return result.scalar_one_or_none()

    async def latest_run(self) -> Optional[FeatureRun]:
        result = await self.session.execute(
            select(FeatureRun).order_by(FeatureRun.created_at.desc()).limit(1)
        )
        return result.scalar_one_or_none()

    async def list_runs(self) -> Sequence[FeatureRun]:
        result = await self.session.execute(
            select(FeatureRun).order_by(FeatureRun.created_at.desc())
        )
        return result.scalars().all()

    async def add_feature_rows(self, rows: list[FeatureRow]) -> None:
        self.session.add_all(rows)
        await self.session.flush()

    async def get_features_for_symbol(
        self,
        feature_run_id: int,
        stock_id: int,
        limit: Optional[int] = None,
    ) -> Sequence[FeatureRow]:
        if limit:
            # Fetch latest N rows, then return chronological order
            stmt = (
                select(FeatureRow)
                .where(
                    FeatureRow.feature_run_id == feature_run_id,
                    FeatureRow.stock_id == stock_id,
                )
                .order_by(FeatureRow.date.desc())
                .limit(limit)
            )
            result = await self.session.execute(stmt)
            rows = list(result.scalars().all())
            rows.reverse()
            return rows

        stmt = (
            select(FeatureRow)
            .where(
                FeatureRow.feature_run_id == feature_run_id,
                FeatureRow.stock_id == stock_id,
            )
            .order_by(FeatureRow.date.asc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_training_frame(
        self,
        feature_run_id: int,
        stock_ids: Optional[list[int]] = None,
    ) -> Sequence[FeatureRow]:
        stmt = (
            select(FeatureRow)
            .where(
                FeatureRow.feature_run_id == feature_run_id,
                FeatureRow.target.is_not(None),
            )
            .order_by(FeatureRow.date.asc())
        )
        if stock_ids:
            stmt = stmt.where(FeatureRow.stock_id.in_(stock_ids))
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_runs(self) -> int:
        result = await self.session.execute(select(func.count()).select_from(FeatureRun))
        return int(result.scalar_one())


class TrainingRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_job(self, config: dict[str, Any], feature_run_id: Optional[int]) -> TrainingJob:
        job = TrainingJob(status="pending", config=config, feature_run_id=feature_run_id)
        self.session.add(job)
        await self.session.flush()
        return job

    async def get_job(self, job_id: int) -> Optional[TrainingJob]:
        result = await self.session.execute(
            select(TrainingJob).where(TrainingJob.id == job_id)
        )
        return result.scalar_one_or_none()

    async def latest_job(self) -> Optional[TrainingJob]:
        result = await self.session.execute(
            select(TrainingJob).order_by(TrainingJob.created_at.desc()).limit(1)
        )
        return result.scalar_one_or_none()

    async def list_jobs(self, limit: int = 50) -> Sequence[TrainingJob]:
        result = await self.session.execute(
            select(TrainingJob).order_by(TrainingJob.created_at.desc()).limit(limit)
        )
        return result.scalars().all()

    async def fail_orphaned_jobs(
        self,
        reason: str = "Interrupted — API process restarted before the job finished",
    ) -> list[int]:
        """Mark pending/running jobs as failed (in-process workers do not survive restarts)."""
        result = await self.session.execute(
            select(TrainingJob).where(TrainingJob.status.in_(("pending", "running")))
        )
        jobs = list(result.scalars().all())
        now = datetime.now(timezone.utc)
        ids: list[int] = []
        for job in jobs:
            job.status = "failed"
            job.error_message = reason
            job.finished_at = now
            job.progress = job.progress or "Interrupted"
            ids.append(job.id)
        if ids:
            await self.session.flush()
        return ids

    async def list_models(self) -> Sequence[ModelArtifact]:
        result = await self.session.execute(
            select(ModelArtifact)
            .options(selectinload(ModelArtifact.metrics))
            .order_by(ModelArtifact.created_at.desc())
        )
        return result.scalars().all()

    async def get_model(self, model_id: int) -> Optional[ModelArtifact]:
        result = await self.session.execute(
            select(ModelArtifact)
            .options(selectinload(ModelArtifact.metrics))
            .where(ModelArtifact.id == model_id)
        )
        return result.scalar_one_or_none()

    async def get_active_model(self, algorithm: Optional[str] = None) -> Optional[ModelArtifact]:
        stmt = (
            select(ModelArtifact)
            .options(selectinload(ModelArtifact.metrics))
            .where(ModelArtifact.is_active.is_(True))
            .order_by(ModelArtifact.created_at.desc())
        )
        if algorithm:
            stmt = stmt.where(ModelArtifact.algorithm == algorithm)
        result = await self.session.execute(stmt.limit(1))
        return result.scalar_one_or_none()

    async def save_model(self, artifact: ModelArtifact) -> ModelArtifact:
        self.session.add(artifact)
        await self.session.flush()
        return artifact

    async def save_metric(self, metric: ModelMetric) -> ModelMetric:
        self.session.add(metric)
        await self.session.flush()
        return metric

    async def count_models(self) -> int:
        result = await self.session.execute(select(func.count()).select_from(ModelArtifact))
        return int(result.scalar_one())


class PredictionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def save(self, prediction: Prediction) -> Prediction:
        self.session.add(prediction)
        await self.session.flush()
        return prediction

    async def get(self, prediction_id: int) -> Optional[Prediction]:
        result = await self.session.execute(
            select(Prediction)
            .options(selectinload(Prediction.stock), selectinload(Prediction.model))
            .where(Prediction.id == prediction_id)
        )
        return result.scalar_one_or_none()

    async def count(self) -> int:
        result = await self.session.execute(select(func.count()).select_from(Prediction))
        return int(result.scalar_one())
