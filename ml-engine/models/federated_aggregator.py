# FILE: federated_aggregator.py
# ROLE: Simulate FedAvg with differential privacy across five institutions
# INSPIRED BY: JP Morgan Project AIKYA and secure aggregation research
# PERFORMANCE TARGET: Aggregate a round in under 100ms
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import Dict, List

import numpy as np


@dataclass
class FederatedRound:
    round_id: str
    submitted: Dict[str, dict] = field(default_factory=dict)
    aggregated_weights: List[float] | None = None
    model_hash: str | None = None


class FederatedAggregator:
    INSTITUTIONS = {
        "A": "retail_bank",
        "B": "investment_bank",
        "C": "payment_processor",
        "D": "crypto_exchange",
        "E": "insurance_company",
    }

    def __init__(self, epsilon: float = 1.0, delta: float = 1e-5) -> None:
        self.epsilon = epsilon
        self.delta = delta
        self.rounds: Dict[str, FederatedRound] = {}

    def start_round(self) -> FederatedRound:
        round_id = f"round-{len(self.rounds) + 1:03d}"
        fed_round = FederatedRound(round_id=round_id)
        self.rounds[round_id] = fed_round
        return fed_round

    def submit_update(self, round_id: str, institution_id: str, gradients: List[float], sample_count: int) -> dict:
        norm = np.linalg.norm(gradients)
        clipped = np.asarray(gradients, dtype=float)
        if norm > 1.0:
            clipped = clipped / norm
        noise = np.random.normal(0, 1 / max(self.epsilon, 1e-6), size=clipped.shape)
        private = clipped + noise
        self.rounds[round_id].submitted[institution_id] = {"gradients": private.tolist(), "sample_count": sample_count}
        return {"institution_id": institution_id, "accepted": True, "norm": float(np.linalg.norm(private))}

    def aggregate(self, round_id: str) -> dict:
        fed_round = self.rounds[round_id]
        updates = list(fed_round.submitted.values())
        total = sum(item["sample_count"] for item in updates) or 1
        weighted = sum(np.asarray(item["gradients"]) * (item["sample_count"] / total) for item in updates)
        fed_round.aggregated_weights = weighted.tolist()
        fed_round.model_hash = hashlib.sha256(np.asarray(weighted).tobytes()).hexdigest()
        return {
            "round_id": round_id,
            "aggregated_weights": fed_round.aggregated_weights,
            "model_hash": fed_round.model_hash,
            "institution_count": len(updates),
        }
