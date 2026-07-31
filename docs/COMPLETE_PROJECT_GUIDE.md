# Nexus Quantitative Research Platform — Complete Project Guide

> A submission-ready explanation of what the project does, how every major code path works,
> which technologies and models it uses, what the data actually contains, and which parts of
> the repository are active versus retained from an earlier research interface.

---

## Table of contents

1. [The project in one paragraph](#1-the-project-in-one-paragraph)
2. [What Nexus is and is not](#2-what-nexus-is-and-is-not)
3. [Repository map](#3-repository-map)
4. [System architecture](#4-system-architecture)
5. [Application startup flow](#5-application-startup-flow)
6. [Dataset](#6-dataset)
7. [ETL and data-cleaning flow](#7-etl-and-data-cleaning-flow)
8. [Database design](#8-database-design)
9. [Public API](#9-public-api)
10. [Active forecast engine](#10-active-forecast-engine)
11. [Market scanner model](#11-market-scanner-model)
12. [Frontend architecture](#12-frontend-architecture)
13. [Feature-by-feature product walkthrough](#13-feature-by-feature-product-walkthrough)
14. [The inactive legacy ML system](#14-the-inactive-legacy-ml-system)
15. [Technology inventory](#15-technology-inventory)
16. [Caching, concurrency, and performance](#16-caching-concurrency-and-performance)
17. [Validation and tests](#17-validation-and-tests)
18. [Configuration and environment variables](#18-configuration-and-environment-variables)
19. [Docker and deployment](#19-docker-and-deployment)
20. [Security and reliability](#20-security-and-reliability)
21. [Known limitations](#21-known-limitations)
22. [How to explain the project during submission](#22-how-to-explain-the-project-during-submission)
23. [Likely viva questions and answers](#23-likely-viva-questions-and-answers)
24. [Glossary](#24-glossary)

---

## 1. The project in one paragraph

Nexus is a full-stack historical stock-intelligence and quantitative research application for
NIFTY equities. A PostgreSQL database stores bundled daily OHLCV data. A FastAPI backend reads
that history, engineers stationary technical-market features, trains a small regression ensemble
on demand, validates it on chronologically held-out data, and returns a 5, 10, or 20-session
price path with uncertainty bounds, expected return, probability, scenarios, risk context, and
historical validation. A React application turns those responses into a forecast dashboard,
market scanner, market-breadth view, multi-stock comparison tool, capital stress-testing lab,
chart explorer, persistent browser watchlist, and forecast track record.

The archive ends on **30 April 2021**, so Nexus is intentionally presented as historical research
software rather than a live trading or investment-advice system.

---

## 2. What Nexus is and is not

### What it is

- A full-stack web application with a React frontend, FastAPI backend, and PostgreSQL database.
- A reproducible demonstration of time-series feature engineering and chronological validation.
- A multi-step **return regression** system for 5, 10, and 20 trading sessions.
- A cross-sectional scanner that ranks the available archive universe.
- A research workspace for comparing stocks, examining risk, and saving a thesis.
- An educational example of separating internal model machinery from a public product contract.

### What it is not

- It is not connected to a live NSE feed.
- It is not using current prices.
- It is not a broker or order-management system.
- It does not place trades.
- It does not use an LLM or an external AI API.
- It is not a personalized recommendation engine.
- Its probability and confidence fields should not be treated as guarantees.

### Why the interface repeatedly says “historical”

The newest data point in the bundle is 30 April 2021. When the backend returns future dates, those
dates continue from that archive date. For example, a 5-session forecast is asking:

> “Given information available at the archive endpoint, what path would the model have estimated
> for the next five sessions?”

It is **not** asking:

> “What will this stock do during the next five sessions from today?”

That distinction is essential when presenting the project.

---

## 3. Repository map

```text
Quantitative-Research-Platform/
├── archive/                    Bundled daily NIFTY equity CSV files
├── backend/
│   ├── alembic/                Database migrations
│   ├── app/
│   │   ├── api/v1/             FastAPI route modules
│   │   ├── core/               Settings and logging
│   │   ├── db/                 SQLAlchemy base and async sessions
│   │   ├── ml/                 Legacy classifier utilities and shared indicators
│   │   ├── models/             SQLAlchemy ORM models
│   │   ├── repositories/       Database-access layer
│   │   ├── schemas/            Pydantic request/response models
│   │   ├── services/           ETL, forecasting, scanner, and legacy services
│   │   └── main.py             FastAPI application entry point
│   ├── tests/                  Backend unit tests
│   ├── Dockerfile
│   ├── entrypoint.sh
│   └── requirements.txt
├── docker/
│   └── docker-compose.yml      PostgreSQL, API, and frontend services
├── docs/
│   ├── API.md
│   ├── ARCHITECTURE.md
│   └── COMPLETE_PROJECT_GUIDE.md
├── frontend/
│   ├── public/                 Static public assets
│   ├── src/
│   │   ├── api/                Typed fetch wrapper
│   │   ├── components/         Layout, charts, UI, watchlist controls
│   │   ├── lib/                Browser watchlist and retained glossary utilities
│   │   ├── pages/              Route-level product pages
│   │   ├── App.tsx             Providers and route definitions
│   │   ├── index.css           Tailwind directives and product styles
│   │   ├── main.tsx            React entry point
│   │   └── types.ts            Public frontend data types
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml          Root convenience include
└── README.md
```

### Important files to know

| File | Responsibility |
|---|---|
| `backend/app/main.py` | Creates FastAPI, configures CORS, runs startup housekeeping |
| `backend/app/api/v1/router.py` | Defines which routes are actually public |
| `backend/app/services/etl_service.py` | Imports CSV data into PostgreSQL |
| `backend/app/services/forecast_service.py` | Active forecast and scanner engines |
| `backend/app/repositories/__init__.py` | All database queries used by services |
| `backend/app/schemas/__init__.py` | Public and legacy Pydantic contracts |
| `frontend/src/App.tsx` | Route tree, providers, and code splitting |
| `frontend/src/api/client.ts` | Browser-to-API request wrapper |
| `frontend/src/components/AppLayout.tsx` | Shared application navigation |
| `frontend/src/types.ts` | Frontend shape of stocks, forecasts, and scanner rows |
| `docker/docker-compose.yml` | Complete local runtime topology |

---

## 4. System architecture

### High-level flow

```text
Bundled CSV archive
        │
        ▼
Pandas cleaning and canonical ticker mapping
        │
        ▼
PostgreSQL: stocks + OHLCV
        │
        ▼
FastAPI routes
        │
        ├── Read-only stock data
        ├── Per-stock forecast ensemble
        └── Cross-sectional scanner
        │
        ▼
Nginx reverse proxy
        │
        ▼
React + React Query
        │
        ├── Forecast dashboard
        ├── Market Pulse
        ├── Scanner
        ├── Comparison
        ├── Forecast Lab
        ├── Charts
        ├── Watchlist
        └── Track record
```

### A normal API request

Suppose the browser requests a forecast:

```http
POST /api/v1/forecast
Content-Type: application/json

{
  "symbol": "RELIANCE",
  "horizon_days": 10
}
```

The request travels through these layers:

1. In production, Nginx receives `/api/v1/forecast`.
2. Nginx proxies `/api/` to the `api` Docker service on port 8000.
3. FastAPI matches the route in `backend/app/api/v1/forecast.py`.
4. Pydantic parses the JSON as `ForecastRequest`.
5. FastAPI injects an asynchronous SQLAlchemy session through `get_db()`.
6. `ForecastService` resolves the symbol through `StockRepository`.
7. `OhlcvRepository` retrieves the most recent 2,600 daily bars.
8. CPU-heavy feature engineering and model fitting run in an AnyIO worker thread.
9. The service adds company metadata to the model result.
10. Pydantic validates the final object as `ForecastOut`.
11. FastAPI serializes it as JSON.
12. The frontend fetch wrapper returns it to React Query.
13. React Query caches the response under a query key.
14. React renders forecast cards and Recharts visualizations.

### Layer separation

The backend uses a conventional layered design:

```text
Route → Service → Repository → SQLAlchemy model → PostgreSQL
              ↘ ML / Pandas / scikit-learn
```

- **Routes** translate HTTP requests into service calls.
- **Services** contain business logic.
- **Repositories** contain SQL queries and persistence details.
- **ORM models** describe database tables and relationships.
- **Pydantic schemas** validate external contracts.

This separation makes it possible to change database queries without rewriting HTTP routes, or
change forecast internals without changing the public payload.

---

## 5. Application startup flow

### Docker-level startup

Running:

```bash
docker compose up --build
```

starts three services:

1. `db` — PostgreSQL 16 Alpine.
2. `api` — Python 3.11, FastAPI, and Uvicorn.
3. `frontend` — Nginx serving the Vite production bundle.

The API waits until PostgreSQL passes `pg_isready`.

### API entrypoint

`backend/entrypoint.sh` performs:

1. Read `DATABASE_URL_SYNC`.
2. Attempt a Psycopg connection up to 60 times.
3. Wait two seconds between failures.
4. Run `alembic upgrade head`.
5. Start:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### FastAPI lifespan

The lifespan function in `backend/app/main.py` then:

1. Loads settings.
2. Configures logging.
3. Creates the model-artifact directory if needed.
4. Marks legacy training jobs left in `pending` or `running` as failed after a restart.
5. Counts rows in `stocks`.
6. If there are no stocks, automatically runs the CSV ETL import.
7. If stock records already exist, skips automatic import.

Startup housekeeping is wrapped in a broad exception handler. If housekeeping fails, the
exception is logged and the API still starts. This favors availability, but it can leave an empty
or partially prepared system that requires inspection.

---

## 6. Dataset

### Dataset contents

The repository bundles daily NIFTY equity histories under `archive/`.

Profile of the current archive:

| Property | Value |
|---|---:|
| Individual stock filenames | 50 |
| Usable stock histories | 49 |
| Header-only files | `INFRATEL.csv` |
| Total usable OHLCV rows | 235,192 |
| Earliest date | 3 January 2000 |
| Latest date | 30 April 2021 |
| Metadata rows | 50 |
| Symbols in combined raw file | 65 historical ticker forms |

`NIFTY50_all.csv` contains the same 235,192 observations in a single combined file. The ETL does
not use it; it imports the individual files so the filename can act as the canonical symbol.

### Likely data origin

The structure matches the commonly distributed historical NIFTY-50 archive used in Kaggle-style
datasets. However, the repository does **not** include a formal data provenance or license file.
For an academic submission, describe it as:

> “A bundled historical NIFTY equity archive with daily NSE-style OHLCV fields, ending
> 30 April 2021.”

Do not claim an official live NSE partnership.

### CSV columns

The individual files use:

| Column | Meaning |
|---|---|
| `Date` | Trading date |
| `Symbol` | Raw symbol used on that date |
| `Series` | NSE security series, normally `EQ` |
| `Prev Close` | Previous session close |
| `Open` | Session opening price |
| `High` | Session maximum price |
| `Low` | Session minimum price |
| `Last` | Last traded price |
| `Close` | Official closing price |
| `VWAP` | Volume-weighted average price |
| `Volume` | Shares traded |
| `Turnover` | Reported traded value |
| `Trades` | Number of trades, missing in older records |
| `Deliverable Volume` | Deliverable quantity |
| `%Deliverble` | Deliverable volume percentage; source spelling is retained |

### Historical ticker changes

The combined file contains old names such as:

- `INFOSYSTCH` before `INFY`.
- `HINDLEVER` before `HINDUNILVR`.
- `UTIBANK` before `AXISBANK`.
- `TELCO` before `TATAMOTORS`.
- `TISCO` before `TATASTEEL`.
- `MUNDRAPORT` before `ADANIPORTS`.
- `HEROHONDA` before `HEROMOTOCO`.

The ETL deliberately uses the **filename stem** as the canonical ticker. Therefore every row in
`INFY.csv` becomes `INFY` in PostgreSQL even if older raw rows say `INFOSYSTCH`.

### Data-quality observations

The archive passes basic OHLC consistency checks:

- No duplicated dates inside individual stock files.
- No missing required date/symbol/OHLC/volume fields in usable rows.
- No negative volume.
- High is not below low.
- Close and open fall inside the reported high-low interval.

Optional fields are incomplete:

- `Trades` is missing in approximately 114,848 rows.
- `Deliverable Volume` is missing in approximately 16,077 rows.

### Corporate-action problem

The close histories appear not to be fully adjusted for splits, bonuses, or similar corporate
actions. The archive contains:

- 151 absolute one-session close moves above 20%.
- 57 absolute one-session close moves above 50%.

Examples include drops close to 50%, 80%, or 90%, which are characteristic of split or bonus
adjustments rather than ordinary market movement.

Why this matters:

- Return targets can include artificial jumps.
- Volatility can be overstated.
- Moving averages can break across an adjustment date.
- Historical validation can reward or punish a model for an untradeable accounting jump.

The UI warns that corporate-action moves may remain in comparisons. A production-grade system
should ingest adjusted prices or maintain an explicit corporate-action adjustment table.

---

## 7. ETL and data-cleaning flow

ETL means **Extract, Transform, Load**.

### Extract

`EtlService.discover_csv_files()` scans the configured data directory for `*.csv`.

It excludes:

- `NIFTY50_all.csv`
- `stock_metadata.csv`

That leaves the individual stock files.

### Transform

`clean_ohlcv_frame()` performs:

1. Copy the raw DataFrame.
2. Normalize headers to canonical snake_case names.
3. Validate that date, symbol, open, high, low, close, and volume exist.
4. Parse dates; invalid values become missing.
5. Uppercase and trim symbols.
6. Convert numeric columns using `errors="coerce"`.
7. Drop rows missing date or symbol.
8. Remove duplicate symbol/date rows, keeping the last one.
9. Sort by symbol and date.
10. Forward-fill OHLC gaps for at most two rows within each symbol.
11. Drop rows still missing critical OHLC data.
12. Fill missing volume with zero and convert to 64-bit integer.
13. Reject rows where high is below low.
14. Reject rows where close lies outside high-low.

The filename stem then overwrites the cleaned symbol to resolve historical aliases.

### Metadata matching

`stock_metadata.csv` supplies:

- Company name.
- Industry.
- Current canonical symbol.
- Series.
- ISIN.

The ETL first tries metadata using the filename symbol. If that fails, it tries the raw CSV symbol
from the first row. This supports files such as `MM.csv`, whose raw ticker is `M&M`.

### Load

For each non-empty stock file:

1. Upsert the stock row.
2. Convert cleaned Pandas rows into database dictionaries.
3. Insert/update OHLCV rows in chunks of 2,000.
4. Use PostgreSQL `ON CONFLICT` on `(stock_id, date)`.

If `force=True`, existing bars and stocks are cleared first, and bars are replaced by stock.

After import, any legacy database symbol not represented by a current archive filename is removed.
Foreign-key cascades remove its related bars, feature rows, and predictions.

### Transaction behavior

The normal import commits after processing all files. If a file raises an exception, the service
logs it and re-raises. The surrounding session is expected to roll back.

---

## 8. Database design

SQLAlchemy 2.0 declarative models define the schema. PostgreSQL-specific `JSONB` stores flexible
feature vectors, configurations, metrics, and explanation payloads.

### Active public-product tables

#### `stocks`

One row per canonical stock.

Important fields:

- `id`
- `symbol`
- `company_name`
- `industry`
- `series`
- `isin`
- `created_at`

`symbol` is unique and indexed.

#### `ohlcv_bars`

One row per stock per trading date.

Important fields:

- `stock_id`
- `date`
- `open`, `high`, `low`, `close`
- `prev_close`, `last`, `vwap`
- `volume`, `turnover`, `trades`
- `deliverable_volume`, `pct_deliverable`

Constraints:

- Unique `(stock_id, date)`.
- Composite index on stock and date.
- Cascade delete when a stock is removed.

### Legacy research tables

These tables support the inactive classifier system:

#### `feature_runs`

Metadata for a generated feature dataset:

- Name.
- Status.
- Row and symbol counts.
- Parameters.
- Error and timestamps.

#### `features`

One JSON feature vector per stock/date/run:

- `feature_run_id`
- `stock_id`
- `date`
- `features` JSONB
- Binary `target`

#### `training_jobs`

Tracks background classifier training:

- Status and configuration.
- Progress message and structured progress details.
- Feature-run reference.
- Error and timestamps.

#### `model_artifacts`

Metadata for persisted Joblib files:

- Algorithm.
- Artifact path.
- Best hyperparameters.
- Feature names.
- Global feature importance.
- Active flag.
- Training metadata.

#### `model_metrics`

Per-fold and aggregate classification metrics:

- Accuracy.
- Precision.
- Recall.
- F1.
- ROC AUC.
- Confusion matrix.
- ROC curve.
- Learning curve.

Fold `-1` means aggregate.

#### `predictions`

Stores legacy classifier inference:

- Model and stock.
- As-of date.
- `UP`/`DOWN` label.
- Probability and confidence.
- Horizon.
- Text summary.
- SHAP payload.
- Feature snapshot.

#### `backtest_runs`

Stores a legacy illustrative strategy evaluation:

- Model and stock.
- Conviction threshold.
- Date range.
- Horizon.
- Metrics.
- Equity curve.

### Relationships

```text
Stock
├── many OhlcvBar
├── many FeatureRow
└── many Prediction

FeatureRun
└── many FeatureRow

TrainingJob
└── many ModelArtifact

ModelArtifact
├── many ModelMetric
├── many Prediction
└── many BacktestRun
```

### Repository layer

All repository classes are currently collected in:

```text
backend/app/repositories/__init__.py
```

#### `StockRepository`

| Method | Behavior |
|---|---|
| `upsert_stock()` | Finds by symbol, inserts if absent, otherwise updates non-empty metadata |
| `list_stocks()` | Returns all stocks ordered by symbol |
| `get_by_symbol()` | Uppercases input and returns one stock |
| `count()` | Counts stock rows |
| `delete_symbols_not_in()` | Removes database tickers absent from the canonical archive set |

#### `OhlcvRepository`

| Method | Behavior |
|---|---|
| `replace_bars_for_stock()` | Deletes all bars for one stock and inserts the supplied rows |
| `upsert_bars()` | PostgreSQL upsert by the unique stock/date constraint |
| `get_bars()` | Applies date/limit filters and always returns chronological rows |
| `count()` | Counts all bars |
| `delete_all()` | Clears the OHLCV table |

`replace_bars_for_stock()` and `upsert_bars()` use 2,000-row chunks to avoid creating one
extremely large SQL statement.

#### `FeatureRepository` — legacy

| Method group | Behavior |
|---|---|
| Run methods | Create, retrieve, list, and find latest feature runs |
| Row methods | Add feature rows and load chronological rows for one stock |
| Training method | Return labelled feature rows, optionally filtered by stock IDs |
| Count method | Count feature runs |

When a feature-row limit is requested, it selects the newest rows descending and reverses them so
callers still receive chronological order.

#### `TrainingRepository` — legacy

Responsibilities:

- Create, list, and retrieve training jobs.
- Mark pending/running jobs failed after API restart.
- Load models with their metrics using `selectinload`.
- Find the newest active model.
- Save model metadata and metrics.
- Count artifacts.

#### `PredictionRepository` — legacy

Responsibilities:

- Save predictions.
- Retrieve one prediction with stock and model relationships preloaded.
- Count predictions.

Backtest persistence does not have a dedicated repository; `BacktestService` writes the ORM object
through its SQLAlchemy session.

---

## 9. Public API

Base path:

```text
/api/v1
```

Only `health`, `data`, and `forecast` route modules are registered by
`backend/app/api/v1/router.py`.

### Public route-to-code matrix

| HTTP contract | Route function | Main service/repository |
|---|---|---|
| `GET /health` | `health()` | Direct SQLAlchemy `SELECT 1` |
| `GET /data/stocks` | `list_stocks()` | `StockRepository.list_stocks()` |
| `GET /data/stocks/{symbol}` | `get_stock()` | `StockRepository.get_by_symbol()` |
| `GET /data/stocks/{symbol}/ohlcv` | `get_ohlcv()` | Stock + `OhlcvRepository.get_bars()` |
| `GET /data/stocks/{symbol}/stats` | `get_stock_stats()` | Repositories + inline NumPy statistics |
| `POST /forecast` | `forecast()` | `ForecastService.forecast()` |
| `GET /market/scanner` | `market_scanner()` | `ForecastService.scanner()` |

Every public route receives an `AsyncSession` through FastAPI dependency injection. The session
scope closes after the response. If a downstream exception reaches `get_db()`, it rolls back the
transaction and re-raises.

### `GET /health`

Checks PostgreSQL with `SELECT 1`.

Response:

```json
{
  "status": "ok",
  "app": "Nexus AI Stock Forecast",
  "version": "2.0.0",
  "database": "ok"
}
```

If the query fails, HTTP status remains 200 but the payload reports:

```json
{
  "status": "degraded",
  "database": "unavailable"
}
```

### `GET /data/stocks`

Returns all stocks in alphabetical ticker order.

Used by:

- Forecast stock picker.
- Chart explorer.
- Comparison add-stock selector.
- Forecast Lab.
- Watchlist add-stock selector.
- Track Record.

### `GET /data/stocks/{symbol}`

Returns one stock or HTTP 404.

Ticker matching is case-insensitive because the repository uppercases input.

### `GET /data/stocks/{symbol}/ohlcv`

Optional query parameters:

- `start`
- `end`
- `limit`, from 1 to 10,000

Special limit behavior:

- With a limit and no dates, the repository fetches the latest N rows descending, reverses them,
  and returns chronological order.
- With date filters, the query sorts ascending and then applies the limit.

Used by Market Charts and Compare.

### `GET /data/stocks/{symbol}/stats`

Calculates:

- Row count.
- Start and end date.
- Mean and standard deviation of close.
- Mean volume.
- Mean daily return.
- Annualized volatility.
- Return outlier count using absolute z-score above 3.

This endpoint exists in the browser API client but is not currently displayed by a route.

### `POST /forecast`

Request:

```json
{
  "symbol": "RELIANCE",
  "horizon_days": 10
}
```

Allowed horizons:

- 5
- 10
- 20

Response groups:

- Stock identity.
- Archive as-of date.
- Current archive price.
- Bias, upside probability, and confidence.
- Expected return and target price.
- Expected low/high.
- One point per forecast session.
- Bear/base/bull scenario dictionary.
- Market context.
- Market factors.
- Plain-language narrative.
- Validation metrics and recent predicted-versus-actual observations.

### `GET /market/scanner`

Query parameters:

- `horizon`: 5, 10, or 20.
- `limit`: 1 to 50.

Returns ranked rows containing:

- Symbol, company, and industry.
- Archive as-of date and last price.
- Expected return.
- Upside probability.
- Held-out direction accuracy.
- Annualized volatility.
- Composite score.

---

## 10. Active forecast engine

This section explains the model that actually powers the public Forecast, Forecast Lab, and Track
Record pages.

File:

```text
backend/app/services/forecast_service.py
```

### Model type

The active engine is a **multi-output regression ensemble**.

It predicts future cumulative return magnitude, not only an UP/DOWN label.

For horizon `H`, it creates `H` targets:

```text
target_step(t) = Close(t + step) / Close(t) - 1
```

For a 5-session request, one row has:

```text
target_1, target_2, target_3, target_4, target_5
```

For a 20-session request, it has 20 target columns.

### Historical window

The service fetches at most 2,600 OHLCV bars. After feature and target cleaning, it retains at
most the last 2,200 labelled rows.

Minimum raw history:

```text
320 sessions
```

Minimum clean labelled history after transformations:

```text
220 rows
```

### Active feature vector

The active engine creates 30 stationary or mostly scale-free features.

#### Return features — 7

- 1-session return.
- 2-session return.
- 3-session return.
- 5-session return.
- 10-session return.
- 20-session return.
- 60-session return.

Formula:

```text
return_N(t) = Close(t) / Close(t-N) - 1
```

#### Distance from moving average — 5

- Distance from SMA 5.
- Distance from SMA 10.
- Distance from SMA 20.
- Distance from SMA 50.
- Distance from SMA 100.

Formula:

```text
distance_sma_N = Close / SMA_N - 1
```

Using distance rather than raw SMA price makes the signal more comparable across time.

#### Annualized realized volatility — 4

- 5-session.
- 10-session.
- 20-session.
- 60-session.

Formula:

```text
volatility_N = standard_deviation(daily_return, N) × sqrt(252)
```

#### Momentum and volatility indicators — 7

- RSI(14), divided by 100.
- MACD divided by close.
- MACD signal divided by close.
- MACD histogram divided by close.
- ATR(14) divided by close.
- Bollinger width.
- Position inside Bollinger bands.

#### Volume features — 2

- Latest volume divided by 20-session average.
- Volume z-score relative to 20-session mean and standard deviation.

#### Session-structure and drawdown features — 5

- Intraday high-low range divided by close.
- Close location inside the daily high-low range.
- Opening gap relative to previous close.
- Drawdown from 20-session maximum.
- Drawdown from 60-session maximum.

### Why stationary features are preferred

A raw close of ₹100 and a raw close of ₹3,000 are not directly comparable. A 2% return or a
price 3% above its moving average has a more consistent interpretation.

Stationary features help reduce:

- Dependence on absolute price scale.
- Long-run inflation and price drift.
- Instability when comparing older and newer periods.

They do not guarantee statistical stationarity, but they are substantially safer than raw price
levels for this task.

### Chronological split

The clean labelled matrix is divided as follows:

```text
Training:       first ~68%
Purge gap:      H rows
Calibration:    until ~84%
Purge gap:      H rows
Validation:     remaining rows, at least about 40
```

In code:

```text
train_end        = max(160, floor(N × 0.68))
calibration_start = train_end + H
calibration_end   = floor(N × 0.84)
test_start        = calibration_end + H
```

### Why purge gaps exist

A label at time `t` includes price information through `t + H`.

Without a purge, the final training label could overlap the first calibration observation’s time
period. That produces temporal information leakage even if the feature itself uses only past data.

The purge length equals the requested horizon so label windows do not cross split boundaries.

### Ensemble members

#### 1. Ridge regression

Pipeline:

```text
StandardScaler → Ridge(alpha=18)
```

Purpose:

- Linear, stable baseline.
- Handles correlated features with L2 regularization.
- Captures broad relationships without deep nonlinear behavior.

#### 2. Random Forest regressor

Important parameters:

- 120 trees.
- Maximum depth 8.
- Minimum leaf size 6.
- 75% feature sampling.
- Fixed random seed 42.
- Parallel tree fitting.

Purpose:

- Nonlinear interactions.
- Robust ensemble averaging.
- Different bias from Ridge.

#### 3. Extra Trees regressor

Important parameters:

- 120 trees.
- Maximum depth 10.
- Minimum leaf size 5.
- 80% feature sampling.
- Fixed random seed 43.
- Parallel fitting.

Purpose:

- Adds greater split randomization.
- Provides a second nonlinear estimate with different variance characteristics.

### Calibration-based ensemble weights

Each model predicts the calibration set.

Its error is:

```text
model_error = mean(abs(prediction - actual))
```

Raw weight:

```text
raw_weight = 1 / max(model_error, 0.00001)
```

Final weights are normalized to sum to one.

Therefore a model with lower calibration MAE receives more ensemble influence.

### Validation

The models trained on the training partition predict the untouched final validation partition.

The public validation metrics use the **last requested step**, for example target day 10 in a
10-session forecast.

Metrics:

#### Direction accuracy

```text
mean(sign(predicted_return) == sign(actual_return))
```

#### MAE

```text
mean(abs(predicted_return - actual_return))
```

The API multiplies it by 100 and exposes `mae_percent`.

#### RMSE

```text
sqrt(mean((predicted_return - actual_return)^2))
```

The API exposes it in percentage points.

#### Interval coverage

The share of validation targets inside the estimated lower and upper return interval.

#### Recent validation observations

The API returns up to the last 36 validation cases:

- Forecast date.
- Predicted cumulative return.
- Actual cumulative return.
- Whether the signs matched.

Track Record charts these points.

### Final refit

After generating calibration and validation predictions, each ensemble member is fitted again on
all available labelled `X` and `y`.

This full-history fit is used only for the current archive-end forecast.

The validation metrics remain based on the earlier untouched partition; they are not recalculated
using the full-history model.

### Extrapolation clipping

For every future step, the ensemble return estimate is clipped between the 1.5th and 98.5th
percentiles of historical targets for that step.

This prevents an isolated model extrapolation from producing a return far outside what the stock
has historically demonstrated.

### Price path construction

For each future step:

```text
predicted_price = current_price × (1 + predicted_cumulative_return)
```

Dates advance over weekdays only. Saturdays and Sundays are skipped.

Important limitation:

- NSE holidays are **not** skipped.

### Forecast interval

Calibration residuals:

```text
residual = actual_return - ensemble_prediction
```

For each step, the engine calculates:

- 10th percentile residual.
- 90th percentile residual.

It also calculates a volatility width:

```text
statistical_width = recent_daily_volatility × sqrt(step) × 0.8
```

The lower bound uses the more conservative of:

- Prediction plus low residual quantile.
- Prediction minus statistical width.

The upper bound uses the more conservative of:

- Prediction plus high residual quantile.
- Prediction plus statistical width.

The lower price is floored at ₹0.01.

### Upside probability

For the final horizon:

```text
z = predicted_final_return / calibration_residual_standard_deviation
probability_up = NormalCDF(z)
```

It is clipped to:

```text
0.03 ≤ probability_up ≤ 0.97
```

This is a normal-residual approximation. It is not an independently calibrated probability
classifier.

### Bias label

```text
Bullish if probability_up >= 0.57
Bearish if probability_up <= 0.43
Neutral otherwise
```

### Confidence score

Confidence combines:

- Distance of probability from 50%.
- Validation direction accuracy above 50%.
- A penalty for MAE relative to expected horizon volatility.

Exact calculation:

```text
normalized_error =
  min(
    MAE / max(recent_daily_volatility × sqrt(horizon), 0.00001),
    1
  )

confidence =
  clip(
      abs(probability_up - 0.5) × 1.35
    + max(direction_accuracy - 0.5, 0) × 0.8
    - normalized_error × 0.15,
    0.05,
    0.95
  )
```

It is clipped between 5% and 95%.

This is an interpretable product score, not a formal confidence interval.

### Scenarios

The scenario dictionary contains:

- **Bear** — final lower expected boundary.
- **Base** — final ensemble point estimate.
- **Bull** — final upper expected boundary.

These are not three separately trained models.

### Market context

The backend calculates:

- 60-session support as the 12th percentile of recent lows.
- 60-session resistance as the 88th percentile of recent highs.
- Annualized 20-session volatility.
- RSI.
- Latest volume divided by 20-session average.

Regime:

```text
Bullish trend:  Close > SMA20 > SMA50
Bearish trend:  Close < SMA20 < SMA50
Otherwise:      Range / transition
```

Risk:

```text
High:      volatility >= 38%
Moderate:  volatility >= 22%
Low:       otherwise
```

### Human-readable factors

Five factor cards are returned:

1. Trend structure.
2. Momentum.
3. Trading activity.
4. Volatility environment.
5. Price stretch.

Each has:

- Name.
- Positive/negative/neutral state.
- Score from -1 to 1.
- Plain-language description.

Descriptions are generated from templates, not from an LLM.

Factor scores:

```text
trend =
  clip(
      (Close / SMA20 - 1) × 12
    + (SMA20 / SMA50 - 1) × 8,
    -1,
    1
  )

momentum =
  clip(
      return_20 × 8
    + (RSI - 50) / 50,
    -1,
    1
  )

trading_activity =
  clip((volume_ratio - 1) × 0.8, -1, 1)

volatility_environment =
  clip(1 - annualized_volatility_20 / 0.45, -1, 1)

price_stretch =
  clip((0.5 - bollinger_position) × 1.5, -1, 1)
```

State thresholds:

```text
score > 0.15    positive
score < -0.15   negative
otherwise       neutral
```

---

## 11. Market scanner model

The scanner uses the same 30-feature market frame but a faster single-target process.

### Why a separate scanner model exists

A complete forecast fits three multi-output models multiple times. Repeating that process for
every stock would be too slow for an interactive leaderboard.

The scanner therefore trades modelling depth for speed.

### Scanner history

For each stock:

- Load at most 1,800 bars.
- Build active market features.
- Create one cumulative-return target at the requested horizon.
- Keep the latest 1,400 clean labelled rows.
- Require at least 180 rows.

### Split

```text
train_split = max(120, floor(N × 0.8))
test_start  = min(train_split + horizon, N - 30)
```

The code attempts a horizon-sized purge before validation. `N - 30` guarantees approximately 30
test observations, so very small usable samples can shorten that purge. In this archive, stock
histories are generally much longer than the minimum.

### Model

```text
StandardScaler → Ridge(alpha=20)
```

The scanner first fits on the training partition for validation, then refits on all labelled
history for the latest signal.

### Scanner probability

```text
residual_std = standard_deviation(actual - validation_prediction)
probability_up = NormalCDF(predicted_return / residual_std)
```

Clipped between 5% and 95%.

### Composite score

```text
score =
    (probability_up - 0.5) × 160
  + (validation_accuracy - 0.5) × 40
  - max(volatility - 0.35, 0) × 20
```

Then:

```text
-100 ≤ score ≤ 100
```

Interpretation:

- Strong upside probability increases score.
- Direction accuracy above 50% increases score.
- Annualized volatility above 35% creates a penalty.

The score is a relative ranking signal, not a predicted percentage return.

### Scanner execution

The backend loops through stocks sequentially.

For each stock, CPU calculation runs in a worker thread so FastAPI’s event loop remains available.
Results are sorted by score descending and truncated to the requested limit.

---

## 12. Frontend architecture

### React entry point

`frontend/src/main.tsx` mounts React into the `#root` element under `StrictMode`.

### Providers

`App.tsx` wraps the application in:

1. `QueryClientProvider`.
2. `ToastProvider`.
3. `WatchlistProvider`.
4. `BrowserRouter`.

### React Query defaults

Global query defaults:

- Data is fresh for 60 seconds.
- Failed queries retry once.

Forecast pages override stale time to five minutes where appropriate.

React Query deduplicates matching query keys. For example, Market Pulse, Scanner, and Watchlist all
use:

```text
["market-scanner", horizon]
```

When the same horizon is fresh, they reuse the client cache.

### Route code splitting

Every page is loaded with `React.lazy()`.

Effect:

- Initial JavaScript fell from roughly 836 KB to approximately 325 KB in the current build.
- The Recharts bundle is loaded only when a visualization route needs it.
- Route-level page chunks are individually cached by the browser.

### API client

`frontend/src/api/client.ts` uses the browser Fetch API.

Base URL:

```text
VITE_API_BASE or /api/v1
```

The wrapper:

1. Adds JSON content type.
2. Calls `fetch`.
3. Parses FastAPI’s `detail` field for failed responses.
4. Throws an `Error` for React Query.
5. Returns parsed JSON.

### Routing and URL state

Routes:

| Path | Page |
|---|---|
| `/` | Landing |
| `/app` | Forecast |
| `/app/pulse` | Market Pulse |
| `/app/scanner` | Scanner |
| `/app/compare` | Compare |
| `/app/lab` | Forecast Lab |
| `/app/market` | Market Charts |
| `/app/watchlist` | Watchlist |
| `/app/track-record` | Track Record |

Several pages store choices in query parameters:

- Forecast: `symbol`, `horizon`.
- Scanner: `horizon`.
- Compare: `symbols`, `range`.
- Forecast Lab: `symbol`.
- Market Charts: `symbol`, `range`.
- Track Record: `symbol`, `horizon`.

This makes research states bookmarkable and shareable.

### UI system

The interface uses:

- Tailwind utility classes.
- Custom CSS variables.
- Glass panels and gradient backgrounds.
- Syne display font.
- DM Sans body font.
- JetBrains Mono numeric font.
- Green for positive.
- Red for negative.
- Blue for model/range context.
- Yellow for caution and archive warnings.

### Charts

Recharts components provide:

- Candlestick-style OHLC view.
- Volume bars.
- Moving-average trend lines.
- RSI.
- Forecast fan chart.
- Predicted-versus-actual validation chart.
- Normalized multi-stock performance.
- Forecast term structure.

### Shared component responsibilities

#### `AppLayout`

- Sticky product header.
- Route navigation.
- Active-route styling.
- Watchlist count.
- Animated main content container.
- Error boundary around nested page routes.

#### `ui.tsx`

Reusable presentation primitives:

- `Card`
- `MetricHint`
- `Callout`
- `FieldSelect`
- `Stat`
- `Button`
- `Badge`
- `Loading`
- `ErrorBox`

Some primitives are retained from the earlier research interface and are not used by every current
page.

#### `ux.tsx`

- Toast context and animated toast list.
- Skeleton loaders.
- Page-level skeleton.
- React class error boundary.

#### `charts.tsx`

Centralizes Recharts configuration and visual conventions:

- Dark tooltip styling.
- INR formatting.
- Chart colors.
- Axes and grids.
- Custom candle body/wick drawing.
- Forecast range visualization.

#### `WatchlistButton`

Provides one consistent star control across Forecast, Market Pulse, Scanner, and Compare. It calls
the shared watchlist context and confirms changes using the toast system.

---

## 13. Feature-by-feature product walkthrough

## 13.1 Landing page

File:

```text
frontend/src/pages/LandingPage.tsx
```

Purpose:

- Explain the product before entering the workspace.
- Avoid presenting fixed fake predictions.
- Show that the application generates results on demand.
- Introduce Market Pulse, Compare, Forecast Lab, and Watchlist.

The landing page contains no market API request. This keeps the first load fast and avoids
triggering the CPU-heavy scanner for a visitor who has not entered the application.

---

## 13.2 AI Forecast

File:

```text
frontend/src/pages/DashboardPage.tsx
```

### User flow

1. Select a stock.
2. Select 5, 10, or 20 sessions.
3. Click “Run AI forecast.”
4. The page adds symbol and horizon to the URL.
5. React Query posts to `/forecast`.
6. The backend trains or returns a five-minute cached result.

### What it displays

- Symbol, company, and bias.
- Archive current price.
- Final target price.
- Expected return.
- Upside probability.
- Confidence.
- Expected price range.
- Market regime.
- Complete projected path.
- Bear/base/bull scenarios.
- Five explanatory market factors.
- Risk level.
- Annualized volatility.
- Support and resistance.
- RSI and volume ratio.
- Validation summary.

### Watchlist integration

The star button stores or removes the stock from the browser watchlist.

### Why the initial screen is empty

When there is no symbol in the URL, the page waits for explicit user input instead of showing a
pre-added prediction. This reinforces that forecasts are generated on request.

---

## 13.3 Market Pulse

File:

```text
frontend/src/pages/MarketPulsePage.tsx
```

### API source

Uses the scanner payload for the selected horizon.

### Derived client-side analytics

#### Forecast breadth

```text
number of stocks with expected_return >= 0 / total scanner rows
```

Classification:

```text
>= 60%   Broadly constructive
< 40%    Broadly defensive
otherwise Mixed market
```

#### Average expected return

Arithmetic mean across scanner rows.

#### Average volatility

Arithmetic mean of scanner annualized volatility.

#### High-conviction count

A signal is counted when:

```text
probability_up >= 62% or probability_up <= 38%
```

#### Industry leadership

Rows are grouped by `industry`.

For each group:

- Stock count.
- Average scanner score.
- Average expected return.
- Share with positive expected return.

Industries are sorted by average score; the UI displays the first eight.

#### Leaders and laggards

Stocks are sorted by expected return.

- Top three become positive leaders.
- Bottom three become weakest outlooks.

Each row links to its full forecast and has a watchlist star.

---

## 13.4 AI Scanner

File:

```text
frontend/src/pages/ScannerPage.tsx
```

### User controls

- Horizon.
- Search by symbol/company/industry.
- Direction filter.
- Sort key.

### Direction filter

- All.
- Positive expected return.
- Negative expected return.

### Sort options

- Composite score descending.
- Expected return descending.
- Upside probability descending.
- Volatility ascending.

### Summary cards

- Positive forecast count.
- Average upside probability.
- Highest score.

### Row actions

- Add/remove from watchlist.
- Open complete forecast with symbol and horizon preserved.

All filtering and alternate sorting occur in the browser after one scanner response.

---

## 13.5 Compare

File:

```text
frontend/src/pages/ComparePage.tsx
```

### User flow

1. Choose two to four stocks.
2. Choose 90, 252, 504, or 1,000 bars.
3. The browser requests OHLCV history for each stock in parallel.
4. Metrics and correlation are calculated client-side.
5. Selection is stored in the URL.

### Normalized performance

Every stock is rebased to 100:

```text
normalized_price(t) = Close(t) / first_close × 100
```

Why:

- A ₹100 stock and ₹3,000 stock can share the same chart.
- The line shows percentage wealth evolution rather than nominal price difference.

### Period return

```text
last_close / first_close - 1
```

### Annualized volatility

1. Calculate daily simple close-to-close returns.
2. Calculate sample variance.
3. Take standard deviation.
4. Multiply by `sqrt(252)`.

### Maximum drawdown

For every bar:

```text
running_peak = max(previous_running_peak, close)
drawdown = close / running_peak - 1
```

The minimum drawdown is the maximum historical loss from a preceding peak.

### Best and worst day

Maximum and minimum one-session close return inside the chosen window.

### Return correlation

For each stock pair:

1. Align daily returns by date.
2. Compute mean return for both series.
3. Calculate Pearson covariance numerator.
4. Divide by the product of standard deviations.

Interpretation:

- Near `+1`: stocks moved together.
- Near `0`: limited linear relationship.
- Near `-1`: stocks tended to move in opposite directions.

The matrix is for realized historical returns, not forecast correlation.

### Limitations

- Uses archive close history.
- Uses up to the most recent 1,000 bars.
- Prices may contain unadjusted corporate actions.
- It does not account for dividends.

---

## 13.6 Forecast Lab

File:

```text
frontend/src/pages/ForecastLabPage.tsx
```

### Purpose

Forecast Lab makes the model interactive at the decision level. Instead of showing one output, it
asks:

- Does the forecast strengthen or weaken as the horizon expands?
- What do bear/base/bull ranges mean for an assumed amount of capital?
- How often would an approximate distribution clear a required return?
- How often could it breach the user’s loss limit?

### Multi-horizon request flow

The browser requests:

1. 5-session forecast.
2. 10-session forecast.
3. 20-session forecast.

Requests are deliberately sequential, not parallel.

Reason:

- A cold forecast performs multiple tree fits using all CPU cores.
- Sending three cold fits simultaneously could oversubscribe the API host.

Backend five-minute caching makes later reuse faster.

### User inputs

- Capital modelled: ₹10,000 to ₹2,000,000.
- Required return: -5% to +15%.
- Maximum loss threshold: 1% to 20%.
- Selected horizon card.

### Capital outcomes

For capital `C`:

```text
base_PnL = C × expected_return
bear_PnL = C × bear_return
bull_PnL = C × bull_return
```

Ending value:

```text
C + scenario_PnL
```

### Approximate distribution width

The lab estimates standard deviation using the widest of:

1. Forecast interval approximation:

```text
(bull_return - bear_return) / (2 × 1.2816)
```

`1.2816` is approximately the 90th percentile z-score, matching an 80% two-sided interval.

2. Held-out validation RMSE converted from percent.
3. A 0.2% minimum numerical floor.

### Chance of clearing the user’s return

```text
1 - NormalCDF((required_return - expected_return) / sigma)
```

### Chance of breaching the loss threshold

```text
NormalCDF((-maximum_loss - expected_return) / sigma)
```

These are sensitivity approximations. They are not returned by the backend and are not claimed as
calibrated investment probabilities.

### Reward/risk

```text
positive bull return / absolute negative bear return
```

### Range risk

Capital multiplied by the magnitude of the negative bear boundary.

### Signal quality

The UI combines:

```text
direction_accuracy × 45%
+ interval_coverage × 25%
+ confidence × 30%
```

This is a research summary score only.

### Term structure

The chart compares:

- Expected return.
- Lower boundary.
- Upper boundary.

across 5, 10, and 20 sessions.

It helps reveal:

- Consistent direction at every horizon.
- A signal that fades with time.
- A direction reversal.
- Rapidly widening uncertainty.

### Export

The “Export brief” button downloads JSON containing:

- Export timestamp.
- Archive data-through date.
- Symbol.
- Capital and threshold assumptions.
- Selected horizon.
- Complete backend forecast payload.
- Client-side scenario analysis.
- Disclaimer.

No export is uploaded to a server.

---

## 13.7 Market Charts

File:

```text
frontend/src/pages/DataExplorerPage.tsx
```

### User controls

- Stock.
- 3 months, 1 year, 2 years, or all available from the 1,000-bar fetch.

### Views

- Candlestick-style daily price.
- Volume.
- Close with 20-session SMA.
- Close with 50-session SMA.
- RSI with 30/50/70 reference lines.

### Client-side indicator difference

The chart page’s RSI uses simple 14-session average gains and losses.

The backend model’s RSI uses an exponentially weighted Wilder-style calculation.

Therefore the chart RSI is an explanatory visualization, not guaranteed to be numerically
identical to the model feature.

---

## 13.8 Watchlist

Files:

```text
frontend/src/lib/watchlist.tsx
frontend/src/components/WatchlistButton.tsx
frontend/src/pages/WatchlistPage.tsx
```

### Storage

LocalStorage key:

```text
nexus.watchlist.v1
```

Stored fields:

- Symbol.
- Company name.
- Industry.
- Added timestamp.
- Research note.
- Optional thesis price.

### Privacy model

- Watchlist writes do not call the backend.
- Notes remain in the browser profile.
- No account is required.
- No synchronization to another device exists.
- A storage event synchronizes watchlist changes between tabs in the same browser profile.

### Signal enrichment

The Watchlist page fetches the scanner for a selected horizon and joins scanner rows to saved
symbols.

It displays:

- Archive last price.
- Expected return.
- Upside probability.
- Scanner score.

### Thesis distance

If a thesis price is saved:

```text
thesis_price / archive_last_price - 1
```

Because the archive is historical, this is a research annotation rather than a live price alert.

---

## 13.9 Track Record

File:

```text
frontend/src/pages/TrackRecordPage.tsx
```

### Data source

Track Record calls the same `/forecast` endpoint and uses its `validation` object.

It does not maintain a separate database of forecasts made by real users over time.

### What it displays

- Direction accuracy.
- MAE.
- RMSE.
- Interval coverage.
- Number of validation samples.
- Predicted-versus-actual line chart.
- Recent observation table.
- Correct/missed direction badge.

### Assessment labels

```text
accuracy >= 60%  Historically consistent
accuracy >= 50%  Mixed
accuracy < 50%   Historically uncertain
```

These labels apply only to the held-out archive period for the selected stock and horizon.

---

## 14. The inactive legacy ML system

This repository contains an older, much larger classifier-based research platform. Its backend
code and database schema remain, but its routes are not registered and its frontend pages were
removed.

### Why this distinction matters

There are two different horizon sets:

| System | Task | Horizons | Active in UI? |
|---|---|---|---|
| Current forecast engine | Future return regression and price path | 5, 10, 20 | Yes |
| Legacy classifier engine | Binary UP/DOWN classification | 1, 3, 5 | No |

Do not say the public forecast is using saved XGBoost artifacts or SHAP. It is not.

### Legacy feature generation

File:

```text
backend/app/ml/features/indicators.py
```

The legacy feature frame creates 37 columns:

- SMA 5, 10, 20, 50.
- EMA 12, 26.
- RSI 14.
- MACD, signal, histogram.
- ATR 14.
- Bollinger upper, mid, lower, width, and position.
- Momentum 10.
- ROC 10.
- Rolling mean and standard deviation.
- Daily and log return.
- Rolling volatility.
- Close lags 1, 2, 3, 5, 10.
- Return lags 1, 2, 3, 5, 10.
- Volume change.
- Absolute price change.
- High-low range.
- Close-open return.

Target:

```text
1 if Close(t + horizon) > Close(t)
0 otherwise
```

Supported horizons:

```text
1, 3, 5
```

Feature vectors are stored as JSONB in PostgreSQL.

### Legacy classifiers

#### Logistic Regression

- StandardScaler pipeline.
- Balanced class weights.
- Tuned regularization `C`.

#### Random Forest Classifier

- Tuned tree count.
- Tuned depth.
- Tuned split/leaf minimums.
- Balanced subsample class weights.

#### XGBoost Classifier

- Binary logistic objective.
- Tuned tree count and depth.
- Tuned learning rate.
- Tuned row and feature subsampling.
- Tuned child weight and L2 regularization.

### Optuna

Optuna uses a seeded TPE sampler to maximize validation ROC AUC, falling back to F1 if ROC AUC
cannot be computed.

### Walk-forward evaluation

The legacy evaluator creates expanding-window folds:

```text
Train [0, train_end)
Test  [train_end, test_end)
```

Default settings:

- Minimum train rows: 756.
- Test rows: 126.
- Step rows: 126.
- Maximum folds: 8.

### Legacy artifact persistence

Joblib files contain:

- Trained estimator.
- Algorithm name.
- Feature names.
- Best parameters.
- Background sample for SHAP.
- Horizon.

Metadata is written to `model_artifacts`.

### SHAP explainability

The repository supports:

- LinearExplainer for scaled Logistic Regression.
- TreeExplainer for Random Forest and XGBoost.
- KernelExplainer fallback.
- Local feature contributions.
- Mean absolute global importance.
- Positive and negative contribution lists.

### Legacy prediction

Prediction flow:

1. Choose best active model matching horizon by ROC AUC and F1.
2. Resolve or generate feature rows for the symbol.
3. Load Joblib artifact.
4. Calculate `predict_proba`.
5. Label UP above 50%, otherwise DOWN.
6. Define confidence as `abs(P(UP)-0.5)×2`.
7. Attempt SHAP explanation.
8. Store prediction and explanation in PostgreSQL.

### Legacy backtest

The backtest:

- Scores stored feature rows.
- Keeps signals above a conviction threshold.
- Goes long on UP or inverse/short on DOWN.
- Compounds realized forward returns.
- Calculates accuracy, win rate, cumulative return, and maximum drawdown.

Important caveat:

The saved final classifier is trained on the complete feature dataset and then can be scored over
that same history. This makes the legacy backtest substantially in-sample. It should be treated as
illustrative code, not reliable performance evidence.

### Legacy insights and PDF

Inactive services can aggregate:

- Best models.
- Prediction confidence by stock.
- Label distribution.
- Feature importance.
- Feature correlations.
- Model performance over time.

ReportLab can create a PDF research report.

### Why legacy routes are unreachable

The route modules still exist:

- `dashboard.py`
- `features.py`
- `prediction.py`
- `training.py`
- `research.py`

But `router.py` imports only:

- `health`
- `data`
- `forecast`

FastAPI never mounts the other routers.

---

## 15. Technology inventory

## 15.1 Backend

| Technology | Version | Use |
|---|---:|---|
| Python | 3.11 container | Backend language |
| FastAPI | 0.115.6 | HTTP API and dependency injection |
| Uvicorn | 0.34.0 | ASGI server |
| SQLAlchemy asyncio | 2.0.36 | ORM and async database access |
| asyncpg | 0.30.0 | Async PostgreSQL driver |
| Psycopg2 binary | 2.9.10 | Synchronous startup readiness check |
| Alembic | 1.14.0 | Schema migrations |
| Pydantic | 2.10.3 | Request/response validation |
| pydantic-settings | 2.6.1 | Environment configuration |
| Pandas | 2.2.3 | CSV cleaning and feature frames |
| NumPy | 2.2.1 | Numerical arrays and statistics |
| scikit-learn | 1.6.0 | Active and legacy ML models |
| XGBoost | 2.1.3 | Legacy classifier |
| Optuna | 4.1.0 | Legacy hyperparameter tuning |
| SHAP | 0.46.0 | Legacy model explanations |
| Joblib | 1.4.2 | Legacy artifact persistence |
| ReportLab | 4.2.5 | Legacy PDF reports |
| Pytest | 8.3.4 | Unit testing |
| pytest-asyncio | 0.25.0 | Async test support |

## 15.2 Frontend

| Technology | Version family | Use |
|---|---:|---|
| React | 18.3 | Component UI |
| React DOM | 18.3 | Browser rendering |
| TypeScript | 5.6 | Static typing |
| Vite | 5.4 | Development server and production bundler |
| React Router | 6.28 | Client-side routes and URL state |
| TanStack React Query | 5.62 | Server-state fetching and caching |
| Recharts | 2.15 | Financial and analytical charts |
| Framer Motion | 11.15 | Page and toast animations |
| Lucide React | 0.469 | Icons |
| Tailwind CSS | 3.4 | Utility styling |
| PostCSS | 8.4 | CSS build pipeline |
| Autoprefixer | 10.4 | Browser CSS prefixes |

## 15.3 Infrastructure

| Technology | Use |
|---|---|
| PostgreSQL 16 Alpine | Relational persistence |
| Docker Compose | Local multi-container orchestration |
| Python 3.11 Slim Bookworm | API base image |
| Node 22 Alpine | Frontend build image |
| Nginx 1.27 Alpine | Static hosting and API reverse proxy |

## 15.4 External services

The current project uses no:

- OpenAI API.
- LLM.
- Cloud database.
- Authentication provider.
- Broker API.
- Live market-data provider.
- External model-serving platform.

The only normal browser external request is Google Fonts from `index.html`.

---

## 16. Caching, concurrency, and performance

### Backend forecast cache

In-memory dictionary key:

```text
(stock_id, horizon, latest_bar_date)
```

TTL:

```text
300 seconds
```

Consequences:

- Repeated forecast requests are fast for five minutes.
- Cache disappears on process restart.
- Multiple API replicas do not share cache.
- Updating price values on the same latest date does not change the key.
- Old cache entries are not proactively removed.

### Backend scanner cache

Key:

```text
(horizon, limit)
```

TTL:

```text
300 seconds
```

Different limits create separate cached results even though the full universe calculation is
nearly identical.

### CPU handling

Forecast and scanner calculations use:

```python
await to_thread.run_sync(...)
```

This keeps synchronous Pandas and scikit-learn work away from the async event loop.

Tree models use `n_jobs=-1`, so one cold forecast can use all available CPU cores.

### Forecast Lab sequencing

Forecast Lab deliberately calls horizons one after another to avoid three all-core fits at once.

### Frontend cache

React Query caches server responses in browser memory. Cache disappears on full reload unless the
backend cache still has the result.

### Route bundle performance

Pages are lazy-loaded. The production build currently separates:

- Main application shell.
- Recharts/chart components.
- Individual pages.
- Shared UI and small icon chunks.

---

## 17. Validation and tests

### Current backend test suite

There are 15 tests across four files.

#### ETL tests

- Column normalization.
- Missing-schema rejection.
- Duplicate handling and numeric cleaning.
- Invalid high/low rejection.

#### Indicator tests

- SMA calculation.
- EMA finite values.
- RSI bounds.
- One-session no-look-ahead target.
- Three-session target.
- Presence of every legacy feature column.

#### Walk-forward tests

- Expanding train windows.
- Fold cap on large data.
- Insufficient-data behavior.

#### Active forecast tests

- Future changes do not modify earlier feature rows.
- Forecast output has the correct path length.
- Lower ≤ estimate ≤ upper.
- Probability and confidence remain bounded.
- Support is below resistance.
- Validation has enough samples.

### Frontend validation

The production command:

```bash
npm run build
```

runs:

```text
TypeScript project build → Vite production build
```

The current feature implementation passes the production build.

### Missing tests

The project does not currently contain:

- Database integration tests.
- FastAPI route tests.
- ETL import test against PostgreSQL.
- Frontend component tests.
- Browser end-to-end tests.
- Visual regression tests.
- Load tests.
- CI workflow.

These are strong future-improvement opportunities.

---

## 18. Configuration and environment variables

Settings live in:

```text
backend/app/core/config.py
```

Pydantic Settings loads environment variables and optionally `.env`.

### Application settings

| Variable | Default | Purpose |
|---|---|---|
| `APP_NAME` | Nexus AI Stock Forecast | FastAPI title |
| `APP_VERSION` | 2.0.0 | API version |
| `DEBUG` | false | Debug logging and SQL echo |
| `API_PREFIX` | `/api/v1` | Route prefix |

### Database

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Async SQLAlchemy connection |
| `DATABASE_URL_SYNC` | Alembic and readiness connection |

### File paths

| Variable | Container value | Purpose |
|---|---|---|
| `DATA_DIR` | `/data/archive` | Mounted CSV archive |
| `MODELS_DIR` | `/models` | Legacy Joblib artifacts |

### CORS

`CORS_ORIGINS` is a comma-separated list.

Docker allows:

- `http://localhost:5173`
- `http://localhost:3000`
- `http://localhost`
- `http://frontend`

### Legacy training

| Variable | Default setting | Docker override |
|---|---:|---:|
| `OPTUNA_TRIALS` | 30 | 20 |
| `DEFAULT_TRAIN_SYMBOLS` | RELIANCE,TCS,INFY,HDFCBANK,SBIN | unchanged |
| `WALK_FORWARD_MIN_TRAIN_DAYS` | 756 | unchanged |
| `WALK_FORWARD_TEST_DAYS` | 126 | unchanged |
| `WALK_FORWARD_STEP_DAYS` | 126 | unchanged |

### Frontend

```text
VITE_API_BASE
```

Production Docker sets it to:

```text
/api/v1
```

Vite development proxies `/api` to `http://localhost:8000`.

---

## 19. Docker and deployment

### Root Compose

The root `docker-compose.yml` includes:

```text
docker/docker-compose.yml
```

### PostgreSQL service

- Image: `postgres:16-alpine`.
- Host port: 5432.
- Database: `quant_research`.
- User/password: `quant`/`quant` for local development.
- Persistent volume: `pgdata`.
- Health check: `pg_isready`.

### API service

- Builds `backend/Dockerfile`.
- Host port: 8000.
- Archive mounted read-only at `/data/archive`.
- Model volume mounted at `/models`.
- Starts only after the database becomes healthy.

### Frontend service

Build stage:

1. Node 22 Alpine.
2. Install package-lock dependencies.
3. Run TypeScript and Vite build.

Runtime stage:

1. Nginx 1.27 Alpine.
2. Copy `dist` to Nginx web root.
3. Serve on container port 80.
4. Expose host port 3000.

### Nginx routing

```text
/api/*       → api:8000/api/*
/docs        → api:8000/docs
/openapi.json→ api:8000/openapi.json
everything else → React index.html
```

`try_files` provides SPA route fallback.

### Persistent state

- PostgreSQL rows survive container recreation through `pgdata`.
- Legacy Joblib artifacts survive through `modeldata`.
- Browser watchlist survives normal reloads in LocalStorage.
- Backend in-memory forecast/scanner caches do not survive restart.

---

## 20. Security and reliability

### Existing protections

- Request shapes are validated by Pydantic.
- OHLCV limit is bounded at 10,000.
- Scanner limit is bounded at 50.
- Forecast horizons are allowlisted.
- SQL is constructed through SQLAlchemy rather than string concatenation.
- CORS origins are configured explicitly.
- Data archive is mounted read-only.
- Database health is exposed.
- API database dependency rolls back on exceptions.
- Nginx has a longer API read timeout for model fitting.

### Missing protections

- No authentication.
- No authorization.
- No rate limiting.
- No request quota for CPU-heavy forecasts.
- No CSRF design because there are no authenticated state-changing public API calls.
- No secret manager; local Compose credentials are hard-coded for development.
- No TLS termination in the included Compose setup.
- No security headers in Nginx.
- Broad API exceptions can expose internal exception strings in HTTP 500 details.

### Why no authentication is currently acceptable for the demo

The public API is read-only with respect to the product experience. Forecasts are computed but not
stored by the active engine. Browser watchlist writes remain local.

For an internet deployment, authentication is still useful for cost control, personal workspace
synchronization, and abuse prevention.

---

## 21. Known limitations

### Data limitations

1. Archive ends in April 2021.
2. No live ingestion.
3. No corporate-action adjustment pipeline.
4. No dividend-adjusted total return.
5. `INFRATEL.csv` has no observations.
6. No market index, macroeconomic, fundamental, options, or news features.
7. No NSE trading-calendar holiday library.

### Model limitations

1. Models are trained separately for every request rather than served from a versioned registry.
2. Probability is a residual-normal approximation.
3. Confidence is a heuristic composite.
4. Prediction intervals use empirical residual quantiles and a volatility guard, not conformal
   coverage guarantees.
5. Validation is a fixed recent holdout, not repeated rolling-origin retraining for the active
   forecast.
6. Hyperparameters are manually fixed for the active engine.
7. Scanner is a simpler model than the full forecast.
8. Scanner score weights are product choices rather than learned economic utility.
9. No transaction costs or slippage.
10. No regime-specific model refit.

### Runtime limitations

1. Cold forecast fitting is CPU intensive.
2. Scanner processes stocks sequentially.
3. Cache is local to one process.
4. No distributed task queue.
5. No persisted active forecast artifacts.
6. No cache invalidation based on bar content checksum.

### Frontend limitations

1. Watchlist does not sync across devices.
2. No user accounts.
3. Export is JSON only.
4. No saved comparison history.
5. Chart RSI differs from backend RSI.
6. No automated accessibility audit.
7. Google Fonts require internet access unless self-hosted.

### Legacy-code limitations

1. Unused routes increase maintenance surface.
2. Legacy horizon terminology differs from active horizons.
3. Legacy feature set includes raw price-level features pooled across stocks.
4. Legacy backtest can be in-sample.
5. CPU-heavy legacy training is performed inside an async background task without a dedicated
   worker queue.

---

## 22. How to explain the project during submission

## 22.1 Thirty-second explanation

> “Nexus is a historical NIFTY stock-intelligence platform. Daily OHLCV CSV data is cleaned into
> PostgreSQL. A FastAPI backend engineers 30 stationary market features and trains a Ridge,
> Random Forest, and Extra Trees regression ensemble for 5, 10, or 20-session cumulative returns.
> It uses chronological training, purged calibration, and held-out validation. React presents the
> result as a price path, risk range, scanner, market breadth view, stock comparison, capital
> stress-testing lab, watchlist, charts, and validation track record. The archive ends in 2021, so
> the product clearly labels every result as historical research rather than live advice.”

## 22.2 Two-minute architecture explanation

> “The system has three Docker services: PostgreSQL, FastAPI, and an Nginx-served React frontend.
> On the first startup, the backend reads individual CSVs with Pandas, normalizes historical
> ticker names using the filename, validates OHLC consistency, and upserts about 235,000 bars.
>
> “The public API is intentionally narrow: health, stock history, forecast, and scanner. When the
> frontend requests a forecast, the backend loads up to 2,600 bars for one stock, creates 30
> return, trend, volatility, momentum, volume, and drawdown features, and creates a direct
> cumulative-return target for every step in the chosen horizon.
>
> “History is split chronologically. A purge equal to the forecast horizon separates training
> from calibration and calibration from final validation. Ridge, Random Forest, and Extra Trees
> are weighted by calibration MAE. Validation provides direction accuracy, MAE, RMSE, interval
> coverage, and predicted-versus-actual observations. The models are refitted on all labelled
> history to create the archive-end forecast.
>
> “The frontend uses React Query for API state, Recharts for plots, URL state for shareable
> research views, and LocalStorage for a private watchlist. Market Pulse and Compare calculate
> additional analytics from public API data. Forecast Lab runs all horizons sequentially and
> translates ranges into user-controlled capital scenarios. It never claims the stale archive is
> a live market feed.”

## 22.3 Demonstration order

Use this order during a live demo:

1. Open **Market Pulse** to prove data is generated across the universe.
2. Change the horizon and show breadth/industry leadership update.
3. Open a leader in **AI Forecast**.
4. Explain path, range, scenarios, and held-out validation.
5. Star the stock.
6. Open **Compare** and contrast it with two peers.
7. Explain normalized price, volatility, drawdown, and correlation.
8. Open **Forecast Lab** for the leader.
9. Move capital, required-return, and loss-threshold sliders.
10. Switch between horizon cards.
11. Export the research brief.
12. Open **Track Record** and show predicted versus actual returns.
13. Finish on **Watchlist** and add a thesis price/note.

### What not to say

Avoid:

- “This predicts today’s market.”
- “The probability is guaranteed.”
- “The bull case will happen.”
- “The model uses ChatGPT.”
- “XGBoost powers the current forecast.”
- “The track record is from real forecasts saved since deployment.”
- “The backtest proves profitability.”

Prefer:

- “Archive-end historical forecast.”
- “Model-estimated probability under a residual approximation.”
- “Expected range.”
- “Held-out chronological validation.”
- “Research signal, not investment advice.”

---

## 23. Likely viva questions and answers

### Q1. Why did you choose FastAPI?

FastAPI provides typed request validation through Pydantic, automatic OpenAPI documentation,
async database dependencies, and concise route definitions. It is a good fit for Python ML code
because Pandas and scikit-learn are in the same runtime.

### Q2. Why PostgreSQL instead of reading CSVs on every request?

PostgreSQL provides indexed symbol/date queries, consistent canonical tickers, deduplication,
transactional import, and a foundation for future incremental ingestion. Re-reading dozens of
CSVs for every request would be slower and harder to validate.

### Q3. Why predict returns rather than prices?

Raw prices are nonstationary and scale-dependent. Returns are easier to compare across time and
stocks. The model predicts cumulative returns, and the API converts them back to prices for users.

### Q4. Why use three models?

Ridge provides a stable linear baseline. Random Forest captures nonlinear interactions. Extra
Trees adds more randomized nonlinear estimates. Calibration error determines which models deserve
more weight for a stock/horizon.

### Q5. Why not use an LSTM?

The archive is tabular daily data with limited observations per stock. Classical models are easier
to validate, faster to fit, more stable on small samples, and easier to explain. A deep sequence
model would add complexity without guaranteed improvement.

### Q6. What is data leakage?

Leakage occurs when training has information that would not have been available at prediction
time. Features use only current and past data. The active split also purges `H` rows so future
label windows do not overlap calibration or validation periods.

### Q7. Why is there a calibration set and a validation set?

Calibration chooses ensemble weights and residual intervals. Validation is then untouched by that
choice and estimates final historical performance. Using one set for both would make performance
look too optimistic.

### Q8. Is `probability_up` a classifier probability?

No. The active system is regression. It divides predicted final return by calibration residual
standard deviation and passes that z-score through the normal CDF. It is bounded for product
stability.

### Q9. How is confidence different from probability?

Probability estimates the chance the final return is above zero under the residual approximation.
Confidence is a product score combining probability strength, held-out direction accuracy, and an
error penalty.

### Q10. What does interval coverage mean?

It is the share of held-out actual returns that fell inside the expected lower and upper return
bounds. It measures whether the displayed range captured historical uncertainty.

### Q11. What is the scanner score?

It combines upside probability, validation accuracy, and a penalty for volatility above 35%. It
ranks stocks relative to each other; it is not itself a return.

### Q12. Why is the scanner model simpler?

The scanner must score every stock interactively. A regularized Ridge pass is much cheaper than a
three-model multi-output ensemble for every stock.

### Q13. Where is the watchlist stored?

In browser LocalStorage under `nexus.watchlist.v1`. It is private to that browser profile and does
not write to PostgreSQL.

### Q14. How does Compare calculate correlation?

It aligns daily close returns by date and calculates Pearson correlation for every selected pair.

### Q15. What is maximum drawdown?

The largest percentage decline from a prior running peak during the selected window.

### Q16. Does Forecast Lab create a new ML model?

No. It requests the existing backend forecast for each supported horizon, then applies transparent
client-side capital and normal-distribution sensitivity calculations.

### Q17. Why are Forecast Lab requests sequential?

Each cold backend forecast fits parallel tree ensembles. Sequential requests avoid running three
all-core jobs simultaneously.

### Q18. What are the most important data limitations?

The archive ends in 2021 and appears to contain unadjusted corporate-action jumps. A production
version needs a maintained data feed, adjusted prices, and an exchange calendar.

### Q19. Why does the repository contain XGBoost and SHAP if the UI does not use them?

They belong to an earlier classifier research interface. The current public router intentionally
does not expose that system. The current forecast uses Ridge, Random Forest, and Extra Trees
regression.

### Q20. What would you improve first?

1. Add adjusted, current market ingestion.
2. Persist versioned active forecast artifacts.
3. Add distributed caching and a task queue.
4. Add rolling-origin evaluation and probability calibration.
5. Add API, database, frontend, and end-to-end tests.
6. Add rate limiting and deployment security.

---

## 24. Glossary

### Annualized volatility

Daily return standard deviation multiplied by `sqrt(252)`, assuming roughly 252 trading sessions
per year.

### ATR

Average True Range. Measures price range while accounting for overnight gaps.

### Bias

Bullish, bearish, or neutral label derived from upside probability thresholds.

### Bollinger bands

A moving average plus/minus a multiple of rolling standard deviation. The model uses band width
and price position within the bands.

### Calibration

Using a held-out subset to choose ensemble weights and estimate residual behavior.

### Cumulative return

Percentage movement from time `t` to `t + H`, not the sum of independently predicted daily
returns.

### Drawdown

Loss from a prior running peak.

### Ensemble

Several models combined into one prediction.

### ETL

Extract, Transform, Load: read CSVs, clean/canonicalize them, and store them in PostgreSQL.

### Extra Trees

Extremely Randomized Trees; a tree ensemble with more randomized split choices than a standard
Random Forest.

### Feature

A numerical input derived from historical market data.

### Horizon

Number of future trading sessions being predicted.

### MAE

Mean Absolute Error. Average magnitude of prediction error.

### MACD

Difference between fast and slow exponential moving averages, commonly used as a momentum signal.

### Normal CDF

Maps a z-score to cumulative probability under a standard normal distribution.

### OHLCV

Open, High, Low, Close, Volume.

### Purge

A gap between chronological partitions that prevents overlapping future-label windows.

### Random Forest

An ensemble of decision trees trained on bootstrapped data and feature subsets.

### Ridge regression

Linear regression with L2 coefficient regularization.

### RMSE

Root Mean Squared Error. Penalizes larger errors more strongly than MAE.

### RSI

Relative Strength Index; compares recent average gains and losses.

### Scanner breadth

Share of scanner stocks with a positive expected return.

### SHAP

Shapley-value-based feature attribution. Present in the inactive classifier system.

### Stationary feature

A transformation intended to have a more stable statistical interpretation through time than a
raw price level.

### Target

The future value a model learns to predict.

### Validation

Evaluation on data not used for model fitting or calibration choices.

### VWAP

Volume-Weighted Average Price.

---

## Final summary

The most important fact to remember is that Nexus has an **active public regression product** and
an **inactive legacy classification research stack**.

The active system is:

```text
Historical OHLCV
→ 30 stationary market features
→ direct 5/10/20-step cumulative-return targets
→ Ridge + Random Forest + Extra Trees
→ purged train/calibration/validation
→ calibration-weighted ensemble
→ price path + range + probability + market context + held-out track record
→ interactive React research workspace
```

If you can explain that flow, the data limitations, and how Market Pulse, Compare, Forecast Lab,
Watchlist, and Track Record transform the public API responses, you understand the complete active
project.
