# FILE: synthetic_data_gen.py
# ROLE: Generate 100,000 synthetic Indian payment transactions for model training
# INSPIRED BY: IEEE-CIS fraud dataset statistical properties + RBI annual report 2024
# PERFORMANCE TARGET: Generation + training < 5 minutes on CPU

import numpy as np
import pandas as pd
import os
import logging

logger = logging.getLogger("payshield-datagen")

INDIAN_MERCHANTS = [
    "Swiggy", "Zomato", "Flipkart", "Amazon India", "Meesho",
    "BigBasket", "Blinkit", "Zepto", "Myntra", "Nykaa",
    "PhonePe Merchant", "Paytm Merchant", "IRCTC", "BookMyShow",
    "Ola", "Uber India", "MakeMyTrip", "Yatra", "OYO",
    "Shell Company Pvt Ltd", "Unknown Vendor", "New Payee 4821",
    "Overseas Transfer", "Crypto Exchange INR", "Shell Merchant XY"
]

HIGH_RISK_MERCHANTS = [
    "Shell Company Pvt Ltd", "Unknown Vendor", "New Payee 4821",
    "Overseas Transfer", "Crypto Exchange INR", "Shell Merchant XY"
]

def generate_transaction(is_fraud: bool, user_id: str, rng: np.random.Generator) -> dict:
    """Generate a single synthetic Indian payment transaction."""

    # Base amounts in INR
    if is_fraud:
        amount = rng.choice([
            rng.uniform(200, 499),        # below ₹500 (smurfing)
            rng.uniform(49000, 49999),    # just below ₹50K threshold
            rng.uniform(8000, 45000),     # mid-range drain
        ])
        merchant = rng.choice(HIGH_RISK_MERCHANTS)
        country = rng.choice(["IN", "IN", "US", "SG", "AE"])  # sometimes foreign
        device_seen_before = rng.choice([True, False], p=[0.3, 0.7])
        velocity_5min = rng.integers(3, 15)
        amount_ratio_to_avg = rng.uniform(3.0, 25.0)
        distance_km = rng.uniform(100, 4000)
        behavioral_trust = rng.uniform(0.1, 0.45)
        vpn_detected = rng.choice([True, False], p=[0.4, 0.6])
        sim_swap = rng.choice([True, False], p=[0.3, 0.7])
    else:
        amount = rng.choice([
            rng.uniform(50, 2000),        # small daily transactions ₹50-2000
            rng.uniform(2000, 15000),     # medium transactions
            rng.uniform(15000, 100000),   # large but legitimate
        ], p=[0.6, 0.3, 0.1])
        merchant = rng.choice(INDIAN_MERCHANTS[:15])  # known merchants only
        country = "IN"
        device_seen_before = rng.choice([True, False], p=[0.92, 0.08])
        velocity_5min = rng.integers(0, 3)
        amount_ratio_to_avg = rng.uniform(0.3, 2.5)
        distance_km = rng.uniform(0, 50)
        behavioral_trust = rng.uniform(0.65, 1.0)
        vpn_detected = rng.choice([True, False], p=[0.05, 0.95])
        sim_swap = False

    return {
        # Identity
        "user_id":                  user_id,
        "merchant":                 merchant,
        "country":                  country,
        "amount_inr":               round(amount, 2),
        "currency":                 "INR",
        "payment_method":           rng.choice(["UPI", "Card", "NEFT", "IMPS", "Wallet"]),

        # Velocity features (8)
        "tx_count_5min":            velocity_5min,
        "tx_count_1hr":             rng.integers(0, 20) if is_fraud else rng.integers(0, 5),
        "tx_count_24hr":            rng.integers(0, 50) if is_fraud else rng.integers(0, 15),
        "amount_sum_5min":          amount * velocity_5min,
        "amount_sum_1hr":           amount * rng.integers(1, 10),
        "merchant_change_count_1hr":rng.integers(3, 10) if is_fraud else rng.integers(0, 2),
        "cross_border_count_24hr":  rng.integers(2, 8) if is_fraud else 0,
        "failed_attempt_count_10min":rng.integers(2, 6) if is_fraud else 0,

        # Geolocation features (6)
        "lat_deviation_score":      rng.uniform(0.5, 1.0) if is_fraud else rng.uniform(0.0, 0.2),
        "lon_deviation_score":      rng.uniform(0.5, 1.0) if is_fraud else rng.uniform(0.0, 0.2),
        "distance_from_last_tx_km": distance_km,
        "country_risk_score":       rng.uniform(0.3, 0.9) if is_fraud else rng.uniform(0.0, 0.2),
        "velocity_impossible_flag": 1 if (is_fraud and distance_km > 500) else 0,
        "ip_geolocation_mismatch":  rng.uniform(0.5, 1.0) if is_fraud else rng.uniform(0.0, 0.15),

        # Device features (7)
        "device_seen_before":       int(device_seen_before),
        "device_age_days":          rng.integers(0, 3) if is_fraud else rng.integers(30, 1000),
        "os_fingerprint_match":     0 if is_fraud else 1,
        "browser_fingerprint_score":rng.uniform(0.0, 0.4) if is_fraud else rng.uniform(0.6, 1.0),
        "sim_swap_detected":        int(sim_swap),
        "vpn_proxy_tor_detected":   int(vpn_detected),
        "device_reputation_score":  rng.uniform(0.0, 0.4) if is_fraud else rng.uniform(0.6, 1.0),

        # Behavioral biometrics (8)
        "typing_cadence_deviation": rng.uniform(0.5, 1.0) if is_fraud else rng.uniform(0.0, 0.3),
        "touchscreen_pressure_var": rng.uniform(0.4, 1.0) if is_fraud else rng.uniform(0.0, 0.25),
        "swipe_velocity_score":     rng.uniform(0.4, 1.0) if is_fraud else rng.uniform(0.0, 0.2),
        "session_duration_anomaly": rng.uniform(0.5, 1.0) if is_fraud else rng.uniform(0.0, 0.3),
        "mouse_movement_entropy":   rng.uniform(0.6, 1.0) if is_fraud else rng.uniform(0.0, 0.4),
        "scroll_pattern_score":     rng.uniform(0.5, 1.0) if is_fraud else rng.uniform(0.0, 0.3),
        "copy_paste_ratio":         rng.uniform(0.5, 1.0) if is_fraud else rng.uniform(0.0, 0.1),
        "idle_time_distribution":   rng.uniform(0.4, 1.0) if is_fraud else rng.uniform(0.0, 0.3),

        # Merchant features (9)
        "merchant_risk_score":      rng.uniform(0.5, 1.0) if merchant in HIGH_RISK_MERCHANTS else rng.uniform(0.0, 0.2),
        "merchant_seen_before":     0 if is_fraud else 1,
        "amount_vs_user_avg_ratio": amount_ratio_to_avg,
        "amount_vs_merchant_avg":   rng.uniform(2.0, 10.0) if is_fraud else rng.uniform(0.5, 2.0),
        "time_of_day_anomaly":      rng.uniform(0.5, 1.0) if is_fraud else rng.uniform(0.0, 0.3),
        "weekend_flag":             rng.integers(0, 2),
        "card_not_present_flag":    rng.choice([0, 1], p=[0.3, 0.7]) if is_fraud else rng.choice([0, 1], p=[0.7, 0.3]),
        "recurring_pattern_match":  0 if is_fraud else rng.choice([0, 1], p=[0.6, 0.4]),
        "high_risk_mcc_flag":       1 if is_fraud else 0,

        # Graph features (9)
        "shared_device_count":      rng.integers(3, 20) if is_fraud else rng.integers(0, 2),
        "shared_ip_count":          rng.integers(2, 15) if is_fraud else rng.integers(0, 2),
        "merchant_fraud_ring_score":rng.uniform(0.5, 1.0) if is_fraud else rng.uniform(0.0, 0.15),
        "account_cluster_centrality":rng.uniform(0.4, 1.0) if is_fraud else rng.uniform(0.0, 0.2),
        "degree_in_fraud_subgraph": rng.integers(2, 10) if is_fraud else 0,
        "betweenness_centrality":   rng.uniform(0.3, 1.0) if is_fraud else rng.uniform(0.0, 0.15),
        "path_to_known_fraud_node": rng.integers(1, 4) if is_fraud else rng.integers(5, 20),
        "transaction_chain_depth":  rng.integers(3, 10) if is_fraud else rng.integers(1, 3),
        "circular_flow_detected":   1 if (is_fraud and rng.random() > 0.5) else 0,

        # Label
        "is_fraud": int(is_fraud),
        "behavioral_trust_score":   behavioral_trust,
    }


