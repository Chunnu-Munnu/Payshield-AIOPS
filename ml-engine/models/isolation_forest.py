# FILE: isolation_forest.py
# ROLE: Novel-pattern anomaly detector for zero-day fraud behaviors
# INSPIRED BY: Isolation Forest outlier detection for financial crime
# PERFORMANCE TARGET: Inference under 5ms per transaction
from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest

MODEL_PATH = Path(__file__).resolve().parent.parent / "saved_models" / "isolation_forest.joblib"


class IsolationForestModel:
    def __init__(self) -> None:
        self.model = None

    def train_or_load(self, X: np.ndarray) -> "IsolationForestModel":
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        if MODEL_PATH.exists():
            self.model = joblib.load(MODEL_PATH)
            return self
        self.model = IsolationForest(n_estimators=200, contamination=0.01, random_state=42)
        self.model.fit(X)
        joblib.dump(self.model, MODEL_PATH)
        return self

    def anomaly_score(self, vector: np.ndarray) -> float:
        raw = -float(self.model.decision_function(vector.reshape(1, -1))[0])
        return max(0.0, min(1.0, 0.5 + raw))
