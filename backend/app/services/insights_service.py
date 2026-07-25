"""Research insights aggregation (template narratives, no LLMs)."""

from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any

import numpy as np
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ml.features.indicators import FEATURE_COLUMNS
from app.models import Prediction
from app.repositories import FeatureRepository, StockRepository, TrainingRepository
from app.schemas import InsightsOut
from app.services.nl_templates import best_model_explanation


class InsightsService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.training = TrainingRepository(session)
        self.stocks = StockRepository(session)
        self.features = FeatureRepository(session)

    async def build(self) -> InsightsOut:
        models = await self.training.list_models()
        ranked_rows: list[dict[str, Any]] = []
        for m in models:
            agg = next((x for x in (m.metrics or []) if x.fold == -1), None)
            if not agg:
                continue
            ranked_rows.append(
                {
                    "id": m.id,
                    "algorithm": m.algorithm,
                    "accuracy": agg.accuracy,
                    "precision": agg.precision,
                    "recall": agg.recall,
                    "f1": agg.f1,
                    "roc_auc": agg.roc_auc,
                    "train_duration_seconds": (m.meta or {}).get("train_duration_seconds"),
                }
            )
        ranked_rows.sort(
            key=lambda r: (
                r.get("roc_auc") if r.get("roc_auc") is not None else -1,
                r.get("f1") if r.get("f1") is not None else -1,
            ),
            reverse=True,
        )

        # Prediction archive analysis
        result = await self.session.execute(
            select(Prediction)
            .options(selectinload(Prediction.stock))
            .order_by(desc(Prediction.created_at))
            .limit(500)
        )
        preds = list(result.scalars().all())

        label_dist = Counter(p.label for p in preds)
        confidences = [p.confidence for p in preds]
        avg_conf = float(np.mean(confidences)) if confidences else None

        hist_bins = [0, 0.2, 0.4, 0.6, 0.8, 1.01]
        hist = []
        for i in range(len(hist_bins) - 1):
            lo, hi = hist_bins[i], hist_bins[i + 1]
            count = sum(1 for c in confidences if lo <= c < hi)
            hist.append({"bin": f"{lo:.1f}-{min(hi, 1.0):.1f}", "count": count})

        # Per-symbol confidence as proxy for "easiness"
        by_symbol: dict[str, list[float]] = defaultdict(list)
        for p in preds:
            if p.stock:
                by_symbol[p.stock.symbol].append(p.confidence)
        symbol_scores = [
            {"symbol": s, "avg_confidence": float(np.mean(v)), "n": len(v)}
            for s, v in by_symbol.items()
            if len(v) >= 1
        ]
        symbol_scores.sort(key=lambda x: x["avg_confidence"], reverse=True)
        easiest = symbol_scores[:5]
        hardest = list(reversed(symbol_scores[-5:])) if symbol_scores else []

        # Global feature importance across models
        feature_scores: dict[str, float] = defaultdict(float)
        for m in models:
            imp = m.global_importance or {}
            for k, v in imp.items():
                feature_scores[k] += float(v)
        top_features = [
            {"feature": k, "importance": v}
            for k, v in sorted(feature_scores.items(), key=lambda kv: kv[1], reverse=True)[:15]
        ]

        # Performance over training jobs
        jobs = []
        for m in models:
            agg = next((x for x in (m.metrics or []) if x.fold == -1), None)
            if agg and m.created_at:
                jobs.append(
                    {
                        "date": m.created_at.isoformat(),
                        "algorithm": m.algorithm,
                        "roc_auc": agg.roc_auc,
                        "accuracy": agg.accuracy,
                        "model_id": m.id,
                    }
                )
        jobs.sort(key=lambda j: j["date"])

        # Lightweight feature correlation from latest feature run sample
        feature_correlation: list[dict[str, Any]] = []
        run = await self.features.latest_run()
        if run:
            stocks = await self.stocks.list_stocks()
            if stocks:
                rows = await self.features.get_features_for_symbol(run.id, stocks[0].id, limit=200)
                if len(rows) > 30:
                    cols = FEATURE_COLUMNS[:8]
                    mat = np.array([[r.features.get(c, np.nan) for c in cols] for r in rows], dtype=float)
                    mask = np.isfinite(mat).all(axis=1)
                    mat = mat[mask]
                    if len(mat) > 20:
                        corr = np.corrcoef(mat.T)
                        for i, a in enumerate(cols):
                            for j, b in enumerate(cols):
                                if i < j:
                                    feature_correlation.append(
                                        {
                                            "feature_a": a,
                                            "feature_b": b,
                                            "correlation": float(corr[i, j]),
                                        }
                                    )
                        feature_correlation.sort(key=lambda x: abs(x["correlation"]), reverse=True)
                        feature_correlation = feature_correlation[:20]

        narrative = [
            best_model_explanation(ranked_rows),
        ]
        if easiest:
            narrative.append(
                f"{easiest[0]['symbol']} posts the highest average model conviction "
                f"({easiest[0]['avg_confidence']:.1%}) in the prediction archive — "
                f"P(UP) is usually farthest from 0.5 (n={easiest[0]['n']}). "
                f"This is decisiveness, not verified hit-rate."
            )
        if hardest:
            narrative.append(
                f"{hardest[0]['symbol']} shows the lowest average conviction "
                f"({hardest[0]['avg_confidence']:.1%}); scores cluster near a coin flip "
                f"(n={hardest[0]['n']}). Candidate for feature or regime review."
            )
        if top_features:
            top = top_features[0]["feature"]
            narrative.append(
                f"Across trained artifacts, {top} has the largest aggregated mean |SHAP| / "
                f"importance — primary technical factor the classifiers rely on."
            )
        if avg_conf is not None and label_dist:
            up = label_dist.get("UP", 0)
            down = label_dist.get("DOWN", 0)
            total = up + down
            if total:
                narrative.append(
                    f"Archive label mix is {up / total:.0%} UP / {down / total:.0%} DOWN "
                    f"with mean conviction {avg_conf:.1%} across {total} predictions."
                )

        return InsightsOut(
            best_model=ranked_rows[0] if ranked_rows else None,
            easiest_stocks=easiest,
            hardest_stocks=hardest,
            top_features=top_features,
            average_confidence=avg_conf,
            label_distribution=dict(label_dist),
            confidence_histogram=hist,
            performance_over_time=jobs,
            feature_correlation=feature_correlation,
            narrative=narrative,
        )
