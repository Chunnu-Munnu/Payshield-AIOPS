import csv
import logging
import os
import random
from pathlib import Path
from typing import Deque, Dict, List

import numpy as np
import pandas as pd

try:
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, TensorDataset
    TORCH_SUPPORT = True
except Exception:
    torch = None
    nn = None
    DataLoader = None
    TensorDataset = None
    TORCH_SUPPORT = False


LOGGER = logging.getLogger("observability-brain.lstm")
SERVICE_NAMES = [
    "payshield-frontend",
    "payshield-backend",
    "payshield-ml-engine",
    "payshield-blockchain",
    "payshield-simulator",
    "redis",
]
FEATURE_NAMES = [
    "ml_engine_latency_p95",
    "backend_error_rate",
    "fraud_score_mean",
    "ensemble_confidence_mean",
    "blockchain_write_latency_p95",
    "websocket_connections",
    "transaction_rate",
    "cpu_usage_backend",
    "cpu_usage_ml",
    "memory_usage_backend",
    "memory_usage_ml",
    "bec_detection_rate",
]

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
ARTIFACT_DIR = BASE_DIR / "runtime_models"
WEIGHTS_PATH = ARTIFACT_DIR / "lstm_weights.pt"
TRAINING_DATA_PATH = DATA_DIR / "metric_training_data.csv"


if TORCH_SUPPORT:
    class MetricBiLSTM(nn.Module):
        def __init__(self, input_size: int = 12, hidden_size: int = 64, num_layers: int = 2, output_size: int = 6):
            super().__init__()
            self.lstm = nn.LSTM(
                input_size=input_size,
                hidden_size=hidden_size,
                num_layers=num_layers,
                batch_first=True,
                bidirectional=True,
                dropout=0.2,
            )
            self.classifier = nn.Sequential(
                nn.Linear(hidden_size * 2, hidden_size),
                nn.ReLU(),
                nn.Dropout(0.2),
                nn.Linear(hidden_size, output_size),
                nn.Sigmoid(),
            )

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            outputs, _ = self.lstm(x)
            return self.classifier(outputs[:, -1, :])
else:
    class MetricBiLSTM:
        def __init__(self, *args, **kwargs):
            raise RuntimeError("Torch support is unavailable in this runtime profile")


def _ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)


def generate_training_data(n_samples: int = 5000) -> Path:
    _ensure_dirs()
    random.seed(42)
    np.random.seed(42)

    rows: List[dict] = []
    anomaly_samples = int(n_samples * 0.15)

    for sample_id in range(n_samples):
        anomaly = sample_id < anomaly_samples
        labels = {service: 0 for service in SERVICE_NAMES}
        anomaly_type = "normal"

        if anomaly:
            anomaly_type = random.choice(["ml_latency", "backend_errors", "blockchain_hang", "cascade"])
            if anomaly_type == "ml_latency":
                labels["payshield-ml-engine"] = 1
            elif anomaly_type == "backend_errors":
                labels["payshield-backend"] = 1
            elif anomaly_type == "blockchain_hang":
                labels["payshield-blockchain"] = 1
            elif anomaly_type == "cascade":
                labels["payshield-ml-engine"] = 1
                labels["payshield-backend"] = 1

        for timestep in range(30):
            ml_latency = np.random.normal(0.12, 0.03)
            backend_error_rate = np.random.normal(0.01, 0.005)
            fraud_score_mean = np.random.normal(0.28, 0.07)
            ensemble_confidence = np.random.normal(0.82, 0.05)
            blockchain_latency = np.random.normal(0.18, 0.05)
            websocket_connections = np.random.normal(18, 4)
            transaction_rate = np.random.normal(14, 3)
            cpu_backend = np.random.normal(0.28, 0.08)
            cpu_ml = np.random.normal(0.35, 0.09)
            memory_backend = np.random.normal(350_000_000, 45_000_000)
            memory_ml = np.random.normal(720_000_000, 80_000_000)
            bec_rate = np.random.normal(0.08, 0.03)

            if anomaly:
                if anomaly_type == "ml_latency":
                    ml_latency += np.random.uniform(2.5, 4.8)
                    ensemble_confidence -= np.random.uniform(0.25, 0.4)
                    cpu_ml += np.random.uniform(0.3, 0.5)
                elif anomaly_type == "backend_errors":
                    backend_error_rate += np.random.uniform(0.12, 0.3)
                    cpu_backend += np.random.uniform(0.2, 0.35)
                elif anomaly_type == "blockchain_hang":
                    blockchain_latency += np.random.uniform(4.5, 7.5)
                elif anomaly_type == "cascade":
                    ml_latency += np.random.uniform(2.8, 4.2)
                    ensemble_confidence -= np.random.uniform(0.28, 0.42)
                    cpu_ml += np.random.uniform(0.25, 0.45)
                    if timestep >= 8:
                        backend_error_rate += np.random.uniform(0.1, 0.26)
                        cpu_backend += np.random.uniform(0.15, 0.3)

            row = {
                "sample_id": sample_id,
                "timestep": timestep,
                "anomaly_type": anomaly_type,
                "ml_engine_latency_p95": max(0.01, ml_latency),
                "backend_error_rate": max(0.0, backend_error_rate),
                "fraud_score_mean": float(np.clip(fraud_score_mean, 0.01, 0.99)),
                "ensemble_confidence_mean": float(np.clip(ensemble_confidence, 0.01, 0.99)),
                "blockchain_write_latency_p95": max(0.01, blockchain_latency),
                "websocket_connections": max(0.0, websocket_connections),
                "transaction_rate": max(0.0, transaction_rate),
                "cpu_usage_backend": float(np.clip(cpu_backend, 0.01, 1.0)),
                "cpu_usage_ml": float(np.clip(cpu_ml, 0.01, 1.0)),
                "memory_usage_backend": max(100_000_000, memory_backend),
                "memory_usage_ml": max(100_000_000, memory_ml),
                "bec_detection_rate": max(0.0, bec_rate),
            }
            for service_name, label in labels.items():
                row[f"label_{service_name}"] = label
            rows.append(row)

    with TRAINING_DATA_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    return TRAINING_DATA_PATH


