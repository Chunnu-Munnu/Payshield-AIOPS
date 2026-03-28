# FILE: adversarial_detector.py
# ROLE: Detect evasion, poisoning, and model-disagreement attacks against ML services
# INSPIRED BY: Adversarial ML defenses for financial systems
# PERFORMANCE TARGET: Detection under 5ms per request
from __future__ import annotations

from typing import Dict

import numpy as np
from scipy.stats import ks_2samp


class AdversarialDetector:
    def __init__(self) -> None:
        self.reference_distribution = np.random.normal(0.35, 0.15, size=2000)

    def check(self, feature_vector: np.ndarray, scores: Dict[str, float]) -> Dict[str, object]:
        sigma_flags = int(np.sum(np.abs(feature_vector - np.mean(self.reference_distribution)) > 6 * np.std(self.reference_distribution)))
        disagreement = abs(scores.get("gnn", 0.0) - scores.get("lstm", 0.0))
        overconfident = any(prob > 0.99 or prob < 0.01 for prob in scores.values())
        drift_pvalue = ks_2samp(feature_vector, self.reference_distribution[: len(feature_vector)]).pvalue
        suspected = sigma_flags > 3 or disagreement > 0.4 or overconfident or drift_pvalue < 0.05
        if disagreement > 0.4:
            attack_type = "evasion"
        elif drift_pvalue < 0.05:
            attack_type = "poisoning"
        elif overconfident:
            attack_type = "mimicry"
        else:
            attack_type = "unknown"
        integrity = max(0.0, min(1.0, 1.0 - (0.2 * sigma_flags + disagreement)))
        return {
            "adversarial_attack_suspected": suspected,
            "attack_type": attack_type,
            "system_integrity_score": integrity,
        }
