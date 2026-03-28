# FILE: feature_engineering.py
# ROLE: Extract 47-dimensional fraud features from transaction payloads
# INSPIRED BY: JPMorgan Chase velocity analytics and FATF geospatial risk heuristics
# PERFORMANCE TARGET: Feature extraction under 10ms per transaction
from __future__ import annotations

from collections import deque
from math import atan2, cos, radians, sin, sqrt
from typing import Any, Deque, Dict, Iterable

import numpy as np

from data.synthetic_data_gen import FEATURE_NAMES

_history: Dict[str, Deque[Dict[str, Any]]] = {}


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * radius * atan2(sqrt(a), sqrt(1 - a))


def _get_history(user_id: str) -> Deque[Dict[str, Any]]:
    if user_id not in _history:
        _history[user_id] = deque(maxlen=200)
    return _history[user_id]


def extract_features(transaction: Dict[str, Any]) -> Dict[str, float]:
    user_id = transaction.get("user_id", "anonymous")
    amount = float(transaction.get("amount", 0.0))
    geo = transaction.get("geolocation", {}) or {}
    now_country = geo.get("country", "US")
    lat = float(geo.get("lat", 37.7749))
    lon = float(geo.get("lon", -122.4194))
    history = _get_history(user_id)
    recent = list(history)
    avg_amount = np.mean([item["amount"] for item in recent], dtype=float) if recent else max(amount, 1.0)
    last = recent[-1] if recent else {"lat": lat, "lon": lon, "merchant": transaction.get("merchant_id", "merchant-000")}

    country_risk_map = {"US": 0.08, "GB": 0.11, "IN": 0.14, "HighRiskLand": 0.94}
    device_id = transaction.get("device_id", "device-00000")
    merchant_id = transaction.get("merchant_id", "merchant-000")
    behavior = transaction.get("behavioral_data", {}) or {}
    typing = np.asarray(behavior.get("typing_cadence", [140, 150, 155]), dtype=float)

    features = {
        "tx_count_5min": float(len(recent[-5:])),
        "tx_count_1hr": float(len(recent[-30:])),
        "tx_count_24hr": float(len(recent)),
        "amount_sum_5min": float(sum(item["amount"] for item in recent[-5:])),
        "amount_sum_1hr": float(sum(item["amount"] for item in recent[-30:])),
        "merchant_change_count_1hr": float(len({item["merchant"] for item in recent[-30:]})),
        "cross_border_count_24hr": float(sum(item["country"] != now_country for item in recent)),
        "failed_attempt_count_10min": float(transaction.get("failed_attempts", 0)),
        "lat_deviation_score": abs(lat - np.mean([item["lat"] for item in recent], dtype=float)) if recent else 0.0,
        "lon_deviation_score": abs(lon - np.mean([item["lon"] for item in recent], dtype=float)) if recent else 0.0,
        "distance_from_last_tx_km": _haversine(lat, lon, last["lat"], last["lon"]),
        "country_risk_score": float(country_risk_map.get(now_country, 0.25)),
        "velocity_impossible_flag": float(_haversine(lat, lon, last["lat"], last["lon"]) > 1200),
        "ip_geolocation_mismatch_score": float(transaction.get("ip_mismatch_score", 0.1)),
        "device_seen_before": float(any(item["device_id"] == device_id for item in recent)),
        "device_age_days": float(transaction.get("device_age_days", 30)),
        "os_fingerprint_hash_match": float(transaction.get("os_hash_match", 0.85)),
        "browser_fingerprint_score": float(transaction.get("browser_score", 0.88)),
        "sim_swap_detected": float(transaction.get("sim_swap_detected", False)),
        "vpn_proxy_tor_detected": float(transaction.get("vpn_proxy_tor_detected", False)),
        "device_reputation_score": float(transaction.get("device_reputation_score", 0.76)),
        "typing_cadence_deviation": float(np.std(typing) / max(np.mean(typing), 1.0)),
        "touchscreen_pressure_variance": float(transaction.get("touch_pressure_variance", 0.15)),
        "swipe_velocity_score": float(transaction.get("swipe_velocity_score", 0.35)),
        "session_duration_anomaly": float(transaction.get("session_duration_ms", 60000) / 120000),
        "mouse_movement_entropy": float(transaction.get("mouse_movement_entropy", 0.42)),
        "scroll_pattern_score": float(transaction.get("scroll_pattern_score", 0.46)),
        "copy_paste_ratio": float(transaction.get("copy_paste_ratio", 0.08)),
        "idle_time_distribution_score": float(transaction.get("idle_time_distribution_score", 0.31)),
        "merchant_risk_category_score": float(transaction.get("merchant_risk_score", 0.3)),
        "merchant_seen_before_by_user": float(any(item["merchant"] == merchant_id for item in recent)),
        "amount_vs_user_avg_ratio": float(amount / max(avg_amount, 1.0)),
        "amount_vs_merchant_avg_ratio": float(amount / max(float(transaction.get("merchant_avg_amount", avg_amount)), 1.0)),
        "time_of_day_anomaly_score": float(transaction.get("time_of_day_anomaly", 0.18)),
        "weekend_flag": float(transaction.get("weekend_flag", False)),
        "card_not_present_flag": float(transaction.get("card_not_present_flag", False)),
        "recurring_pattern_match": float(transaction.get("recurring_pattern_match", False)),
        "high_risk_mcc_code_flag": float(transaction.get("high_risk_mcc_code_flag", False)),
        "shared_device_count": float(transaction.get("shared_device_count", 1)),
        "shared_ip_count": float(transaction.get("shared_ip_count", 1)),
        "merchant_fraud_ring_score": float(transaction.get("merchant_fraud_ring_score", 0.1)),
        "account_cluster_centrality": float(transaction.get("account_cluster_centrality", 0.12)),
        "degree_in_fraud_subgraph": float(transaction.get("degree_in_fraud_subgraph", 0.1)),
        "betweenness_centrality": float(transaction.get("betweenness_centrality", 0.05)),
        "shortest_path_to_known_fraud_node": float(transaction.get("shortest_path_to_known_fraud_node", 4.0)),
        "transaction_chain_depth": float(transaction.get("transaction_chain_depth", 1.0)),
        "circular_flow_detected": float(transaction.get("circular_flow_detected", False)),
    }

    history.append({
        "amount": amount,
        "lat": lat,
        "lon": lon,
        "merchant": merchant_id,
        "country": now_country,
        "device_id": device_id,
    })
    return features


def vectorize_features(feature_map: Dict[str, float]) -> np.ndarray:
    return np.asarray([float(feature_map.get(name, 0.0)) for name in FEATURE_NAMES], dtype=np.float32)


def batch_vectorize(transactions: Iterable[Dict[str, Any]]) -> np.ndarray:
    return np.stack([vectorize_features(extract_features(tx)) for tx in transactions])
