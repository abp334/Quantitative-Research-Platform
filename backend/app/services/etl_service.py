"""ETL service: discover, clean, and load NIFTY-50 CSV data into PostgreSQL."""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.logging import get_logger
from app.models import Stock
from app.repositories import OhlcvRepository, StockRepository
from app.services.etl_clean import clean_ohlcv_frame, load_metadata

logger = get_logger(__name__)

EXCLUDE_FILES = {"nifty50_all.csv", "stock_metadata.csv"}


class EtlService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.stocks = StockRepository(session)
        self.ohlcv = OhlcvRepository(session)
        self.settings = get_settings()

    def discover_csv_files(self, data_dir: Path | None = None) -> list[Path]:
        root = data_dir or self.settings.data_dir
        if not root.exists():
            raise FileNotFoundError(f"Data directory not found: {root}")
        files = sorted(
            p
            for p in root.glob("*.csv")
            if p.name.lower() not in EXCLUDE_FILES
        )
        logger.info("Discovered %d CSV files in %s", len(files), root)
        return files

    async def import_dataset(self, force: bool = False) -> dict[str, Any]:
        start = time.perf_counter()
        data_dir = self.settings.data_dir
        files = self.discover_csv_files(data_dir)

        meta_path = data_dir / "stock_metadata.csv"
        metadata: dict[str, dict[str, Any]] = {}
        if meta_path.exists():
            metadata = load_metadata(str(meta_path))

        if force:
            logger.warning("Force re-import: clearing existing OHLCV bars and stocks")
            await self.ohlcv.delete_all()
            await self.session.execute(delete(Stock))
            await self.session.commit()

        stocks_upserted = 0
        bars_inserted = 0
        bars_updated = 0
        canonical_symbols: set[str] = set()

        for path in files:
            try:
                raw = pd.read_csv(path)
                cleaned = clean_ohlcv_frame(raw)
                if cleaned.empty:
                    logger.warning("No valid rows in %s — skipping (not added to universe)", path.name)
                    continue

                # Prefer filename stem as canonical ticker (e.g. INFY.csv may contain INFOSYSTCH)
                file_symbol = path.stem.strip().upper()
                cleaned["symbol"] = file_symbol
                symbol = file_symbol
                canonical_symbols.add(symbol)
                meta = metadata.get(symbol, {})
                # Also try CSV-native symbol for metadata fallback
                if not meta:
                    csv_symbol = str(raw.get("Symbol", pd.Series([symbol])).iloc[0]).strip().upper()
                    meta = metadata.get(csv_symbol, {})
                stock = await self.stocks.upsert_stock(
                    symbol=symbol,
                    company_name=meta.get("company_name"),
                    industry=meta.get("industry"),
                    series=meta.get("series") or (
                        str(cleaned["series"].iloc[0]) if "series" in cleaned.columns else None
                    ),
                    isin=meta.get("isin"),
                )
                stocks_upserted += 1

                rows: list[dict[str, Any]] = []
                for _, r in cleaned.iterrows():
                    rows.append(
                        {
                            "date": r["date"],
                            "prev_close": _opt_float(r.get("prev_close")),
                            "open": float(r["open"]),
                            "high": float(r["high"]),
                            "low": float(r["low"]),
                            "last": _opt_float(r.get("last")),
                            "close": float(r["close"]),
                            "vwap": _opt_float(r.get("vwap")),
                            "volume": int(r["volume"]),
                            "turnover": _opt_float(r.get("turnover")),
                            "trades": _opt_int(r.get("trades")),
                            "deliverable_volume": _opt_int(r.get("deliverable_volume")),
                            "pct_deliverable": _opt_float(r.get("pct_deliverable")),
                        }
                    )

                if force:
                    ins, upd = await self.ohlcv.replace_bars_for_stock(stock.id, rows)
                else:
                    ins, upd = await self.ohlcv.upsert_bars(stock.id, rows)
                bars_inserted += ins
                bars_updated += upd

                logger.info(
                    "Imported %s: %d rows (ins=%d upd=%d)",
                    symbol,
                    len(rows),
                    ins,
                    upd,
                )
            except Exception:
                logger.exception("Failed importing %s", path.name)
                raise

        # Drop renamed/legacy tickers left from older imports (INFOSYSTCH, HINDALC0, …)
        pruned: list[str] = []
        if canonical_symbols:
            pruned = await self.stocks.delete_symbols_not_in(canonical_symbols)
            if pruned:
                logger.warning(
                    "Pruned %d legacy ticker(s) not in archive filenames: %s",
                    len(pruned),
                    ", ".join(sorted(pruned)),
                )

        await self.session.commit()
        duration = time.perf_counter() - start
        result = {
            "stocks_upserted": stocks_upserted,
            "bars_inserted": bars_inserted,
            "bars_updated": bars_updated,
            "files_processed": len(files),
            "legacy_tickers_removed": pruned,
            "duration_seconds": round(duration, 2),
        }
        logger.info("ETL complete: %s", result)
        return result


def _opt_float(value: Any) -> float | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _opt_int(value: Any) -> int | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None
