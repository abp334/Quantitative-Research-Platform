"""Upgrade schema: progress_detail, model meta, prediction horizon, backtests

Revision ID: 002_upgrade
Revises: 001_initial
Create Date: 2026-07-25
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002_upgrade"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "training_jobs",
        sa.Column("progress_detail", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "model_artifacts",
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "predictions",
        sa.Column("prediction_horizon", sa.Integer(), nullable=True, server_default="1"),
    )
    op.add_column(
        "predictions",
        sa.Column("summary_text", sa.Text(), nullable=True),
    )
    op.create_table(
        "backtest_runs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("model_id", sa.Integer(), nullable=False),
        sa.Column("stock_id", sa.Integer(), nullable=False),
        sa.Column("confidence_threshold", sa.Float(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("prediction_horizon", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("metrics", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("equity_curve", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["model_id"], ["model_artifacts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["stock_id"], ["stocks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_backtest_runs_model_id", "backtest_runs", ["model_id"])
    op.create_index("ix_backtest_runs_stock_id", "backtest_runs", ["stock_id"])


def downgrade() -> None:
    op.drop_index("ix_backtest_runs_stock_id", table_name="backtest_runs")
    op.drop_index("ix_backtest_runs_model_id", table_name="backtest_runs")
    op.drop_table("backtest_runs")
    op.drop_column("predictions", "summary_text")
    op.drop_column("predictions", "prediction_horizon")
    op.drop_column("model_artifacts", "meta")
    op.drop_column("training_jobs", "progress_detail")
