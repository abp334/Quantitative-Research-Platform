"""Shared Pydantic schemas for the Quant Research Platform."""

from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    status: str
    app: str
    version: str
    database: str


class StockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    symbol: str
    company_name: Optional[str] = None
    industry: Optional[str] = None
    series: Optional[str] = None
    isin: Optional[str] = None


class OhlcvBarOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    date: date
    open: float
    high: float
    low: float
    close: float
    volume: int
    vwap: Optional[float] = None
    prev_close: Optional[float] = None
    turnover: Optional[float] = None
    trades: Optional[int] = None
    deliverable_volume: Optional[int] = None
    pct_deliverable: Optional[float] = None


class ImportRequest(BaseModel):
    force: bool = False


class ImportResponse(BaseModel):
    stocks_upserted: int
    bars_inserted: int
    bars_updated: int
    files_processed: int
    duration_seconds: float
    legacy_tickers_removed: list[str] = Field(default_factory=list)


class FeatureGenerateRequest(BaseModel):
    symbols: Optional[list[str]] = None
    name: str = "default"
    prediction_horizon: int = Field(default=1, ge=1, le=5)


class FeatureRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    status: str
    row_count: int
    symbol_count: int
    params: Optional[dict[str, Any]] = None
    created_at: datetime
    finished_at: Optional[datetime] = None


class FeatureRowOut(BaseModel):
    date: date
    features: dict[str, float]
    target: Optional[int] = None
    target_label: Optional[str] = None


class DatasetStatsOut(BaseModel):
    symbol: str
    row_count: int
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    missing_ohlc: int = 0
    outlier_count: int = 0
    mean_close: Optional[float] = None
    std_close: Optional[float] = None
    mean_volume: Optional[float] = None
    mean_daily_return: Optional[float] = None
    volatility_ann: Optional[float] = None


class TrainRequest(BaseModel):
    symbols: Optional[list[str]] = None
    feature_run_id: Optional[int] = None
    algorithms: list[str] = Field(
        default_factory=lambda: ["logistic_regression", "random_forest", "xgboost"]
    )
    optuna_trials: Optional[int] = None
    prediction_horizon: int = Field(default=1, ge=1, le=5)


class TrainingJobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    config: dict[str, Any]
    progress: Optional[str] = None
    progress_detail: Optional[dict[str, Any]] = None
    error_message: Optional[str] = None
    feature_run_id: Optional[int] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None


class ModelMetricOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    fold: int
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1: Optional[float] = None
    roc_auc: Optional[float] = None
    confusion_matrix: Optional[list] = None
    roc_curve: Optional[dict[str, Any]] = None
    learning_curve: Optional[dict[str, Any]] = None
    extra: Optional[dict[str, Any]] = None


class ModelArtifactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    algorithm: str
    best_params: Optional[dict[str, Any]] = None
    feature_names: Optional[list[str]] = None
    global_importance: Optional[dict[str, float]] = None
    feature_run_id: Optional[int] = None
    training_job_id: Optional[int] = None
    is_active: bool
    meta: Optional[dict[str, Any]] = None
    created_at: datetime
    metrics: list[ModelMetricOut] = Field(default_factory=list)
    rank: Optional[int] = None
    train_duration_seconds: Optional[float] = None
    prediction_horizon: Optional[int] = None


class ModelCompareOut(BaseModel):
    models: list[ModelArtifactOut]
    best_model_id: Optional[int] = None
    explanation: Optional[str] = None


class PredictRequest(BaseModel):
    symbol: str
    as_of_date: Optional[date] = None
    prediction_horizon: int = Field(default=1, ge=1, le=5)


class ShapContribution(BaseModel):
    feature: str
    value: float
    shap: float


class PredictionOut(BaseModel):
    id: int
    symbol: str
    as_of_date: date
    label: str
    probability_up: float
    confidence: float
    prediction_horizon: int = 1
    summary_text: Optional[str] = None


class ForecastRequest(BaseModel):
    symbol: str
    horizon_days: int = Field(default=10)


class ForecastPointOut(BaseModel):
    day: int
    date: date
    predicted_price: float
    lower_price: float
    upper_price: float
    predicted_return: float


class ForecastScenarioOut(BaseModel):
    label: str
    price: float
    return_: float = Field(alias="return")

    model_config = ConfigDict(populate_by_name=True)


