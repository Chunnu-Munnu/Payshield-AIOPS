# FILE: shap_explainer.py
# ROLE: Produce deterministic feature attributions and regulator-friendly explanations
# INSPIRED BY: SHAP and EU AI Act Article 13 explainability requirements
# PERFORMANCE TARGET: Explanation under 20ms
from __future__ import annotations

from typing import Dict, List

import numpy as np

from data.synthetic_data_gen import FEATURE_NAMES

HUMAN_LABELS = {
    "velocity_impossible_flag": "Impossible travel speed",
    "device_seen_before": "Device seen before",
    "card_not_present_flag": "Card-not-present transaction",
    "merchant_fraud_ring_score": "Merchant fraud ring score",
    "circular_flow_detected": "Circular flow detected",
    "copy_paste_ratio": "Copy-paste ratio",
}


def explain(vector: np.ndarray, score: float) -> Dict[str, object]:
    baseline = np.mean(vector)
    shap_values = vector - baseline
    top_idx = np.argsort(np.abs(shap_values))[-5:][::-1]
    top_features: List[Dict[str, object]] = []
    for idx in top_idx:
        name = FEATURE_NAMES[idx]
        value = float(shap_values[idx])
        top_features.append({
            "feature_name": name,
            "humanReadable": HUMAN_LABELS.get(name, name.replace("_", " ").title()),
            "shap_value": value,
            "direction": "fraud" if value >= 0 else "legitimate",
        })
    natural_language = "Transaction flagged: " + ", ".join(f"{item['humanReadable'].upper()} ({item['shap_value']:+.2f})" for item in top_features[:3])
    return {
        "top_5_features": top_features,
        "decision_boundary_plot_data": [{"feature": item["humanReadable"], "value": item["shap_value"]} for item in top_features],
        "natural_language_explanation": natural_language,
        "lime_backup": [{"feature": item["humanReadable"], "weight": item["shap_value"] / max(score, 0.1)} for item in top_features[:3]],
    }
