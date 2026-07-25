"""PDF research report generation with ReportLab."""

from __future__ import annotations

import io
from datetime import datetime, timezone
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.dashboard_service import DashboardService
from app.services.insights_service import InsightsService
from app.repositories import TrainingRepository


class ReportService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.dashboard = DashboardService(session)
        self.insights = InsightsService(session)
        self.training = TrainingRepository(session)

    async def build_pdf(self) -> bytes:
        stats = await self.dashboard.stats()
        insights = await self.insights.build()
        models = await self.training.list_models()

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, title="Nexus Quant Research Report")
        styles = getSampleStyleSheet()
        title = ParagraphStyle(
            "TitleCustom",
            parent=styles["Title"],
            textColor=colors.HexColor("#0d1524"),
            spaceAfter=12,
        )
        h2 = ParagraphStyle("H2", parent=styles["Heading2"], spaceBefore=14, spaceAfter=8)
        body = styles["BodyText"]

        story: list[Any] = []
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        story.append(Paragraph("Nexus Quant — Research Report", title))
        story.append(Paragraph(f"Generated {now}", body))
        story.append(Spacer(1, 0.2 * inch))

        story.append(Paragraph("1. Executive Summary", h2))
        story.append(
            Paragraph(
                "This report summarizes an explainable quantitative research platform for "
                "NIFTY-50 equities. Models predict directional moves using classical ML "
                "(Logistic Regression, Random Forest, XGBoost) with walk-forward validation "
                "and SHAP explanations. This is research software, not investment advice.",
                body,
            )
        )
        for line in insights.narrative:
            story.append(Paragraph(f"• {line}", body))

        story.append(Paragraph("2. Dataset Overview", h2))
        story.append(
            Paragraph(
                f"Universe: {stats.stock_count} stocks · {stats.bar_count:,} OHLCV bars · "
                f"{stats.feature_run_count} feature runs.",
                body,
            )
        )

        story.append(Paragraph("3. Feature Engineering", h2))
        story.append(
            Paragraph(
                "Indicators (manual NumPy/Pandas, no TA-Lib): SMA, EMA, RSI, MACD, ATR, "
                "Bollinger Bands, momentum, ROC, rolling volatility, returns, lag features, "
                "volume/price changes. Target = Close[t+h] > Close[t] for horizon h ∈ {1,3,5}.",
                body,
            )
        )

        story.append(Paragraph("4. Model Comparison", h2))
        table_data = [["Algorithm", "Accuracy", "Precision", "Recall", "F1", "ROC AUC"]]
        for m in models:
            agg = next((x for x in (m.metrics or []) if x.fold == -1), None)
            if not agg:
                continue
            table_data.append(
                [
                    m.algorithm,
                    _fmt(agg.accuracy),
                    _fmt(agg.precision),
                    _fmt(agg.recall),
                    _fmt(agg.f1),
                    _fmt(agg.roc_auc),
                ]
            )
        if len(table_data) > 1:
            table = Table(table_data, hAlign="LEFT")
            table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#121c2e")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
                        ("FONTSIZE", (0, 0), (-1, -1), 8),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.lightgrey]),
                    ]
                )
            )
            story.append(table)

        story.append(Paragraph("5. Hyperparameters", h2))
        for m in models[:5]:
            story.append(
                Paragraph(
                    f"<b>{m.algorithm}</b>: {m.best_params or '{}'}",
                    body,
                )
            )

        story.append(Paragraph("6. Evaluation Metrics", h2))
        story.append(
            Paragraph(
                f"Average accuracy across models: {_fmt(stats.average_accuracy)}. "
                "Metrics come from expanding-window walk-forward validation (never random splits).",
                body,
            )
        )

        story.append(Paragraph("7. SHAP Analysis", h2))
        if insights.top_features:
            top = ", ".join(f"{f['feature']}" for f in insights.top_features[:5])
            story.append(Paragraph(f"Top global drivers: {top}.", body))
        else:
            story.append(Paragraph("Train models to populate global SHAP importance.", body))

        story.append(Paragraph("8. Prediction Results", h2))
        if stats.latest_prediction:
            lp = stats.latest_prediction
            story.append(
                Paragraph(
                    f"Latest: {lp.get('symbol')} → {lp.get('label')} "
                    f"(P(UP)={lp.get('probability_up')}, conf={lp.get('confidence')}). "
                    f"{lp.get('summary_text') or ''}",
                    body,
                )
            )
        else:
            story.append(Paragraph("No predictions recorded yet.", body))

        story.append(Paragraph("9. Research Insights", h2))
        story.append(
            Paragraph(
                f"Average prediction confidence: {_fmt(insights.average_confidence)}. "
                f"Label mix: {insights.label_distribution}.",
                body,
            )
        )

        story.append(Paragraph("10. Conclusion & Future Improvements", h2))
        story.append(
            Paragraph(
                "The platform demonstrates production-minded ML engineering: clean ETL, "
                "leakage-aware features, walk-forward evaluation, Optuna tuning, and "
                "explainability. Future work may include richer cross-sectional features, "
                "regime detection, and broader equity universes — still without deep-learning "
                "black boxes.",
                body,
            )
        )

        doc.build(story)
        return buffer.getvalue()


def _fmt(v: float | None) -> str:
    if v is None:
        return "—"
    return f"{v:.3f}"
