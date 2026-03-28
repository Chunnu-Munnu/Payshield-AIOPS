# FILE: bec.py
from fastapi import APIRouter
from pydantic import BaseModel
import time

from observability import ANOMALY_DETECTED_TOTAL, DISTILBERT_TOKENIZATION_LATENCY, get_logger, log_model_event, maybe_apply_slow_mode, maybe_raise_oom_pressure, record_model_confidence, timed_model_inference, traced_operation

router = APIRouter()
logger = get_logger("payshield-ml.bec")

class BECInput(BaseModel):
    memo: str
    txId: str

@router.post("/score")
async def score_bec(data: BECInput):
    from models.transformer_bec import BECTransformer
    await maybe_apply_slow_mode()
    maybe_raise_oom_pressure()
    model = BECTransformer.get_instance()
    started_at = time.perf_counter()
    try:
        with traced_operation("distilbert_tokenization", model_name="DistilBERT"):
            tokenization_started = time.perf_counter()
            memo = (data.memo or "")[:512]
            DISTILBERT_TOKENIZATION_LATENCY.observe(time.perf_counter() - tokenization_started)
        with timed_model_inference("DistilBERT"):
            result = model.predict(memo)
            score = record_model_confidence("DistilBERT", result.get("bec_score", 0.02))
            result["bec_score"] = score
            if result.get("is_bec"):
                ANOMALY_DETECTED_TOTAL.labels(anomaly_type="bec_text").inc()
            log_model_event(
                logger,
                "distilbert_inference_complete",
                model_name="DistilBERT",
                inference_latency_ms=(time.perf_counter() - started_at) * 1000,
                confidence_score=score,
                txId=data.txId,
            )
            return result
    except Exception as e:
        return {"bec_score": 0.02, "is_bec": False, "flagged_phrases": [], "risk_reason": str(e)}
