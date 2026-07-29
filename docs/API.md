# Public API

Base path: `/api/v1`

The public contract contains only stock data and market-outcome forecasts. Model, training,
feature-generation, experiment, and explanation endpoints are intentionally not registered.

## Health and market data

- `GET /health`
- `GET /data/stocks`
- `GET /data/stocks/{symbol}`
- `GET /data/stocks/{symbol}/ohlcv?start=&end=&limit=`
- `GET /data/stocks/{symbol}/stats?start=&end=`

## AI forecast

`POST /forecast`

```json
{
  "symbol": "RELIANCE",
  "horizon_days": 10
}
```

Supported horizons are `5`, `10`, and `20` trading sessions. The response includes:

- current and target price
- expected return and upside probability
- daily forecast path with lower/upper expected bounds
- bear/base/bull scenarios
- support, resistance, volatility, RSI, volume, risk, and market regime
- plain-language price/volume factors
- chronologically held-out validation metrics and recent outcomes

## AI market scanner

`GET /market/scanner?horizon=5&limit=50`

Returns a cached, ranked cross-section with expected return, upside probability, historical
direction accuracy, volatility, and a composite forecast score.

Interactive documentation is available at `/docs`.
