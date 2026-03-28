# FILE: ensemble_model.py
# ROLE: XGBoost + LightGBM + Isolation Forest ensemble for tabular fraud detection
# INSPIRED BY: Gradient boosting in financial fraud — Bahnsen et al. 2016
# PERFORMANCE TARGET: Inference < 5ms per transaction

import numpy as np
import os
import pickle
import logging
from sklearn.ensemble import ExtraTreesClassifier, HistGradientBoostingClassifier, IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score

logger = logging.getLogger("payshield-ensemble")
MODEL_PATH = "saved_models/ensemble.pkl"

class EnsembleModel:
    _instance = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        self.xgb_model = None
        self.lgb_model = None
        self.iso_forest = None
        self.scaler     = None
        self.trained    = False
        self._load_or_train()

    def _load_or_train(self):
        os.makedirs("saved_models", exist_ok=True)
        if os.path.exists(MODEL_PATH):
            logger.info("Loading ensemble model from disk...")
            with open(MODEL_PATH, "rb") as f:
                state = pickle.load(f)
            self.xgb_model = state["xgb"]
            self.lgb_model = state["lgb"]
            self.iso_forest = state["iso"]
            self.scaler     = state["scaler"]
            self.trained    = True
            logger.info("Ensemble model loaded.")
        else:
            self._train()

    def _train(self):
        from data.synthetic_data_gen import FEATURE_COLUMNS, generate_dataset
        training_rows = int(os.getenv("ML_ENGINE_TRAINING_ROWS", "25000"))
        df = generate_dataset(training_rows, 0.02)
        X  = df[FEATURE_COLUMNS].fillna(0).values
        y  = df["is_fraud"].values

        logger.info(f"Training ensemble on {len(X)} transactions ({y.sum()} fraud)...")

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

        # Scale
        self.scaler = StandardScaler()
        X_train_s = self.scaler.fit_transform(X_train)
        X_test_s  = self.scaler.transform(X_test)

        # XGBoost
        scale_pos = max(1.0, (y_train == 0).sum() / max(1, (y_train == 1).sum()))
        # Keep the "xgb_score" field for API compatibility, but use an efficient
        # ExtraTrees classifier for the demo/runtime image so the container stays light.
        self.xgb_model = ExtraTreesClassifier(
            n_estimators=180,
            max_depth=10,
            min_samples_leaf=2,
            class_weight={0: 1.0, 1: scale_pos},
            random_state=42,
            n_jobs=-1,
        )
        self.xgb_model.fit(X_train_s, y_train)

        # Histogram gradient boosting serves as the second tree ensemble while
        # preserving the original "lgb_score" API contract expected by the backend.
        self.lgb_model = HistGradientBoostingClassifier(
            max_iter=160,
            max_depth=6,
            learning_rate=0.05,
            random_state=42,
        )
        self.lgb_model.fit(X_train_s, y_train)

        # Isolation Forest for novelty
        X_legit = X_train_s[y_train == 0]
        self.iso_forest = IsolationForest(n_estimators=140, contamination=0.02, random_state=42, n_jobs=-1)
        self.iso_forest.fit(X_legit)

        # Evaluate
        xgb_proba = self.xgb_model.predict_proba(X_test_s)[:, 1]
        auc = roc_auc_score(y_test, xgb_proba)
        logger.info(f"Primary tree ensemble AUC: {auc:.4f}")

        self.trained = True
        with open(MODEL_PATH, "wb") as f:
            pickle.dump({
                "xgb":    self.xgb_model,
                "lgb":    self.lgb_model,
                "iso":    self.iso_forest,
                "scaler": self.scaler,
            }, f)
        logger.info("Ensemble model saved.")

    def predict(self, feature_vector: np.ndarray) -> dict:
        """
        Returns: {xgb_score, lgb_score, iso_score, ensemble_score}
        All scores in [0, 1] where 1 = high fraud probability.
        """
        if not self.trained:
            return {"xgb_score": 0.5, "lgb_score": 0.5, "iso_score": 0.5, "ensemble_score": 0.5}

        X = self.scaler.transform(feature_vector.reshape(1, -1))

        xgb_score = float(self.xgb_model.predict_proba(X)[0, 1])
        lgb_score = float(self.lgb_model.predict_proba(X)[0, 1])

        # Isolation Forest: -1 = anomaly, 1 = normal → convert to [0,1]
        iso_raw = float(self.iso_forest.decision_function(X)[0])
        iso_score = float(np.clip(1 - (iso_raw + 0.5), 0, 1))

        ensemble = (xgb_score * 0.5) + (lgb_score * 0.3) + (iso_score * 0.2)

        return {
            "xgb_score":      round(xgb_score, 4),
            "lgb_score":      round(lgb_score, 4),
            "iso_score":      round(iso_score, 4),
            "ensemble_score": round(ensemble, 4),
        }
