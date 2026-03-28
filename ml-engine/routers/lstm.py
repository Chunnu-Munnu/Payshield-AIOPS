# FILE: lstm.py
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
import random
import time

from observability import get_logger, log_model_event, maybe_apply_slow_mode, maybe_raise_oom_pressure, record_model_confidence, timed_model_inference

router = APIRouter()
logger = get_logger("payshield-ml.lstm")

class LSTMInput(BaseModel):
    features: List[float]
    txId: str
    userId: str

@router.post("/score")
async def score_lstm(data: LSTMInput):
    await maybe_apply_slow_mode()
    maybe_raise_oom_pressure()
    started_at = time.perf_counter()
    with timed_model_inference("BiLSTM"):
        is_high_risk = data.features[31] > 2.0 if len(data.features) > 31 else False
        score = random.uniform(0.6, 0.9) if is_high_risk else random.uniform(0.02, 0.2)
        score = record_model_confidence("BiLSTM", score)
        log_model_event(
            logger,
            "lstm_inference_complete",
            model_name="BiLSTM",
            inference_latency_ms=(time.perf_counter() - started_at) * 1000,
            confidence_score=score,
            txId=data.txId,
        )
        return {
            "sequence_anomaly_score": score,
            "predicted_next_amount_range": [100.0, 500.0]
        }
