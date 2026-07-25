"""Feature engineering service."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.ml.features.indicators import FEATURE_COLUMNS, build_feature_frame
from app.models import FeatureRow
from app.repositories import FeatureRepository, OhlcvRepository, StockRepository

logger = get_logger(__name__)

ALLOWED_HORIZONS = {1, 3, 5}


class FeatureService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.stocks = StockRepository(session)
        self.ohlcv = OhlcvRepository(session)
        self.features = FeatureRepository(session)

    async def generate(
        self,
        name: str = "default",
        symbols: Optional[list[str]] = None,
        prediction_horizon: int = 1,
    ) -> dict[str, Any]:
        if prediction_horizon not in ALLOWED_HORIZONS:
            raise ValueError(f"prediction_horizon must be one of {sorted(ALLOWED_HORIZONS)}")

        all_stocks = await self.stocks.list_stocks()
        if not all_stocks:
            raise ValueError("No stocks in database. Run data import first.")

        if symbols:
            wanted = {s.upper() for s in symbols}
            stocks = [s for s in all_stocks if s.symbol in wanted]
            if not stocks:
                raise ValueError(f"None of the requested symbols found: {symbols}")
        else:
            stocks = list(all_stocks)

        run = await self.features.create_run(
            name=name,
            params={
                "symbols": [s.symbol for s in stocks],
                "feature_columns": FEATURE_COLUMNS,
                "prediction_horizon": prediction_horizon,
            },
        )
        await self.session.commit()

        total_rows = 0
        try:
            for stock in stocks:
                bars = await self.ohlcv.get_bars(stock.id)
                if len(bars) < 60 + prediction_horizon:
                    logger.warning("Skipping %s: insufficient history (%d)", stock.symbol, len(bars))
                    continue

                df = pd.DataFrame(
                    [
                        {
                            "date": b.date,
                            "open": float(b.open),
                            "high": float(b.high),
                            "low": float(b.low),
                            "close": float(b.close),
                            "volume": int(b.volume),
                        }
                        for b in bars
                    ]
                )
                featured = build_feature_frame(df, horizon=prediction_horizon)
                featured = featured.dropna(subset=FEATURE_COLUMNS)

                batch: list[FeatureRow] = []
                for _, row in featured.iterrows():
                    feat_dict = {
                        col: float(row[col]) if pd.notna(row[col]) else None
                        for col in FEATURE_COLUMNS
                    }
                    if any(v is None for v in feat_dict.values()):
                        continue
                    target_val = None
                    if pd.notna(row["target"]):
                        target_val = int(row["target"])
                    batch.append(
                        FeatureRow(
                            feature_run_id=run.id,
                            stock_id=stock.id,
                            date=row["date"],
                            features=feat_dict,
                            target=target_val,
                        )
                    )

                if batch:
                    await self.features.add_feature_rows(batch)
                    total_rows += len(batch)
                    logger.info("Features for %s: %d rows", stock.symbol, len(batch))

            if total_rows <= 0:
                run.status = "failed"
                run.error_message = (
                    "No feature rows produced — selected symbols lack sufficient OHLCV history "
                    "or failed indicator construction."
                )
                run.row_count = 0
                run.symbol_count = len(stocks)
                run.finished_at = datetime.now(timezone.utc)
                await self.session.commit()
                raise ValueError(run.error_message)

            run.status = "completed"
            run.row_count = total_rows
            run.symbol_count = len(stocks)
            run.finished_at = datetime.now(timezone.utc)
            await self.session.commit()
        except Exception as exc:
            run.status = "failed"
            run.error_message = str(exc)
            run.finished_at = datetime.now(timezone.utc)
            await self.session.commit()
            raise

        return {
            "id": run.id,
            "name": run.name,
            "status": run.status,
            "row_count": run.row_count,
            "symbol_count": run.symbol_count,
            "params": run.params,
            "created_at": run.created_at,
            "finished_at": run.finished_at,
        }

    async def ensure_horizon_run(
        self,
        symbols: list[str],
        prediction_horizon: int,
    ) -> int:
        """Return a completed feature_run_id that covers the requested symbols.

        Never reuse empty runs or runs that omit requested tickers (e.g. a tiny
        on-demand infer_* run for one symbol must not hijack full-universe training).
        """
        wanted = {s.upper() for s in symbols if s}
        runs = await self.features.list_runs()
        for run in runs:
            if run.status != "completed":
                continue
            if not run.row_count or int(run.row_count) <= 0:
                continue
            params = run.params or {}
            if int(params.get("prediction_horizon", 1)) != prediction_horizon:
                continue
            covered = {str(s).upper() for s in (params.get("symbols") or [])}
            # Reuse only when every requested symbol is present in that run.
            if wanted and wanted.issubset(covered):
                logger.info(
                    "Reusing feature run #%s (horizon=%s, rows=%s) for %d symbols",
                    run.id,
                    prediction_horizon,
                    run.row_count,
                    len(wanted),
                )
                return run.id

        logger.info(
            "Generating features for horizon=%s covering %d symbols",
            prediction_horizon,
            len(wanted) or "all",
        )
        result = await self.generate(
            name=f"horizon_{prediction_horizon}",
            symbols=symbols or None,
            prediction_horizon=prediction_horizon,
        )
        if int(result.get("row_count") or 0) <= 0:
            raise ValueError(
                "Feature generation produced 0 rows. "
                "Check that selected symbols have enough OHLCV history "
                "(need ~60+ trading days) and try again."
            )
        return int(result["id"])

    async def get_symbol_features(
        self,
        symbol: str,
        feature_run_id: Optional[int] = None,
        limit: int = 500,
    ) -> list[dict[str, Any]]:
        stock = await self.stocks.get_by_symbol(symbol)
        if not stock:
            raise ValueError(f"Stock not found: {symbol}")

        if feature_run_id is None:
            run = await self.features.latest_run()
            if not run:
                raise ValueError("No feature runs available")
            feature_run_id = run.id

        rows = await self.features.get_features_for_symbol(feature_run_id, stock.id, limit=limit)
        return [
            {
                "date": r.date,
                "features": r.features,
                "target": r.target,
                "target_label": (
                    "UP" if r.target == 1 else "DOWN" if r.target == 0 else None
                ),
            }
            for r in rows
        ]
