# FILE: ensemble.py
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
import time

from observability import cosine_confidence, get_logger, log_model_event, maybe_apply_slow_mode, maybe_raise_oom_pressure, record_ensemble_decision, record_model_confidence, timed_model_inference, traced_operation

router = APIRouter()
logger = get_logger("payshield-ml.ensemble")

class EnsembleInput(BaseModel):
    features: List[float]

@router.post("/score")
async def score_ensemble(data: EnsembleInput):
    from models.ensemble_model import EnsembleModel
    import numpy as np
    await maybe_apply_slow_mode()
    maybe_raise_oom_pressure()
    model = EnsembleModel.get_instance()
    started_at = time.perf_counter()
    try:
        with timed_model_inference("XGBoost"):
            with traced_operation("ensemble_voting", model_name="XGBoost"):
                res = model.predict(np.array(data.features, dtype=np.float32))
        score = record_model_confidence("XGBoost", res.get("ensemble_score", 0.5))
        res["ensemble_score"] = score
        if score >= 0.9:
            decision = "block"
        elif score >= 0.7:
            decision = "quarantine"
        elif score >= 0.5:
            decision = "step_up_auth"
        else:
            decision = "approve"
        record_ensemble_decision(decision, score)
        log_model_event(
            logger,
            "ensemble_inference_complete",
            model_name="XGBoost",
            inference_latency_ms=(time.perf_counter() - started_at) * 1000,
            confidence_score=cosine_confidence(score, res.get("xgb_score", 0.5), res.get("lgb_score", 0.5), res.get("iso_score", 0.5)),
            decision=decision,
        )
        return res
    except Exception as e:
        return {"xgb_score": 0.5, "lgb_score": 0.5, "iso_score": 0.5, "ensemble_score": 0.5, "error": str(e)}
