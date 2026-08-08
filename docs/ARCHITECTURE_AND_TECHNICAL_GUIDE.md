# QuantVista — Comprehensive Architecture & Technical Reference Guide

This document is a technical architecture reference guide for **QuantVista — NIFTY Intelligence Platform**.

---

## 1. Executive Summary

**QuantVista** is a full-stack quantitative equity research and machine learning platform. It is designed to analyse Indian stock market data (NIFTY 50 universe), perform feature engineering on price/volume series, train ensemble regression models, and present actionable forecasts, portfolio simulations, and risk analytics through a professional financial user interface.

### Core Value Proposition
- **Ensemble Machine Learning**: Combines linear models (Ridge) with non-linear decision trees (Random Forest, Extra Trees) to forecast future return trajectories.
- **Uncertainty & Scenario Modeling**: Generates probabilistic scenario bands (Bear, Base, Bull) rather than point estimates alone.
- **Empirical Backtesting**: Out-of-sample historical validation reporting Directional Accuracy, MAE, RMSE, and Interval Coverage.
- **Portfolio & Risk Analytics**: Real-time Sharpe Ratio, Sortino Ratio, and 95% Value at Risk (VaR) portfolio modeling.

---

## 2. System Architecture

The platform follows a decoupled client-server architecture:

```
┌────────────────────────────────────────────────────────┐
│               Frontend: React 18 + Vite                │
│ (Inter Font, Financial UI, Recharts, React Query)      │
└───────────────────────────┬────────────────────────────┘
                            │ REST / JSON
┌───────────────────────────▼────────────────────────────┐
│                Backend: FastAPI Server                 │
│  ├── API V1 Routers (/forecast, /scanner, /ohlcv)      │
│  ├── Services Layer (ForecastService, TrainingService) │
│  └── ML Engine (Feature Engineering, Ensemble Model)   │
└───────────────────────────┬────────────────────────────┘
                            │ Async ORM (AsyncPG)
┌───────────────────────────▼────────────────────────────┐
│            Database: PostgreSQL + SQLAlchemy           │
│   (Stocks, Daily OHLCV, Model Metadata, Predictions)   │
└────────────────────────────────────────────────────────┘
```

---

## 3. Machine Learning Architecture

### 3.1 Model Formulation
Target variable: **Forward Return over $H$ trading sessions**:
$$R_{t, H} = \frac{P_{t+H} - P_t}{P_t}$$

Where $P_t$ is the close price on day $t$, and $H \in \{5, 10, 20\}$.

### 3.2 Feature Engineering Pipeline
The system computes 30+ quantitative technical features from raw daily OHLCV bars:
- **Momentum & Relative Strength**:
  - Relative Strength Index (RSI - 14 period)
  - Rate of Change (ROC - 5, 10, 20 period)
  - Stochastic Oscillators (%K, %D)
- **Moving Averages & Trend**:
  - Simple Moving Average Ratios: $P_t / \text{SMA}_{20}$, $P_t / \text{SMA}_{50}$, $P_t / \text{SMA}_{200}$
  - Exponential Moving Average (EMA) Crosses
  - MACD Histogram and Signal Line
- **Volatility & Dispersion**:
  - Annualised Volatility: $\sigma_{\text{ann}} = \sigma_{\text{daily}} \times \sqrt{252}$
  - Average True Range (ATR - 14 period)
  - Bollinger Bands %B and Band Width
- **Volume & Flow**:
  - Volume Moving Average Ratio: $V_t / \text{VMA}_{20}$
  - On-Balance Volume (OBV) trend

### 3.3 Ensemble Architecture
To prevent overfitting and capture both linear and non-linear market regimes, an **Ensemble Estimator** combines three models:
1. **Ridge Regression (L2 Regularized)**: Captures linear feature relationships while penalizing large weights.
2. **Random Forest Regressor**: Captures non-linear feature interactions with bagging.
3. **Extra Trees (Extremely Randomized Trees)**: Adds extra variance reduction by randomizing cut points.

The final forecast $\hat{R}_{t, H}$ is a weighted average of individual estimator predictions:
$$\hat{R} = w_1 \hat{R}_{\text{Ridge}} + w_2 \hat{R}_{\text{RF}} + w_3 \hat{R}_{\text{ET}}$$

### 3.4 Scenario & Range Generation
- **Base Target Price**: $\hat{P}_{t+H} = P_t \times (1 + \hat{R})$
- **Bear Scenario**: $P_t \times (1 + \hat{R} - 1.2816 \times \sigma_{\text{RMSE}})$ (Approx. 10th percentile)
- **Bull Scenario**: $P_t \times (1 + \hat{R} + 1.2816 \times \sigma_{\text{RMSE}})$ (Approx. 90th percentile)
- **Directional Probability**: Computed using standard Normal Cumulative Distribution Function $\Phi\left(\frac{\hat{R}}{\sigma_{\text{RMSE}}}\right)$.

