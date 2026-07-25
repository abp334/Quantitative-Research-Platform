"""CSV schema validation and cleaning utilities for the ETL pipeline."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

REQUIRED_COLUMNS = {
    "date",
    "symbol",
    "open",
    "high",
    "low",
    "close",
    "volume",
}

COLUMN_MAP: dict[str, str] = {
    "date": "date",
    "symbol": "symbol",
    "series": "series",
    "prev close": "prev_close",
    "prev_close": "prev_close",
    "open": "open",
    "high": "high",
    "low": "low",
    "last": "last",
    "close": "close",
    "vwap": "vwap",
    "volume": "volume",
    "turnover": "turnover",
    "trades": "trades",
    "deliverable volume": "deliverable_volume",
    "deliverable_volume": "deliverable_volume",
    "%deliverble": "pct_deliverable",
    "%deliverable": "pct_deliverable",
    "pct_deliverable": "pct_deliverable",
}


def normalize_column_names(columns: list[str]) -> list[str]:
    """Normalize raw CSV headers to snake_case canonical names."""
    normalized: list[str] = []
    for col in columns:
        key = col.strip().lower()
        normalized.append(COLUMN_MAP.get(key, key.replace(" ", "_")))
    return normalized


def validate_schema(df: pd.DataFrame) -> None:
    """Raise ValueError if required columns are missing."""
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")


def clean_ohlcv_frame(df: pd.DataFrame) -> pd.DataFrame:
    """
    Clean and validate an OHLCV dataframe.

    - Normalize columns
    - Parse dates
    - Drop exact duplicates
    - Coerce numerics
    - Forward-fill limited OHLC gaps
    - Drop rows still missing critical fields
    """
    out = df.copy()
    out.columns = normalize_column_names(list(out.columns))
    validate_schema(out)

    out["date"] = pd.to_datetime(out["date"], errors="coerce").dt.date
    out["symbol"] = out["symbol"].astype(str).str.strip().str.upper()

    numeric_cols = [
        "prev_close",
        "open",
        "high",
        "low",
        "last",
        "close",
        "vwap",
        "volume",
        "turnover",
        "trades",
        "deliverable_volume",
        "pct_deliverable",
    ]
    for col in numeric_cols:
        if col in out.columns:
            out[col] = pd.to_numeric(out[col], errors="coerce")

    out = out.dropna(subset=["date", "symbol"])
    out = out.drop_duplicates(subset=["symbol", "date"], keep="last")
    out = out.sort_values(["symbol", "date"]).reset_index(drop=True)

    ohlc = ["open", "high", "low", "close"]
    out[ohlc] = out.groupby("symbol", group_keys=False)[ohlc].apply(
        lambda g: g.ffill(limit=2)
    )

    out = out.dropna(subset=ohlc)
    out["volume"] = out["volume"].fillna(0).astype(np.int64)

    out = out[out["high"] >= out["low"]]
    out = out[(out["high"] >= out["close"]) & (out["low"] <= out["close"])]

    return out.reset_index(drop=True)


def load_metadata(path: str) -> dict[str, dict[str, Any]]:
    """Load stock_metadata.csv keyed by symbol."""
    meta = pd.read_csv(path)
    meta.columns = [c.strip().lower().replace(" ", "_") for c in meta.columns]
    rename = {
        "company_name": "company_name",
        "industry": "industry",
        "symbol": "symbol",
        "series": "series",
        "isin_code": "isin",
    }
    meta = meta.rename(columns={k: v for k, v in rename.items() if k in meta.columns})
    meta["symbol"] = meta["symbol"].astype(str).str.strip().str.upper()
    result: dict[str, dict[str, Any]] = {}
    for _, row in meta.iterrows():
        result[row["symbol"]] = {
            "company_name": row.get("company_name"),
            "industry": row.get("industry"),
            "series": row.get("series"),
            "isin": row.get("isin"),
        }
    return result
