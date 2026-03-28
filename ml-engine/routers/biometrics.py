# FILE: biometrics.py
from fastapi import APIRouter
from pydantic import BaseModel
import random
import time

from observability import get_logger, log_model_event, maybe_apply_slow_mode, maybe_raise_oom_pressure, record_model_confidence, timed_model_inference

router = APIRouter()
logger = get_logger("payshield-ml.biometrics")

class BioInput(BaseModel):
    behavioral_data: dict
    userId: str

@router.post("/score")
async def score_bio(data: BioInput):
    await maybe_apply_slow_mode()
    maybe_raise_oom_pressure()
    started_at = time.perf_counter()
    with timed_model_inference("BehavioralBiometrics"):
        trust = data.behavioral_data.get('trust_score', random.uniform(0.8, 1.0))
        if data.behavioral_data.get('is_bot'):
            trust = random.uniform(0.0, 0.2)
        trust = record_model_confidence("BehavioralBiometrics", trust)
        log_model_event(
            logger,
            "behavioral_biometrics_inference_complete",
            model_name="BehavioralBiometrics",
            inference_latency_ms=(time.perf_counter() - started_at) * 1000,
            confidence_score=trust,
            userId=data.userId,
        )
        return {
            "behavioral_trust_score": trust,
            "is_bot": trust < 0.3
        }
