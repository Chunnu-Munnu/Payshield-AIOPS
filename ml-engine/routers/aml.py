# FILE: aml.py
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
import random
import time

from observability import ANOMALY_DETECTED_TOTAL, get_logger, log_model_event, maybe_apply_slow_mode, maybe_raise_oom_pressure, record_model_confidence, timed_model_inference

router = APIRouter()
logger = get_logger("payshield-ml.aml")

class AMLInput(BaseModel):
    features: List[float]
    txId: str
    userId: str
    amount: float

@router.post("/score")
async def score_aml(data: AMLInput):
    await maybe_apply_slow_mode()
    maybe_raise_oom_pressure()
    started_at = time.perf_counter()
    with timed_model_inference("AML_GNN"):
        is_smurf = 49000 <= data.amount <= 49999
        is_high = data.amount > 500000

        score = 0.05
        pattern = None
        if is_smurf:
            score = random.uniform(0.8, 0.95)
            pattern = "Structuring / Smurfing just below 50k threshold"
            ANOMALY_DETECTED_TOTAL.labels(anomaly_type="aml_structuring").inc()
        elif is_high:
            score = random.uniform(0.6, 0.85)
            pattern = "Unusually high value transfer"
            ANOMALY_DETECTED_TOTAL.labels(anomaly_type="aml_high_value").inc()

        score = record_model_confidence("AML_GNN", score)
        log_model_event(
            logger,
            "aml_inference_complete",
            model_name="AML_GNN",
            inference_latency_ms=(time.perf_counter() - started_at) * 1000,
            confidence_score=score,
            txId=data.txId,
            detected_pattern=pattern,
        )
        return {
            "aml_risk_score": score,
            "detected_pattern": pattern,
            "suspicious_accounts": ["XX1234"] if score > 0.7 else []
        }
