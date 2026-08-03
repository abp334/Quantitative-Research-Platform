# Architecture

## Overview

Nexus Quant is a modular monorepo for quantitative equity research on NIFTY-50 daily OHLCV data.

```
CSV archive → ETL → PostgreSQL → Feature Engineering → Walk-Forward Training
                                                              ↓
UI (React) ← FastAPI ← Joblib artifacts + SHAP ← Optuna-tuned models
```

## Backend layers

| Layer | Responsibility |
|-------|----------------|
| `api/v1` | HTTP routers, validation, background job dispatch |
| `schemas` | Pydantic request/response models |
| `services` | Business orchestration (ETL, features, training, prediction) |
| `repositories` | SQLAlchemy data access |
| `models` | ORM entities |
| `ml/features` | Manual indicators (no TA-Lib) |
| `ml/training` | Model factories + Optuna spaces |
| `ml/evaluation` | Expanding walk-forward splits & metrics |
| `ml/explainability` | SHAP local/global explanations |

## Target definition

For bar `t`:

```
target = 1 if Close[t+1] > Close[t] else 0
```

Features at `t` use only information available at `t` (lags, rolling windows). The label uses the next close and is never fed into features.

## Validation

Time-series data is never randomly shuffled. Expanding-window walk-forward:

- Minimum train ≈ 3 years (756 sessions)
- Test fold ≈ 6 months (126 sessions)
- Step ≈ 6 months

## Containers

`docker compose` runs:

1. `db` — Postgres 16 with persistent `pgdata` volume  
2. `api` — FastAPI; migrates via Alembic on boot; mounts `archive/` read-only and `modeldata` for artifacts  
3. `frontend` — Nginx serving the Vite build and proxying `/api` to the API  

## Configuration

Environment variables (see `backend/app/core/config.py`):

- `DATABASE_URL` / `DATABASE_URL_SYNC`
- `DATA_DIR`, `MODELS_DIR`
- `OPTUNA_TRIALS`
- `CORS_ORIGINS`
- `DEFAULT_TRAIN_SYMBOLS`
