"""Prediction and explainability service."""

from __future__ import annotations

from datetime import date
from typing import Any, Optional

import joblib
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.ml.explainability.shap_explain import explain_prediction
from app.ml.features.indicators import FEATURE_COLUMNS
from app.models import Prediction
from app.repositories import (
    FeatureRepository,
    PredictionRepository,
    StockRepository,
    TrainingRepository,
)
from app.services.feature_service import ALLOWED_HORIZONS, FeatureService
from app.services.nl_templates import prediction_summary, shap_narrative

logger = get_logger(__name__)


class PredictionService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.stocks = StockRepository(session)
        self.features = FeatureRepository(session)
        self.training = TrainingRepository(session)
        self.predictions = PredictionRepository(session)
        self.feature_service = FeatureService(session)

    async def _select_best_model(self, prediction_horizon: int):
        models = await self.training.list_models()
        candidates = []
        for m in models:
            if not m.is_active:
                continue
            meta = m.meta or {}
            h = int(meta.get("prediction_horizon", 1))
            if h != prediction_horizon:
                continue
            agg = next((x for x in (m.metrics or []) if x.fold == -1), None)
            score = agg.roc_auc if agg and agg.roc_auc is not None else -1.0
            f1 = agg.f1 if agg and agg.f1 is not None else -1.0
            candidates.append((score, f1, m))
        if not candidates:
            return await self.training.get_active_model()
        candidates.sort(key=lambda t: (t[0], t[1]), reverse=True)
        return candidates[0][2]

    async def _load_feature_rows(
        self,
        stock_id: int,
        symbol: str,
        preferred_run_id: Optional[int],
        horizon: int,
    ):
        """Load feature rows for a stock; generate on-demand if missing from the model run."""
        if preferred_run_id is not None:
            rows = await self.features.get_features_for_symbol(preferred_run_id, stock_id)
            if rows:
                return rows, preferred_run_id

        # Symbol was not part of the training feature run (e.g. only 4–5 symbols trained).
        # Generate a dedicated feature set for inference with the same horizon.
        logger.info(
            "No features for %s on run %s — generating horizon=%s features for inference",
            symbol,
            preferred_run_id,
            horizon,
        )
        result = await self.feature_service.generate(
            name=f"infer_{symbol}_h{horizon}",
            symbols=[symbol],
            prediction_horizon=horizon,
        )
        run_id = int(result["id"])
        rows = await self.features.get_features_for_symbol(run_id, stock_id)
        if not rows:
            raise ValueError(
                f"Could not build features for {symbol}. "
                "Ensure OHLCV history exists and try again."
            )
        return rows, run_id

    async def predict(
        self,
        symbol: str,
        model_id: Optional[int] = None,
        as_of_date: Optional[date] = None,
        prediction_horizon: int = 1,
        auto_select: bool = True,
    ) -> dict[str, Any]:
        if prediction_horizon not in ALLOWED_HORIZONS:
            raise ValueError(f"prediction_horizon must be one of {sorted(ALLOWED_HORIZONS)}")

        stock = await self.stocks.get_by_symbol(symbol)
        if not stock:
            raise ValueError(f"Stock not found: {symbol}")

        if model_id is not None:
            artifact = await self.training.get_model(model_id)
        else:
            artifact = await self._select_best_model(prediction_horizon)
        if not artifact:
            raise ValueError("No trained model available. Train models first.")

        meta = artifact.meta or {}
        horizon = int(meta.get("prediction_horizon", prediction_horizon))

        run_id = artifact.feature_run_id
        if run_id is None:
            run = await self.features.latest_run()
            if run:
                run_id = run.id

        rows, _ = await self._load_feature_rows(stock.id, stock.symbol, run_id, horizon)

        if as_of_date:
            candidates = [r for r in rows if r.date <= as_of_date]
            if not candidates:
                raise ValueError(f"No features on or before {as_of_date}")
            row = candidates[-1]
        else:
            row = rows[-1]

        feature_names = artifact.feature_names or FEATURE_COLUMNS
        X_row = np.array([[row.features[c] for c in feature_names]], dtype=float)

        payload = joblib.load(artifact.artifact_path)
        model = payload["model"]
        algorithm = payload["algorithm"]
        background = payload.get("background_X")

        proba_up = float(model.predict_proba(X_row)[0, 1])
        label = "UP" if proba_up >= 0.5 else "DOWN"
        confidence = abs(proba_up - 0.5) * 2.0

        try:
            explanation = explain_prediction(
                model=model,
                algorithm=algorithm,
                X_row=X_row,
                feature_names=feature_names,
                background=background,
            )
        except Exception:
            logger.exception("SHAP explanation failed; returning empty contributions")
            explanation = {
                "top_features": [],
                "positive_contributions": [],
                "negative_contributions": [],
                "all_contributions": [],
            }

        summary = prediction_summary(
            symbol=stock.symbol,
            label=label,
            probability_up=proba_up,
            confidence=confidence,
            algorithm=algorithm,
            horizon=horizon,
            top_features=explanation.get("top_features", []),
        )
        explanation["narrative"] = shap_narrative(explanation.get("top_features", []))
        explanation["waterfall"] = explanation.get("top_features", [])[:12]

        prediction = Prediction(
            model_id=artifact.id,
            stock_id=stock.id,
            as_of_date=row.date,
            label=label,
            probability_up=proba_up,
            confidence=confidence,
            prediction_horizon=horizon,
            summary_text=summary,
            shap_values=explanation,
            feature_snapshot=row.features,
        )
        await self.predictions.save(prediction)
        await self.session.commit()

        return {
            "id": prediction.id,
            "model_id": artifact.id,
            "model_algorithm": algorithm,
            "symbol": stock.symbol,
            "as_of_date": prediction.as_of_date,
            "label": label,
            "probability_up": proba_up,
            "confidence": confidence,
            "prediction_horizon": horizon,
            "summary_text": summary,
            "top_features": explanation["top_features"],
            "positive_contributions": explanation["positive_contributions"],
            "negative_contributions": explanation["negative_contributions"],
            "waterfall": explanation["waterfall"],
            "narrative": explanation["narrative"],
        }

    async def explain(self, prediction_id: int) -> dict[str, Any]:
        pred = await self.predictions.get(prediction_id)
        if not pred:
            raise ValueError(f"Prediction {prediction_id} not found")

        shap = pred.shap_values or {}
        model = pred.model
        return {
            "prediction_id": pred.id,
            "symbol": pred.stock.symbol if pred.stock else "",
            "label": pred.label,
            "probability_up": pred.probability_up,
            "confidence": pred.confidence,
            "prediction_horizon": pred.prediction_horizon or 1,
            "summary_text": pred.summary_text,
            "top_features": shap.get("top_features", []),
            "positive_contributions": shap.get("positive_contributions", []),
            "negative_contributions": shap.get("negative_contributions", []),
            "waterfall": shap.get("waterfall", shap.get("top_features", [])[:12]),
            "narrative": shap.get("narrative")
            or shap_narrative(shap.get("top_features", [])),
            "global_importance": model.global_importance if model else None,
        }