def generate_dataset(n_total: int = 100_000, fraud_rate: float = 0.02) -> pd.DataFrame:
    """Generate full synthetic dataset. ~2% fraud rate matching real-world India UPI data."""
    rng = np.random.default_rng(42)
    n_fraud = int(n_total * fraud_rate)
    n_legit = n_total - n_fraud

    user_ids = [f"user_{i:06d}" for i in range(5000)]

    rows = []
    for _ in range(n_fraud):
        uid = rng.choice(user_ids)
        rows.append(generate_transaction(True, uid, rng))
    for _ in range(n_legit):
        uid = rng.choice(user_ids)
        rows.append(generate_transaction(False, uid, rng))

    df = pd.DataFrame(rows)
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    return df


def ensure_training_data():
    """Call on startup — generates data if it doesn't exist."""
    os.makedirs("data", exist_ok=True)
    path = "data/transactions.parquet"
    if not os.path.exists(path):
        logger.info("Generating 100,000 synthetic Indian payment transactions...")
        df = generate_dataset(100_000, 0.02)
        df.to_parquet(path, index=False)
        logger.info(f"Dataset saved: {len(df)} rows, {df['is_fraud'].sum()} fraud cases")
    else:
        logger.info("Training data already exists. Skipping generation.")


FEATURE_COLUMNS = [
    "tx_count_5min", "tx_count_1hr", "tx_count_24hr", "amount_sum_5min", "amount_sum_1hr",
    "merchant_change_count_1hr", "cross_border_count_24hr", "failed_attempt_count_10min",
    "lat_deviation_score", "lon_deviation_score", "distance_from_last_tx_km", "country_risk_score",
    "velocity_impossible_flag", "ip_geolocation_mismatch",
    "device_seen_before", "device_age_days", "os_fingerprint_match", "browser_fingerprint_score",
    "sim_swap_detected", "vpn_proxy_tor_detected", "device_reputation_score",
    "typing_cadence_deviation", "touchscreen_pressure_var", "swipe_velocity_score",
    "session_duration_anomaly", "mouse_movement_entropy", "scroll_pattern_score",
    "copy_paste_ratio", "idle_time_distribution",
    "merchant_risk_score", "merchant_seen_before", "amount_vs_user_avg_ratio",
    "amount_vs_merchant_avg", "time_of_day_anomaly", "weekend_flag", "card_not_present_flag",
    "recurring_pattern_match", "high_risk_mcc_flag",
    "shared_device_count", "shared_ip_count", "merchant_fraud_ring_score",
    "account_cluster_centrality", "degree_in_fraud_subgraph", "betweenness_centrality",
    "path_to_known_fraud_node", "transaction_chain_depth", "circular_flow_detected",
]