def _load_training_tensors(data_path: str):
    if not TORCH_SUPPORT:
        raise RuntimeError("Torch support is required for LSTM training")
    frame = pd.read_csv(data_path)
    sequences = []
    labels = []
    for _, group in frame.groupby("sample_id"):
        group = group.sort_values("timestep")
        sequences.append(group[FEATURE_NAMES].to_numpy(dtype=np.float32))
        labels.append(group[[f"label_{name}" for name in SERVICE_NAMES]].iloc[0].to_numpy(dtype=np.float32))
    return torch.tensor(np.stack(sequences), dtype=torch.float32), torch.tensor(np.stack(labels), dtype=torch.float32)


def train_lstm(data_path: str) -> Path:
    if not TORCH_SUPPORT:
        raise RuntimeError("Torch support is required for LSTM training")
    _ensure_dirs()
    model = MetricBiLSTM(input_size=len(FEATURE_NAMES), output_size=len(SERVICE_NAMES))
    features, labels = _load_training_tensors(data_path)
    dataset = TensorDataset(features, labels)
    loader = DataLoader(dataset, batch_size=64, shuffle=True)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.BCELoss()

    model.train()
    for epoch in range(50):
        total_loss = 0.0
        for batch_features, batch_labels in loader:
            optimizer.zero_grad()
            predictions = model(batch_features)
            loss = criterion(predictions, batch_labels)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        LOGGER.info("lstm_training_epoch", extra={"epoch": epoch + 1, "loss": round(total_loss / max(1, len(loader)), 6)})

    torch.save({"state_dict": model.state_dict(), "feature_names": FEATURE_NAMES, "service_names": SERVICE_NAMES}, WEIGHTS_PATH)
    return WEIGHTS_PATH


class LSTMDetector:
    def __init__(self) -> None:
        _ensure_dirs()
        self.model = None
        bootstrap_train = os.getenv("OBSERVABILITY_TRAIN_ON_BOOT", "false").lower() == "true"

        if not TRAINING_DATA_PATH.exists():
            generate_training_data()
        if not WEIGHTS_PATH.exists() and bootstrap_train and TORCH_SUPPORT:
            train_lstm(str(TRAINING_DATA_PATH))

        if WEIGHTS_PATH.exists() and TORCH_SUPPORT:
            checkpoint = torch.load(WEIGHTS_PATH, map_location="cpu")
            self.model = MetricBiLSTM(input_size=len(FEATURE_NAMES), output_size=len(SERVICE_NAMES))
            self.model.load_state_dict(checkpoint["state_dict"])
            self.model.eval()

    def _heuristic_degradation(self, metric_window: Deque[Dict[str, float]]) -> Dict[str, float]:
        if not metric_window:
            return {}
        latest = list(metric_window)[-1]
        probabilities = {
            "payshield-ml-engine": min(0.99, max(float(latest.get("ml_engine_latency_p95", 0.0)) / 3.5, 0.0)),
            "payshield-backend": min(0.99, max(float(latest.get("backend_error_rate", 0.0)) / 0.2, 0.0)),
            "payshield-blockchain": min(0.99, max(float(latest.get("blockchain_write_latency_p95", 0.0)) / 5.0, 0.0)),
            "redis": 0.9 if float(latest.get("cache_fallback_active", 0.0)) > 0.5 or float(latest.get("redis_tcp_health", 1.0)) < 0.5 else 0.0,
            "payshield-frontend": 0.88 if float(latest.get("frontend_health", 1.0)) < 0.5 else 0.0,
            "payshield-simulator": 0.86 if float(latest.get("simulator_container_running", 1.0)) < 0.5 else 0.0,
        }
        return {service_name: probability for service_name, probability in probabilities.items() if probability > 0.72}

    def detect_degradation(self, metric_window: Deque[Dict[str, float]]) -> Dict[str, float]:
        heuristic_results = self._heuristic_degradation(metric_window)
        if len(metric_window) < 30:
            return heuristic_results
        if self.model is None:
            return heuristic_results

        rows = list(metric_window)[-30:]
        matrix = []
        for row in rows:
            matrix.append([
                float(row.get(feature_name, 0.0))
                for feature_name in FEATURE_NAMES
            ])
        features = np.asarray(matrix, dtype=np.float32)

        normalized = features.copy()
        for index, feature_name in enumerate(FEATURE_NAMES):
            column = normalized[:, index]
            mean = float(np.mean(column))
            std = float(np.std(column) or 1.0)
            normalized[:, index] = (column - mean) / std
            if feature_name.startswith("memory_usage"):
                normalized[:, index] /= 10.0

        tensor = torch.tensor(normalized[None, :, :], dtype=torch.float32)
        with torch.no_grad():
            probabilities = self.model(tensor).squeeze(0).tolist()

        results = {service_name: float(probability) for service_name, probability in zip(SERVICE_NAMES, probabilities)}
        combined = {
            service_name: max(results.get(service_name, 0.0), heuristic_results.get(service_name, 0.0))
            for service_name in SERVICE_NAMES
        }
        return {service_name: probability for service_name, probability in combined.items() if probability > 0.72}


if __name__ == "__main__":
    if not TRAINING_DATA_PATH.exists():
        generate_training_data()
    train_lstm(str(TRAINING_DATA_PATH))
