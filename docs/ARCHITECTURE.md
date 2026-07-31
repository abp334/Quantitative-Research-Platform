# Architecture

## Product flow

```text
Bundled OHLCV → PostgreSQL → Stationary market features → Managed forecast engine
                                                             ↓
React UI ← public-safe forecast, scenario, risk, scanner, and validation payloads
   │
   └── Browser research layer: watchlist, comparison, market pulse, capital stress tests
```

The web application is market-first. Users never configure algorithms, generate features, or
run training jobs.

The browser adds a research-workspace layer without inventing market data:

- Market Pulse aggregates scanner results into breadth and industry leadership.
- Compare normalizes OHLCV histories and calculates realised volatility, maximum drawdown,
  best/worst sessions, and pairwise return correlation.
- Forecast Lab requests the supported horizons sequentially, translates ranges into illustrative
  capital outcomes, and lets users stress-test return/loss thresholds.
- Watchlist data, notes, and thesis prices remain in browser `localStorage`; they are not sent
  to the API.

## Forecast engine

For each stock, `forecast_service.py` builds stationary features from returns, moving-average
distance, volatility, RSI, MACD, ATR, Bollinger position, volume, drawdown, gaps, and daily
range. It learns direct cumulative returns for every future step in the selected 5, 10, or
20-session horizon.

A private regression ensemble provides diverse estimates. Recent history is divided
chronologically into:

1. training
2. purged calibration
3. purged final validation

The purge equals the requested forecast horizon so future labels from one window cannot
overlap the next. Calibration errors determine ensemble weights and expected price bands.
The final untouched window supplies direction accuracy, MAE, RMSE, interval coverage, and the
predicted-versus-actual series shown in Forecast Track Record.

The scanner uses a faster regularised regression pass over every available stock and caches
rankings for five minutes.

## Public versus internal

The API router registers only health, read-only stock data, forecast, and scanner routes.
Legacy ingestion, feature, classifier-training, and research modules remain available for
private maintenance but are not public product capabilities.

## Containers

`docker compose up --build` runs PostgreSQL, FastAPI, and the Nginx-served React application.
The archive is mounted read-only. On an empty database, startup imports the bundled data.

## Data limitation

The archive contains daily data through 30 April 2021. Every forecast response carries an
`as_of_date`, and the UI explicitly labels projections as historical-data forecasts. A
maintained market-data ingestion source is required before using the experience as a
current-market forecast.