class MarketFactorOut(BaseModel):
    name: str
    state: str
    score: float
    description: str


class MarketContextOut(BaseModel):
    regime: str
    risk_level: str
    annualized_volatility: float
    support: float
    resistance: float
    rsi: float
    volume_ratio: float


class ValidationPointOut(BaseModel):
    date: date
    predicted_return: float
    actual_return: float
    direction_correct: bool


class ForecastValidationOut(BaseModel):
    direction_accuracy: float
    mae_percent: float
    rmse_percent: float
    interval_coverage: float
    validation_samples: int
    recent: list[ValidationPointOut] = Field(default_factory=list)


class ForecastOut(BaseModel):
    symbol: str
    company_name: Optional[str] = None
    industry: Optional[str] = None
    as_of_date: date
    current_price: float
    horizon_days: int
    bias: str
    probability_up: float
    confidence: float
    expected_return: float
    target_price: float
    expected_low: float
    expected_high: float
    forecast_points: list[ForecastPointOut]
    scenarios: dict[str, ForecastScenarioOut]
    market_context: MarketContextOut
    factors: list[MarketFactorOut]
    narrative: str
    validation: ForecastValidationOut


class ScannerItemOut(BaseModel):
    symbol: str
    company_name: Optional[str] = None
    industry: Optional[str] = None
    as_of_date: date
    last_price: float
    expected_return: float
    probability_up: float
    validation_accuracy: float
    volatility: float
    score: float


class ExplainOut(BaseModel):
    prediction_id: int
    symbol: str
    label: str
    probability_up: float
    confidence: float
    prediction_horizon: int = 1
    summary_text: Optional[str] = None
    narrative: Optional[str] = None
    top_features: list[ShapContribution]
    positive_contributions: list[ShapContribution]
    negative_contributions: list[ShapContribution]
    waterfall: list[ShapContribution] = Field(default_factory=list)
    global_importance: Optional[dict[str, float]] = None


class ActivityItem(BaseModel):
    kind: str
    message: str
    created_at: Optional[datetime] = None
    ref_id: Optional[int] = None


class DashboardStats(BaseModel):
    stock_count: int
    bar_count: int
    feature_run_count: int
    model_count: int
    prediction_count: int
    average_accuracy: Optional[float] = None
    best_model: Optional[ModelArtifactOut] = None
    latest_feature_run: Optional[FeatureRunOut] = None
    latest_training_job: Optional[TrainingJobOut] = None
    latest_prediction: Optional[dict[str, Any]] = None
    recent_activity: list[ActivityItem] = Field(default_factory=list)
    system_status: str = "ok"


class ExperimentOut(BaseModel):
    id: int
    status: str
    config: dict[str, Any]
    progress: Optional[str] = None
    progress_detail: Optional[dict[str, Any]] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    models: list[ModelArtifactOut] = Field(default_factory=list)


class BacktestRequest(BaseModel):
    symbol: str
    model_id: int
    confidence_threshold: float = Field(default=0.25, ge=0.0, le=0.95)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    prediction_horizon: int = Field(default=1, ge=1, le=5)


class BacktestOut(BaseModel):
    id: int
    symbol: str
    model_id: int
    confidence_threshold: float
    prediction_horizon: int
    metrics: dict[str, Any]
    equity_curve: list[dict[str, Any]] = Field(default_factory=list)
    disclaimer: str = (
        "Illustrative evaluation tool only. Not financial advice. "
        "Past simulated performance does not guarantee future results."
    )


class InsightsOut(BaseModel):
    best_model: Optional[dict[str, Any]] = None
    easiest_stocks: list[dict[str, Any]] = Field(default_factory=list)
    hardest_stocks: list[dict[str, Any]] = Field(default_factory=list)
    top_features: list[dict[str, Any]] = Field(default_factory=list)
    average_confidence: Optional[float] = None
    label_distribution: dict[str, int] = Field(default_factory=dict)
    confidence_histogram: list[dict[str, Any]] = Field(default_factory=list)
    performance_over_time: list[dict[str, Any]] = Field(default_factory=list)
    feature_correlation: list[dict[str, Any]] = Field(default_factory=list)
    narrative: list[str] = Field(default_factory=list)
