"""Prediction ORM model."""

from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    model_id: Mapped[int] = mapped_column(
        ForeignKey("model_artifacts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stock_id: Mapped[int] = mapped_column(
        ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    as_of_date: Mapped[date] = mapped_column(Date, nullable=False)
    label: Mapped[str] = mapped_column(String(8), nullable=False)  # UP / DOWN
    probability_up: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    prediction_horizon: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=1)
    summary_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    shap_values: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    feature_snapshot: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    model: Mapped["ModelArtifact"] = relationship(back_populates="predictions")  # noqa: F821
    stock: Mapped["Stock"] = relationship(back_populates="predictions")  # noqa: F821
