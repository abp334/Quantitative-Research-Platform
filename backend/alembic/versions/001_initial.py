"""Initial schema

Revision ID: 001_initial
Revises:
Create Date: 2026-07-25
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "stocks",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("symbol", sa.String(length=32), nullable=False),
        sa.Column("company_name", sa.String(length=255), nullable=True),
        sa.Column("industry", sa.String(length=128), nullable=True),
        sa.Column("series", sa.String(length=16), nullable=True),
        sa.Column("isin", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("symbol"),
    )
    op.create_index("ix_stocks_symbol", "stocks", ["symbol"])

    op.create_table(
        "ohlcv_bars",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("stock_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("prev_close", sa.Numeric(18, 4), nullable=True),
        sa.Column("open", sa.Numeric(18, 4), nullable=False),
        sa.Column("high", sa.Numeric(18, 4), nullable=False),
        sa.Column("low", sa.Numeric(18, 4), nullable=False),
        sa.Column("last", sa.Numeric(18, 4), nullable=True),
        sa.Column("close", sa.Numeric(18, 4), nullable=False),
        sa.Column("vwap", sa.Numeric(18, 4), nullable=True),
        sa.Column("volume", sa.BigInteger(), nullable=False),
        sa.Column("turnover", sa.Numeric(24, 4), nullable=True),
        sa.Column("trades", sa.BigInteger(), nullable=True),
        sa.Column("deliverable_volume", sa.BigInteger(), nullable=True),
        sa.Column("pct_deliverable", sa.Numeric(10, 6), nullable=True),
        sa.ForeignKeyConstraint(["stock_id"], ["stocks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("stock_id", "date", name="uq_ohlcv_stock_date"),
    )
    op.create_index("ix_ohlcv_symbol_date", "ohlcv_bars", ["stock_id", "date"])

    op.create_table(
        "feature_runs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("symbol_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("params", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "features",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("feature_run_id", sa.Integer(), nullable=False),
        sa.Column("stock_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("features", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("target", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["feature_run_id"], ["feature_runs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["stock_id"], ["stocks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("feature_run_id", "stock_id", "date", name="uq_feature_run_stock_date"),
    )
    op.create_index("ix_features_feature_run_id", "features", ["feature_run_id"])
    op.create_index("ix_features_stock_id", "features", ["stock_id"])

    op.create_table(
        "training_jobs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("progress", sa.String(length=255), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("feature_run_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["feature_run_id"], ["feature_runs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_training_jobs_status", "training_jobs", ["status"])

    op.create_table(
        "model_artifacts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("algorithm", sa.String(length=64), nullable=False),
        sa.Column("artifact_path", sa.String(length=512), nullable=False),
        sa.Column("best_params", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("feature_names", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("global_importance", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("feature_run_id", sa.Integer(), nullable=True),
        sa.Column("training_job_id", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["feature_run_id"], ["feature_runs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["training_job_id"], ["training_jobs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_model_artifacts_algorithm", "model_artifacts", ["algorithm"])

    op.create_table(
        "model_metrics",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("model_id", sa.Integer(), nullable=False),
        sa.Column("fold", sa.Integer(), nullable=False),
        sa.Column("accuracy", sa.Float(), nullable=True),
        sa.Column("precision", sa.Float(), nullable=True),
        sa.Column("recall", sa.Float(), nullable=True),
        sa.Column("f1", sa.Float(), nullable=True),
        sa.Column("roc_auc", sa.Float(), nullable=True),
        sa.Column("confusion_matrix", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("roc_curve", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("learning_curve", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("extra", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["model_id"], ["model_artifacts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_model_metrics_model_id", "model_metrics", ["model_id"])

    op.create_table(
        "predictions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("model_id", sa.Integer(), nullable=False),
        sa.Column("stock_id", sa.Integer(), nullable=False),
        sa.Column("as_of_date", sa.Date(), nullable=False),
        sa.Column("label", sa.String(length=8), nullable=False),
        sa.Column("probability_up", sa.Float(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("shap_values", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("feature_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["model_id"], ["model_artifacts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["stock_id"], ["stocks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_predictions_model_id", "predictions", ["model_id"])
    op.create_index("ix_predictions_stock_id", "predictions", ["stock_id"])


def downgrade() -> None:
    op.drop_table("predictions")
    op.drop_table("model_metrics")
    op.drop_table("model_artifacts")
    op.drop_table("training_jobs")
    op.drop_table("features")
    op.drop_table("feature_runs")
    op.drop_table("ohlcv_bars")
    op.drop_table("stocks")
