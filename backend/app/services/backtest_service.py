"""Historical strategy evaluation (illustrative backtesting)."""

from __future__ import annotations

from datetime import date
from typing import Any, Optional

import joblib
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession

from app.ml.features.indicators import FEATURE_COLUMNS
from app.models import BacktestRun
from app.repositories import FeatureRepository, OhlcvRepository, StockRepository, TrainingRepository


class BacktestService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.stocks = StockRepository(session)
        self.ohlcv = OhlcvRepository(session)
        self.features = FeatureRepository(session)
        self.training = TrainingRepository(session)

    async def run(
        self,
        symbol: str,
        model_id: int,
        confidence_threshold: float = 0.55,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        prediction_horizon: int = 1,
    ) -> dict[str, Any]:
        stock = await self.stocks.get_by_symbol(symbol)
        if not stock:
            raise ValueError(f"Stock not found: {symbol}")

        artifact = await self.training.get_model(model_id)
        if not artifact:
            raise ValueError(f"Model {model_id} not found")

        run_id = artifact.feature_run_id
        if run_id is None:
            run = await self.features.latest_run()
            if not run:
                raise ValueError("No feature run available")
            run_id = run.id

        feature_rows = await self.features.get_features_for_symbol(run_id, stock.id)
        bars = await self.ohlcv.get_bars(stock.id, start=start_date, end=end_date)
        close_by_date = {b.date: float(b.close) for b in bars}

        payload = joblib.load(artifact.artifact_path)
        model = payload["model"]
        feature_names = artifact.feature_names or FEATURE_COLUMNS
        horizon = int((artifact.meta or {}).get("prediction_horizon", prediction_horizon))

        dates = []
        X_list = []
        targets = []
        for r in feature_rows:
            if start_date and r.date < start_date:
                continue
            if end_date and r.date > end_date:
                continue
            if r.target is None:
                continue
            X_list.append([r.features[c] for c in feature_names])
            dates.append(r.date)
            targets.append(int(r.target))

        if len(X_list) < 20:
            raise ValueError("Insufficient labeled feature rows for the selected range")

        X = np.array(X_list, dtype=float)
        y = np.array(targets, dtype=int)
        proba = model.predict_proba(X)[:, 1]
        preds = (proba >= 0.5).astype(int)

        # Signal when conviction exceeds threshold.
        # conviction = |P(UP) − 0.5| × 2  →  0 = coin flip, 1 = certain.
        # Weak short-horizon models often sit in 0.10–0.40 conviction; 0.55+ is rare.
        conf = np.abs(proba - 0.5) * 2.0
        signal_mask = conf >= confidence_threshold
        n_signals = int(signal_mask.sum())
        if n_signals == 0:
            max_c = float(conf.max()) if len(conf) else 0.0
            p50 = float(np.median(conf)) if len(conf) else 0.0
            p90 = float(np.percentile(conf, 90)) if len(conf) else 0.0
            raise ValueError(
                f"No signals at conviction ≥ {confidence_threshold:.2f} for {symbol} "
                f"({len(dates)} days scored). "
                f"This model’s conviction max={max_c:.2f}, median={p50:.2f}, p90={p90:.2f}. "
                f"Lower the threshold to about {max(0.05, round(p90 * 0.9, 2)):.2f} "
                f"(near the 90th percentile) or pick a higher-AUC model."
            )

        correct = (preds == y) & signal_mask
        accuracy = float(correct.sum() / n_signals)
        # Win = predicted UP and actual UP, or predicted DOWN and actual DOWN on signaled days
        win_rate = accuracy

        equity = [1.0]
        equity_curve = [{"date": str(dates[0]), "equity": 1.0}]
        peak = 1.0
        max_dd = 0.0
        for i in range(len(dates)):
            if not signal_mask[i]:
                equity_curve.append({"date": str(dates[i]), "equity": equity[-1]})
                continue
            # Illustrative: long if UP else flat/short small move using realized close change over horizon
            d0 = dates[i]
            # Find future close approximately horizon steps ahead in close_by_date ordered keys
            future_dates = sorted(d for d in close_by_date if d > d0)
            if len(future_dates) < horizon:
                ret = 0.0
            else:
                d1 = future_dates[horizon - 1]
                c0 = close_by_date.get(d0)
                c1 = close_by_date.get(d1)
                if c0 and c1 and c0 != 0:
                    raw = (c1 - c0) / c0
                    ret = raw if preds[i] == 1 else -raw
                else:
                    ret = 0.0
            new_eq = equity[-1] * (1.0 + ret)
            equity.append(new_eq)
            peak = max(peak, new_eq)
            dd = (peak - new_eq) / peak if peak else 0.0
            max_dd = max(max_dd, dd)
            equity_curve.append({"date": str(dates[i]), "equity": new_eq})

        metrics = {
            "prediction_accuracy": accuracy,
            "win_rate": win_rate,
            "n_signals": n_signals,
            "n_samples": int(len(dates)),
            "cumulative_return": float(equity[-1] - 1.0),
            "max_drawdown": float(max_dd),
            "avg_confidence": float(conf[signal_mask].mean()),
        }

        bt = BacktestRun(
            model_id=artifact.id,
            stock_id=stock.id,
            confidence_threshold=confidence_threshold,
            start_date=start_date or dates[0],
            end_date=end_date or dates[-1],
            prediction_horizon=horizon,
            metrics=metrics,
            equity_curve=equity_curve,
        )
        self.session.add(bt)
        await self.session.commit()
        await self.session.refresh(bt)

        return {
            "id": bt.id,
            "symbol": stock.symbol,
            "model_id": artifact.id,
            "confidence_threshold": confidence_threshold,
            "prediction_horizon": horizon,
            "metrics": metrics,
            "equity_curve": equity_curve,
        }
