# FILE: xgboost_model.py
# ROLE: Persisted gradient-boosted fraud classifier for tabular features
# INSPIRED BY: Tree-based card fraud scoring pipelines with SHAP support
# PERFORMANCE TARGET: Inference under 5ms per transaction
from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np
from imblearn.over_sampling import SMOTE
from xgboost import XGBClassifier

MODEL_PATH = Path(__file__).resolve().parent.parent / "saved_models" / "xgboost.joblib"


class XGBoostFraudModel:
    def __init__(self) -> None:
        self.model = None

    def train_or_load(self, X: np.ndarray, y: np.ndarray) -> "XGBoostFraudModel":
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        if MODEL_PATH.exists():
            self.model = joblib.load(MODEL_PATH)
            return self
        smote = SMOTE(random_state=42)
        X_balanced, y_balanced = smote.fit_resample(X, y)
        fraud_count = max(int(y_balanced.sum()), 1)
        legit_count = max(len(y_balanced) - fraud_count, 1)
        self.model = XGBClassifier(
            n_estimators=120,
            max_depth=6,
            learning_rate=0.03,
            subsample=0.9,
            colsample_bytree=0.9,
            eval_metric="logloss",
            scale_pos_weight=legit_count / fraud_count,
        )
        self.model.fit(X_balanced, y_balanced)
        joblib.dump(self.model, MODEL_PATH)
        return self

    def predict_proba(self, vector: np.ndarray) -> float:
        return float(self.model.predict_proba(vector.reshape(1, -1))[0, 1])
