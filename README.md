# Nexus Quant — Explainable Quantitative Research Platform

Enterprise-grade classical ML research system for NIFTY-50 equities.

**Not a stock tip app.** Predictions are always paired with walk-forward metrics and SHAP explanations.

## Quick start

```bash
docker compose up --build
```

| Surface | URL |
|---------|-----|
| Landing | http://localhost:3000 |
| Research console | http://localhost:3000/app |
| API docs | http://localhost:8000/docs |

## User flow

Landing → Dashboard → Data Explorer → Train → Compare → Predict → Explain → Insights → Experiments → Backtest → PDF Report

The dataset auto-imports on first API boot if the database is empty. Users never upload CSVs.

## Stack

FastAPI · PostgreSQL · Scikit-Learn · XGBoost · Optuna · SHAP · React · Recharts · ReportLab · Docker

## Horizons

Train/predict for horizons `{1, 3, 5}` trading days. Target = `Close[t+h] > Close[t]`.

## Tests

```bash
cd backend && source .venv/bin/activate && PYTHONPATH=. pytest -q
```

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [API](docs/API.md)

## Disclaimer

Research software only. Not investment advice.
