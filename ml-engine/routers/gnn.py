# FILE: gnn.py
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
import random
import time

from observability import get_logger, log_model_event, maybe_apply_slow_mode, maybe_raise_oom_pressure, record_model_confidence, timed_model_inference

router = APIRouter()
logger = get_logger("payshield-ml.gnn")

class GNNInput(BaseModel):
    features: List[float]
    txId: str
    userId: str

@router.post("/score")
async def score_gnn(data: GNNInput):
    await maybe_apply_slow_mode()
    maybe_raise_oom_pressure()
    started_at = time.perf_counter()
    with timed_model_inference("GNN"):
        is_high_risk = data.features[29] > 0.5 if len(data.features) > 29 else False
        score = random.uniform(0.7, 0.95) if is_high_risk else random.uniform(0.01, 0.15)
        score = record_model_confidence("GNN", score)
        log_model_event(
            logger,
            "gnn_inference_complete",
            model_name="GNN",
            inference_latency_ms=(time.perf_counter() - started_at) * 1000,
            confidence_score=score,
            txId=data.txId,
        )
        return {
            "node_fraud_probability": score,
            "subgraph_centrality": random.uniform(0.1, 0.8),
            "distance_to_fraud": random.randint(1, 5) if is_high_risk else random.randint(6, 20)
        }
