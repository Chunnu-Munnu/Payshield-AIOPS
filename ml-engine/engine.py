# FILE: engine.py
# ROLE: Shared model orchestration singleton for FastAPI routers
# INSPIRED BY: Multi-model fraud inference service containers
# PERFORMANCE TARGET: Initialization amortized at startup only
from __future__ import annotations

from collections import deque
from typing import Deque, Dict

import numpy as np

from data.feature_engineering import extract_features, vectorize_features
from data.synthetic_data_gen import FEATURE_NAMES, generate_graph, generate_sequence_dataset, generate_synthetic_transactions
from models.ensemble_model import FraudEnsemble
from models.federated_aggregator import FederatedAggregator
from models.gnn_model import GNNFraudModel
from models.lstm_model import LSTMFraudModel
from models.transformer_bec import BECModel
from utils.adversarial_detector import AdversarialDetector
from utils.shap_explainer import explain
from utils.velocity_tracker import VelocityTracker


class Engine:
    def __init__(self) -> None:
        self.dataset = generate_synthetic_transactions()
        self.X = self.dataset[FEATURE_NAMES].to_numpy(dtype=np.float32)
        self.y = self.dataset["label"].to_numpy(dtype=np.int64)
        self.graph = generate_graph(self.dataset)
        self.sequences, self.sequence_labels = generate_sequence_dataset(self.dataset)
        self.recent_vectors: Dict[str, Deque[np.ndarray]] = {}
        self.gnn = GNNFraudModel().train_or_load(self.X, self.y, self.graph)
        self.lstm = LSTMFraudModel(len(FEATURE_NAMES)).train_or_load(self.sequences[:512], self.sequence_labels[:512])
        self.ensemble = FraudEnsemble().train(self.X[:5000], self.y[:5000])
        self.bec = BECModel().train_or_load()
        self.federated = FederatedAggregator()
        self.adversarial = AdversarialDetector()
        self.velocity = VelocityTracker()

    def prepare_vector(self, payload: dict) -> np.ndarray:
        features = extract_features(payload)
        return vectorize_features(features)

    def build_sequence(self, payload: dict) -> np.ndarray:
        user_id = payload.get("user_id", payload.get("userId", "anonymous"))
        vector = self.prepare_vector(payload)
        if user_id not in self.recent_vectors:
            self.recent_vectors[user_id] = deque(maxlen=20)
        bucket = self.recent_vectors[user_id]
        bucket.append(vector)
        while len(bucket) < 20:
            bucket.appendleft(vector)
        return np.stack(bucket)

    def explain(self, vector: np.ndarray, score: float) -> dict:
        return explain(vector, score)


ENGINE = Engine()
