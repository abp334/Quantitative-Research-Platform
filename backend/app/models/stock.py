"""Stock and OHLCV ORM models."""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Stock(Base):
    __tablename__ = "stocks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    company_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    industry: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    series: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    isin: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    bars: Mapped[list["OhlcvBar"]] = relationship(back_populates="stock", cascade="all, delete-orphan")
    feature_rows: Mapped[list["FeatureRow"]] = relationship(back_populates="stock")  # noqa: F821
    predictions: Mapped[list["Prediction"]] = relationship(back_populates="stock")  # noqa: F821


class OhlcvBar(Base):
    __tablename__ = "ohlcv_bars"
    __table_args__ = (
        UniqueConstraint("stock_id", "date", name="uq_ohlcv_stock_date"),
        Index("ix_ohlcv_symbol_date", "stock_id", "date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    stock_id: Mapped[int] = mapped_column(ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    prev_close: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    open: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    high: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    low: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    last: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    close: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    vwap: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    volume: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    turnover: Mapped[Optional[Decimal]] = mapped_column(Numeric(24, 4), nullable=True)
    trades: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    deliverable_volume: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    pct_deliverable: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 6), nullable=True)

    stock: Mapped["Stock"] = relationship(back_populates="bars")
