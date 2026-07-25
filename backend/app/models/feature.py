"""Feature engineering ORM models."""

from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class FeatureRun(Base):
    __tablename__ = "feature_runs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    row_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    symbol_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    params: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    feature_rows: Mapped[list["FeatureRow"]] = relationship(
        back_populates="feature_run", cascade="all, delete-orphan"
    )


class FeatureRow(Base):
    __tablename__ = "features"
    __table_args__ = (
        UniqueConstraint("feature_run_id", "stock_id", "date", name="uq_feature_run_stock_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    feature_run_id: Mapped[int] = mapped_column(
        ForeignKey("feature_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stock_id: Mapped[int] = mapped_column(
        ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    features: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    target: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 1=UP, 0=DOWN

    feature_run: Mapped["FeatureRun"] = relationship(back_populates="feature_rows")
    stock: Mapped["Stock"] = relationship(back_populates="feature_rows")  # noqa: F821
