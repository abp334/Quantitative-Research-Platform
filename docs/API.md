# API Reference

Base path: `/api/v1`

## Core

- `GET /health`
- `GET /dashboard/stats` — enriched KPIs, best model, activity, system status

## Data

- `POST /data/import` — ops/auto-import (hidden from primary UX)
- `GET /data/stocks`
- `GET /data/stocks/{symbol}/ohlcv?start=&end=&limit=`
- `GET /data/stocks/{symbol}/stats`

## Features / Training

- `POST /features/generate` — `{ symbols, prediction_horizon }`
- `POST /train` — `{ symbols, algorithms, optuna_trials, prediction_horizon }`
- `GET /train/jobs`, `GET /train/jobs/{id}` — includes `progress_detail`
- `GET /experiments`, `GET /experiments/{id}`

## Models / Prediction

- `GET /models`, `GET /models/compare` — ranked + NL explanation
- `POST /predict` — `{ symbol, prediction_horizon, auto_select, model_id }`
- `GET /explain/{prediction_id}`

## Research

- `GET /insights`
- `POST /backtest`
- `GET /reports/research.pdf`

Interactive docs: `/docs`