---

## 4. Portfolio Risk Analytics (New Module)

QuantVista implements portfolio analytics computed client-side using forecast and historical data:

### 4.1 Sharpe Ratio
$$\text{Sharpe} = \frac{R_p - R_f}{\sigma_p}$$
Where $R_p$ is annualised portfolio return, $R_f = 6.5\%$ (risk-free rate), and $\sigma_p$ is annualised portfolio volatility.

### 4.2 Sortino Ratio
$$\text{Sortino} = \frac{R_p - R_f}{\sigma_d}$$
Where $\sigma_d$ is downside deviation (volatility of negative returns only).

### 4.3 Value at Risk (95% VaR)
$$\text{VaR}_{95\%} = \text{Capital} \times \left( \frac{\sigma_p}{\sqrt{252 / H}} \right) \times 1.645$$

---

## 5. Database Schema & ORM

1. **`stocks` Table**: Master registry of tracked equities (`symbol`, `company_name`, `industry`, `sector`).
2. **`ohlcv` Table**: Historical daily bars (`stock_id`, `date`, `open`, `high`, `low`, `close`, `volume`). Indexed on `(stock_id, date)`.
3. **`ml_models` Table**: Registry of trained model artifacts, parameters, and held-out validation metrics.
4. **`predictions` Table**: Stored historical predictions for backtest evaluation.

---

## 6. Project Viva Q&A Guide

### Q1: What problem does this project solve?
**Answer**: Traditional stock market UIs either present raw retrospective charts or generic AI predictions without validation. QuantVista provides quantitative multi-horizon price forecasting backed by out-of-sample backtest validation, multi-model ensemble learning, scenario modeling, and portfolio risk analytics.

### Q2: Why use an ensemble of Ridge, Random Forest, and Extra Trees?
**Answer**: Financial market data exhibits high noise-to-signal ratios. A single model easily overfits. Ridge handles linear relationships with L2 regularization; Random Forest captures non-linear interactions; Extra Trees reduces variance further by randomizing splits. Combining them creates a robust prediction.

### Q3: How do you prevent data leakage in time series forecasting?
**Answer**: All features use strict historical shifting (lagging). Feature transformation parameters (e.g. scalers) are fit exclusively on training data windows and applied to validation/test sets without looking ahead. Evaluation uses chronological walk-forward splits.

### Q4: How is directional accuracy calculated?
**Answer**: It measures the proportion of times the predicted return sign $\text{sign}(\hat{R})$ matches the actual return sign $\text{sign}(R_{\text{actual}})$ over out-of-sample historical periods:
$$\text{Accuracy} = \frac{1}{N} \sum_{i=1}^N \mathbb{I}(\text{sign}(\hat{R}_i) == \text{sign}(R_{i, \text{actual}}))$$

### Q5: Explain the difference between MAE and RMSE in your evaluation.
**Answer**: MAE (Mean Absolute Error) measures average magnitude of return prediction error. RMSE (Root Mean Squared Error) penalizes larger errors more heavily. A high RMSE relative to MAE indicates occasional large prediction misses.

### Q6: What is the significance of the 95% Value at Risk (VaR)?
**Answer**: 95% VaR estimates the maximum expected loss over a given holding horizon under normal market conditions at a 95% confidence level. For instance, a 10-day 95% VaR of ₹45,000 means there is only a 5% chance of losing more than ₹45,000 over 10 sessions.

### Q7: Why is FastAPI chosen over Flask/Django for backend?
**Answer**: FastAPI provides asynchronous I/O with `asyncio`, automatic schema validation via Pydantic, high throughput performance matching NodeJS/Go, and native OpenAPI (Swagger) documentation generation out of the box.

### Q8: How is the database configured for high performance?
**Answer**: PostgreSQL is accessed via SQLAlchemy 2.0 Async engine with `asyncpg`. Composite indexes are placed on `(stock_id, date)` for instant range scans on daily price series.

### Q9: How does the frontend handle stale data gracefully?
**Answer**: The UI includes prominent historical data notices showing the exact `as_of_date` of the dataset (~April 2021) and uses TanStack React Query for caching, automatic background refetching, and error boundaries.

### Q10: What makes the UI suitable for financial professionals?
**Answer**: The UI uses a clean, data-dense dark layout (Inter typography, Fira Code for numbers, high contrast green/red indicators) modeled after real trading platforms (Zerodha Kite, TradingView, Bloomberg) rather than flashy generic SaaS aesthetics.

---

## 7. Verification & Run Commands

```bash
# Start full application via Docker
docker compose up --build

# Run backend unit tests
cd backend && python -m pytest tests/ -v

# Verify frontend compile
cd frontend && npm run build
```
