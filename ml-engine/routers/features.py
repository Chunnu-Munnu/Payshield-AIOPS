# FILE: routers/features.py
# ROLE: Feature extraction endpoint — converts raw transaction to 47-dim vector
# INSPIRED BY: Feature engineering for payment fraud — Bahnsen et al.
# PERFORMANCE TARGET: < 10ms

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
import numpy as np
import time

from observability import FEATURE_EXTRACTION_LATENCY, get_logger, log_model_event, maybe_apply_slow_mode, maybe_raise_oom_pressure, traced_operation

router = APIRouter()
logger = get_logger("payshield-ml.features")

class TransactionInput(BaseModel):
    txId:             str
    amount:           float
    currency:         str = "INR"
    merchant:         str = ""
    country:          str = "IN"
    paymentMethod:    str = "UPI"
    memo:             Optional[str] = ""
    deviceId:         Optional[str] = ""
    timestamp:        Optional[str] = ""
    userId:           Optional[str] = ""
    upiId:            Optional[str] = ""
    behavioralData:   Optional[dict] = {}
    isLiveWebhook:    Optional[bool] = False
    isSMSTransaction: Optional[bool] = False
    isEmailScan:      Optional[bool] = False

HIGH_RISK_MERCHANTS = [
    "shell company", "unknown vendor", "new payee",
    "overseas transfer", "crypto exchange", "shell merchant"
]
HIGH_RISK_COUNTRIES = ["US", "AE", "SG", "MY", "PK"]
BEC_KEYWORDS = ["urgent", "immediately", "do not call", "do not verify",
                "confidential", "iban", "new account", "wire transfer",
                "bypass", "ceo", "cfo", "update bank"]

@router.post("/extract")
async def extract_features(tx: TransactionInput):
    started_at = time.perf_counter()
    await maybe_apply_slow_mode()
    maybe_raise_oom_pressure()
    with traced_operation("feature_extraction", txId=tx.txId):
        memo_lower = (tx.memo or "").lower()
        merchant_lower = tx.merchant.lower()

        is_high_risk_merchant = any(k in merchant_lower for k in HIGH_RISK_MERCHANTS)
        bec_indicator_count = sum(1 for k in BEC_KEYWORDS if k in memo_lower)
        behavioral = tx.behavioralData or {}

        features = np.array([
            0, 0, 0,
            tx.amount, tx.amount * 1,
            1 if is_high_risk_merchant else 0,
            1 if tx.country in HIGH_RISK_COUNTRIES else 0,
            0,
            0.8 if tx.country in HIGH_RISK_COUNTRIES else 0.1,
            0.8 if tx.country in HIGH_RISK_COUNTRIES else 0.1,
            500.0 if tx.country in HIGH_RISK_COUNTRIES else 5.0,
            0.7 if tx.country in HIGH_RISK_COUNTRIES else 0.1,
            1 if tx.country in HIGH_RISK_COUNTRIES else 0,
            0.7 if tx.country in HIGH_RISK_COUNTRIES else 0.0,
            0,
            0,
            1,
            0.5,
            0,
            0,
            0.5,
            behavioral.get("typingCadenceDeviation", 0.2),
            behavioral.get("touchPressure", 0.7),
            0.2,
            0.2,
            0.3,
            0.2,
            behavioral.get("copyPasteRatio", 0.0),
            0.2,
            0.8 if is_high_risk_merchant else 0.1,
            0 if is_high_risk_merchant else 1,
            tx.amount / 2000,
            1.0 if is_high_risk_merchant else 0.5,
            0.2,
            0,
            1 if tx.paymentMethod in ["Card", "UPI"] else 0,
            0,
            1 if is_high_risk_merchant else 0,
            0, 0,
            0.7 if is_high_risk_merchant else 0.1,
            0.3,
            0,
            0.2,
            5,
            1,
            0,
        ], dtype=np.float32)

        latency_ms = (time.perf_counter() - started_at) * 1000
        FEATURE_EXTRACTION_LATENCY.observe(latency_ms / 1000)
        log_model_event(
            logger,
            "feature_extraction_complete",
            model_name="FeatureExtractor",
            inference_latency_ms=latency_ms,
            confidence_score=min(1.0, bec_indicator_count / max(1, len(BEC_KEYWORDS))),
            txId=tx.txId,
            feature_dim=len(features),
        )

        return {
            "features": features.tolist(),
            "feature_dim": len(features),
            "merchant_risk": "HIGH" if is_high_risk_merchant else "LOW",
            "bec_indicator_count": bec_indicator_count,
            "country_risk": "HIGH" if tx.country in HIGH_RISK_COUNTRIES else "LOW",
        }
