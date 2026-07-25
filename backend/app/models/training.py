"""Training job and model artifact ORM models."""

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TrainingJob(Base):
    __tablename__ = "training_jobs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", index=True)
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    progress: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    progress_detail: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    feature_run_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("feature_runs.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    models: Mapped[list["ModelArtifact"]] = relationship(back_populates="training_job")


class ModelArtifact(Base):
    __tablename__ = "model_artifacts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    algorithm: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    artifact_path: Mapped[str] = mapped_column(String(512), nullable=False)
    best_params: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    feature_names: Mapped[Optional[list[str]]] = mapped_column(JSONB, nullable=True)
    global_importance: Mapped[Optional[dict[str, float]]] = mapped_column(JSONB, nullable=True)
    feature_run_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("feature_runs.id", ondelete="SET NULL"), nullable=True
    )
    training_job_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("training_jobs.id", ondelete="SET NULL"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    meta: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    training_job: Mapped[Optional["TrainingJob"]] = relationship(back_populates="models")
    metrics: Mapped[list["ModelMetric"]] = relationship(
        back_populates="model", cascade="all, delete-orphan"
    )
    predictions: Mapped[list["Prediction"]] = relationship(back_populates="model")  # noqa: F821


class ModelMetric(Base):
    __tablename__ = "model_metrics"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    model_id: Mapped[int] = mapped_column(
        ForeignKey("model_artifacts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    fold: Mapped[int] = mapped_column(Integer, nullable=False, default=-1)  # -1 = aggregate
    accuracy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    precision: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    recall: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    f1: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    roc_auc: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    confusion_matrix: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    roc_curve: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    learning_curve: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    extra: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)

    model: Mapped["ModelArtifact"] = relationship(back_populates="metrics")
