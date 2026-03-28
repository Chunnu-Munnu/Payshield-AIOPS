import json
import logging
import os
import random
import re
import pickle
from pathlib import Path
from typing import List

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

try:
    from datasets import Dataset
    from transformers import (
        AutoModelForSequenceClassification,
        AutoTokenizer,
        DataCollatorWithPadding,
        Trainer,
        TrainingArguments,
        pipeline,
    )
    TRANSFORMER_SUPPORT = True
except Exception:
    Dataset = None
    AutoModelForSequenceClassification = None
    AutoTokenizer = None
    DataCollatorWithPadding = None
    Trainer = None
    TrainingArguments = None
    pipeline = None
    TRANSFORMER_SUPPORT = False


LOGGER = logging.getLogger("observability-brain.log-model")
BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
ARTIFACT_DIR = BASE_DIR / "runtime_models"
MODEL_DIR = ARTIFACT_DIR / "log_anomaly_model"
TRAINING_DATA_PATH = DATA_DIR / "log_training_data.jsonl"
BASE_MODEL_NAME = "distilbert-base-uncased"
LIGHTWEIGHT_MODEL_PATH = MODEL_DIR / "lightweight_log_model.pkl"
HEURISTIC_PATTERNS = {
    "oom": re.compile(r"out of memory|oom|cuda out of memory", re.IGNORECASE),
    "timeout": re.compile(r"timeout|timed out|deadline exceeded", re.IGNORECASE),
    "connection": re.compile(r"econnrefused|connection refused|unreachable|reset by peer", re.IGNORECASE),
    "blockchain": re.compile(r"contract revert|nonce too low|rpc|eth_|chain", re.IGNORECASE),
    "fallback": re.compile(r"fallback|degraded|recovery", re.IGNORECASE),
    "cache": re.compile(r"redis|cache miss|memory fallback", re.IGNORECASE),
}
SEVERITY_SCORES = {
    "debug": 0.05,
    "info": 0.1,
    "warning": 0.35,
    "warn": 0.35,
    "error": 0.75,
    "critical": 0.9,
    "fatal": 0.95,
}


def _ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    MODEL_DIR.parent.mkdir(parents=True, exist_ok=True)


def generate_log_training_data() -> Path:
    _ensure_dirs()
    merchants = ["Swiggy", "Amazon Pay", "Google Pay", "IRCTC", "PhonePe"]
    models = ["GNN", "BiLSTM", "XGBoost", "BehavioralBiometrics", "AML_GNN", "DistilBERT"]
    rows = []

    for _ in range(2000):
        normal_events = [
            {
                "service": "payshield-backend",
                "level": "info",
                "message": "transaction submitted",
                "merchant": random.choice(merchants),
                "amount": random.randint(500, 15000),
            },
            {
                "service": "payshield-ml-engine",
                "level": "info",
                "message": "model inference complete",
                "model_name": random.choice(models),
                "confidence_score": round(random.uniform(0.72, 0.99), 4),
            },
            {
                "service": "payshield-backend",
                "level": "info",
                "message": "blockchain write success",
                "txHash": f"0x{random.randint(10**12, 10**14):x}",
            },
            {
                "service": "payshield-backend",
                "level": "info",
                "message": "websocket broadcast complete",
                "clients": random.randint(4, 22),
            },
            {
                "service": "payshield-backend",
                "level": "info",
                "message": "gmail email scored",
                "becScore": round(random.uniform(0.72, 0.99), 4),
            },
        ]
        rows.append({
            "text": json.dumps(random.choice(normal_events)),
            "label": 0,
        })

    anomalous_events = [
        {"service": "payshield-ml-engine", "level": "error", "message": "CUDA out of memory while allocating tensor"},
        {"service": "payshield-backend", "level": "error", "message": "connect ECONNREFUSED payshield-ml-engine:8000"},
        {"service": "payshield-blockchain", "level": "error", "message": "contract revert during audit logging"},
        {"service": "payshield-backend", "level": "error", "message": "timeout of 5000ms exceeded calling /ensemble/score"},
        {"service": "payshield-ml-engine", "level": "critical", "message": "DistilBERT model load failure: weights corrupted"},
        {"service": "payshield-ml-engine", "level": "error", "message": "torch.cuda.OutOfMemoryError: CUDA out of memory"},
    ]
    for _ in range(1000):
        rows.append({
            "text": json.dumps(random.choice(anomalous_events)),
            "label": 1,
        })

    with TRAINING_DATA_PATH.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row) + "\n")
    return TRAINING_DATA_PATH


