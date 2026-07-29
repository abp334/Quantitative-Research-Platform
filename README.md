# Nexus — AI Stock Outlook

A user-facing stock intelligence application for NIFTY equities. Users select a stock and
forecast horizon, review its historical price behaviour, and receive a directional outlook.

The analytical pipeline is fully managed by the backend. The public product does not expose
model training, algorithm selection, feature engineering, experiments, or model comparisons.

## Quick start

```bash
docker compose up --build
```

| Surface | URL |
|---|---|
| Web application | http://localhost:3000 |
| Public API | http://localhost:8000/docs |

## User flow

Open app → Select stock → Review price history → Choose horizon → Generate outlook

## Public capabilities

- Browse the available NIFTY stock universe
- Explore candlestick, volume, moving-average, and momentum charts
- Request a 1, 3, or 5-session directional outlook
- View upside probability and signal confidence

## Managed backend

Historical data ingestion, feature preparation, model evaluation/selection, inference, and
explanation generation remain internal. The prediction service automatically chooses the
strongest active model for the requested horizon.

## Disclaimer

Research software only. Predictions are probabilistic and are not investment advice.
