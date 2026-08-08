# QuantVista — NIFTY Intelligence Platform

QuantVista is an advanced quantitative research and machine learning platform built to analyse, forecast, and stress-test NIFTY equity prices using multi-model regression ensembles, feature engineering, and real-time risk analytics.

---

## 🌟 Key Features

1. **AI Price Forecast Engine**
   - Multi-horizon forecasting (5, 10, and 20 trading sessions).
   - Ensembled predictions combining **Ridge Regression**, **Random Forest**, and **Extra Trees**.
   - Probabilistic bounds (bear / base / bull scenarios) and direction confidence scoring.

2. **Opportunity Scanner**
   - Cross-sectional ranking of NIFTY equities by expected return, directional probability, and volatility.
   - Filter by direction (bullish/bearish) or rank by custom quantitative metrics.

3. **Market Pulse & Sector Intelligence**
   - Market breadth monitoring (% of stocks with positive forward outlook).
   - Sector leadership breakdown and high-conviction signal aggregation.

4. **Multi-Asset Comparison**
   - Side-by-side performance normalization rebased to 100.
   - Realised risk, maximum drawdown, and correlation matrix analysis.

5. **Interactive Forecast Lab**
   - Capital scenario mapper: test custom investment capital against probabilistic price ranges.
   - Sensitivity analysis for required return targets and loss threshold breaches.

6. **Portfolio Simulator** *(New)*
   - Build custom virtual portfolios across NIFTY stocks with custom weightings.
   - Model combined expected return, annualised Sharpe ratio, Sortino ratio, and 95% Value at Risk (VaR).

7. **Risk Radar Dashboard** *(New)*
   - Systemic volatility heatmap across market sectors.
   - Tail-risk ranking and cross-asset risk distribution.

8. **Research Watchlist & Historical Backtest Track Record**
   - Track thesis notes and target prices.
   - Transparent backtest validation on unseen historical periods with direction hit-rates and RMSE.

---

## 🛠️ Technology Stack

### Backend
- **Framework**: Python, FastAPI, Pydantic v2
- **Database**: PostgreSQL (SQLAlchemy 2.0 Async ORM)
- **Machine Learning**: Scikit-Learn (Ridge, RandomForest, ExtraTrees), NumPy, Pandas
- **Task Runner**: Async background training & evaluation pipelines

### Frontend
- **Framework**: React 18, Vite, TypeScript
- **Styling**: Vanilla CSS (Professional Financial UI Design System), Tailwind CSS utilities
- **Visualization**: Recharts (Candlesticks, Fan Charts, Line & Volume Charts)
- **State & Data**: TanStack React Query, React Router v6

---

## 🚀 Quick Start (Docker)

Ensure Docker and Docker Compose are installed, then run:

```bash
docker compose up --build
```

- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:8000`
- **API Docs (Swagger UI)**: `http://localhost:8000/docs`

---

## 📚 Technical Architecture Documentation

Detailed technical architecture, mathematical formulations, and engineering notes are available in:
- [docs/ARCHITECTURE_AND_TECHNICAL_GUIDE.md](file:///Users/aayushpandya/Desktop/Java/%20VS%20Code%20Projects/Stock_Prediction_AI/docs/ARCHITECTURE_AND_TECHNICAL_GUIDE.md)

---

## ⚖️ Disclaimer

QuantVista is a quantitative research platform built for educational and demonstration purposes. Historical model predictions and backtest statistics are generated using archived data (~2021) and do not constitute financial advice.