def train_log_model(log_samples_path: str) -> Path:
    _ensure_dirs()
    with Path(log_samples_path).open("r", encoding="utf-8") as handle:
        rows = [json.loads(line) for line in handle if line.strip()]
    if TRANSFORMER_SUPPORT and os.getenv("OBSERVABILITY_LOG_MODEL", "lightweight").lower() == "distilbert":
        tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL_NAME)
        model = AutoModelForSequenceClassification.from_pretrained(BASE_MODEL_NAME, num_labels=2)
        dataset = Dataset.from_list(rows)
        tokenized = dataset.map(lambda batch: tokenizer(batch["text"], truncation=True), batched=True)

        args = TrainingArguments(
            output_dir=str(MODEL_DIR / "trainer_output"),
            learning_rate=2e-5,
            per_device_train_batch_size=16,
            num_train_epochs=3,
            logging_steps=20,
            save_strategy="no",
            report_to=[],
        )

        trainer = Trainer(
            model=model,
            args=args,
            train_dataset=tokenized,
            tokenizer=tokenizer,
            data_collator=DataCollatorWithPadding(tokenizer=tokenizer),
        )
        trainer.train()
        model.save_pretrained(MODEL_DIR)
        tokenizer.save_pretrained(MODEL_DIR)
        LOGGER.info("distilbert_log_model_trained", extra={"samples": len(rows), "model_dir": str(MODEL_DIR)})
        return MODEL_DIR

    texts = [row["text"] for row in rows]
    labels = [int(row["label"]) for row in rows]
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=4000, lowercase=True)
    classifier = LogisticRegression(max_iter=600, class_weight="balanced")
    classifier.fit(vectorizer.fit_transform(texts), labels)
    with LIGHTWEIGHT_MODEL_PATH.open("wb") as handle:
        pickle.dump({"vectorizer": vectorizer, "classifier": classifier}, handle)
    LOGGER.info("lightweight_log_model_trained", extra={"samples": len(rows), "model_path": str(LIGHTWEIGHT_MODEL_PATH)})
    return LIGHTWEIGHT_MODEL_PATH


class LogAnomalyDetector:
    def __init__(self) -> None:
        _ensure_dirs()
        if not TRAINING_DATA_PATH.exists():
            generate_log_training_data()
        self.classifier = None
        self.vectorizer = None
        self.lightweight_classifier = None

        bootstrap_train = os.getenv("OBSERVABILITY_TRAIN_ON_BOOT", "false").lower() == "true"
        if MODEL_DIR.exists() and (MODEL_DIR / "config.json").exists() and TRANSFORMER_SUPPORT:
            self.classifier = pipeline(
                "text-classification",
                model=str(MODEL_DIR),
                tokenizer=str(MODEL_DIR),
                return_all_scores=True,
            )
        elif LIGHTWEIGHT_MODEL_PATH.exists():
            with LIGHTWEIGHT_MODEL_PATH.open("rb") as handle:
                model_bundle = pickle.load(handle)
            self.vectorizer = model_bundle["vectorizer"]
            self.lightweight_classifier = model_bundle["classifier"]
        elif bootstrap_train:
            trained_path = train_log_model(str(TRAINING_DATA_PATH))
            if trained_path == MODEL_DIR and TRANSFORMER_SUPPORT:
                self.classifier = pipeline(
                    "text-classification",
                    model=str(MODEL_DIR),
                    tokenizer=str(MODEL_DIR),
                    return_all_scores=True,
                )
            elif LIGHTWEIGHT_MODEL_PATH.exists():
                with LIGHTWEIGHT_MODEL_PATH.open("rb") as handle:
                    model_bundle = pickle.load(handle)
                self.vectorizer = model_bundle["vectorizer"]
                self.lightweight_classifier = model_bundle["classifier"]

    def _heuristic_signal(self, text: str) -> tuple[float, str]:
        matched_categories = [name for name, pattern in HEURISTIC_PATTERNS.items() if pattern.search(text)]
        if not matched_categories:
            return 0.0, "normal"
        heuristic_score = min(0.95, 0.28 + len(matched_categories) * 0.16)
        return heuristic_score, matched_categories[0]

    def _severity_signal(self, text: str) -> float:
        lowered = text.lower()
        for severity, score in SEVERITY_SCORES.items():
            if severity in lowered:
                return score
        return 0.1

    def classify_log_batch(self, log_lines: List[str]) -> List[dict]:
        if not log_lines:
            return []
        batch = log_lines[:32]
        results = []
        transformer_predictions = self.classifier(batch, truncation=True) if self.classifier else None
        lightweight_probabilities = None
        if self.lightweight_classifier and self.vectorizer:
            matrix = self.vectorizer.transform(batch)
            lightweight_probabilities = self.lightweight_classifier.predict_proba(matrix)[:, 1].tolist()

        for index, text in enumerate(batch):
            bert_score = 0.0
            if transformer_predictions:
                prediction_scores = transformer_predictions[index]
                bert_score = next((item["score"] for item in prediction_scores if item["label"].endswith("1")), 0.0)
            elif lightweight_probabilities:
                bert_score = float(lightweight_probabilities[index])
            heuristic_score, category = self._heuristic_signal(text)
            severity_score = self._severity_signal(text)
            anomalous_score = min(0.99, bert_score * 0.6 + heuristic_score * 0.25 + severity_score * 0.15)
            results.append({
                "text": text,
                "bert_probability": float(bert_score),
                "heuristic_probability": float(heuristic_score),
                "anomaly_probability": float(anomalous_score),
                "severity_score": float(severity_score),
                "category": category,
                "is_anomalous": anomalous_score >= 0.68,
            })
        return results


if __name__ == "__main__":
    if not TRAINING_DATA_PATH.exists():
        generate_log_training_data()
    train_log_model(str(TRAINING_DATA_PATH))
