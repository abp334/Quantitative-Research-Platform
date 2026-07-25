"""Unit tests for ETL cleaning utilities."""

from __future__ import annotations

import pandas as pd
import pytest

from app.services.etl_clean import clean_ohlcv_frame, normalize_column_names, validate_schema


def test_normalize_column_names() -> None:
    cols = normalize_column_names(
        ["Date", "Symbol", "Prev Close", "%Deliverble", "Deliverable Volume"]
    )
    assert cols == ["date", "symbol", "prev_close", "pct_deliverable", "deliverable_volume"]


def test_validate_schema_missing() -> None:
    df = pd.DataFrame({"date": [], "symbol": [], "open": []})
    with pytest.raises(ValueError, match="Missing required"):
        validate_schema(df)


def test_clean_ohlcv_frame_dedupe_and_types() -> None:
    df = pd.DataFrame(
        [
            {
                "Date": "2020-01-01",
                "Symbol": "rel",
                "Series": "EQ",
                "Prev Close": 100,
                "Open": 101,
                "High": 105,
                "Low": 100,
                "Last": 104,
                "Close": 104,
                "VWAP": 103,
                "Volume": 1000,
                "Turnover": 1e5,
                "Trades": 10,
                "Deliverable Volume": 500,
                "%Deliverble": 0.5,
            },
            {
                "Date": "2020-01-01",
                "Symbol": "REL",
                "Series": "EQ",
                "Prev Close": 100,
                "Open": 102,
                "High": 106,
                "Low": 101,
                "Last": 105,
                "Close": 105,
                "VWAP": 104,
                "Volume": 1100,
                "Turnover": 1.1e5,
                "Trades": 12,
                "Deliverable Volume": 550,
                "%Deliverble": 0.5,
            },
            {
                "Date": "2020-01-02",
                "Symbol": "REL",
                "Series": "EQ",
                "Prev Close": 105,
                "Open": 106,
                "High": 110,
                "Low": 105,
                "Last": 108,
                "Close": 108,
                "VWAP": 107,
                "Volume": 2000,
                "Turnover": 2e5,
                "Trades": 20,
                "Deliverable Volume": 900,
                "%Deliverble": 0.45,
            },
        ]
    )
    cleaned = clean_ohlcv_frame(df)
    assert len(cleaned) == 2
    assert cleaned.iloc[0]["symbol"] == "REL"
    assert cleaned.iloc[0]["close"] == 105  # last duplicate kept
    assert cleaned.iloc[1]["close"] == 108


def test_clean_rejects_invalid_high_low() -> None:
    df = pd.DataFrame(
        [
            {
                "Date": "2020-01-01",
                "Symbol": "TCS",
                "Open": 100,
                "High": 90,
                "Low": 95,
                "Close": 92,
                "Volume": 100,
            }
        ]
    )
    cleaned = clean_ohlcv_frame(df)
    assert cleaned.empty
