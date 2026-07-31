# Nexus — AI Stock Outlook

A user-facing stock intelligence application for NIFTY equities. Users select a stock and
forecast horizon, review its historical price behaviour, and receive a multi-session price
path with expected range, return, risk, scenarios, and historical validation.

The analytical pipeline is fully managed by the backend. The public product does not expose
model training, algorithm selection, feature engineering, experiments, or model comparisons.

For a complete submission-ready explanation of the architecture, dataset, models, formulas,
features, database, deployment, limitations, and viva questions, read
[`docs/COMPLETE_PROJECT_GUIDE.md`](docs/COMPLETE_PROJECT_GUIDE.md).

## Quick start

```bash
docker compose up --build
```

| Surface | URL |
|---|---|
| Web application | http://localhost:3000 |
| Public API | http://localhost:8000/docs |

## User flow

Open app → Read market pulse → Select or compare stocks → Run forecast → Stress-test in Forecast Lab → Save to watchlist → Check track record

## Public capabilities

- Browse the available NIFTY stock universe
- Explore candlestick, volume, moving-average, and momentum charts
- Forecast a 5, 10, or 20-session price path with uncertainty bands
- View target price, expected return, upside probability, and signal confidence
- Compare bear, base, and bull scenarios
- Review support, resistance, volatility, market regime, momentum, and volume
- Scan the stock universe by forecast score, expected return, and risk
- Read market breadth and industry leadership in Market Pulse
- Compare two to four stocks on a normalized chart with volatility, drawdown, and return correlation
- Run all three forecast horizons together and translate ranges into capital outcomes
- Stress-test a required return and maximum-loss threshold with an approximate outcome distribution
- Save a private browser watchlist with thesis prices and research notes
- Export a machine-readable forecast brief for downstream research
- Inspect held-out predicted-versus-actual results in Forecast Track Record

## Managed backend

Historical data ingestion, feature preparation, fitting, validation, and inference remain
internal. A managed regression ensemble learns future return magnitude from stationary
price/volume signals. Calibration and final validation use separate chronological windows
with a horizon-sized purge between them.

## Data freshness

The bundled archive ends on 30 April 2021. The interface labels generated results as
historical-data forecasts and always displays the data-through date. Connect a maintained
market-data ingestion source before treating projections as current-market forecasts.

## Disclaimer

Research software only. Forecast ranges are probabilistic and are not investment advice.
