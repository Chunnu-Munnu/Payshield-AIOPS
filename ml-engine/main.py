# FILE: main.py
# ROLE: FastAPI entry point
# INSPIRED BY: Production ML serving architecture
# PERFORMANCE TARGET: Cold start < 30s, warm inference < 200ms

import logging
import os

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from routers import features, ensemble, gnn, lstm, biometrics, aml, bec, continual, federated, explainability
from data.synthetic_data_gen import ensure_training_data
from observability import (
    ANOMALY_DETECTED_TOTAL,
    configure_logging,
    enable_oom_mode,
    enable_slow_mode,
    get_logger,
    run_safe_oom_stress,
)
from otel_setup import setup_opentelemetry

configure_logging()
logger = get_logger("payshield-ml")
BOOTSTRAP_TRAINING_DATA = os.getenv("ML_ENGINE_BOOTSTRAP_DATA", "false").lower() == "true"

app = FastAPI(title="PayShield AI ML Engine", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
setup_opentelemetry(app)
Instrumentator(excluded_handlers=["/metrics"]).instrument(app).expose(app, include_in_schema=False)

app.include_router(features.router, prefix="/features", tags=["features"])
app.include_router(ensemble.router, prefix="/ensemble", tags=["ensemble"])
app.include_router(gnn.router, prefix="/gnn", tags=["gnn"])
app.include_router(lstm.router, prefix="/lstm", tags=["lstm"])
app.include_router(biometrics.router, prefix="/biometrics", tags=["biometrics"])
app.include_router(aml.router, prefix="/aml", tags=["aml"])
app.include_router(bec.router, prefix="/bec", tags=["bec"])
app.include_router(continual.router, prefix="/continual", tags=["continual"])
app.include_router(federated.router, prefix="/federated", tags=["federated"])
app.include_router(explainability.router, prefix="/explainability", tags=["explainability"])


@app.on_event("startup")
async def startup_event():
    if BOOTSTRAP_TRAINING_DATA:
        ensure_training_data()
    logger.info("PayShield ML Engine ready", extra={"bootstrap_training_data": BOOTSTRAP_TRAINING_DATA})


@app.get("/")
async def root():
    return {
        "service": "payshield-ml-engine",
        "status": "ok",
        "health": "/health",
        "metrics": "/metrics",
        "routes": [
            "/features/extract",
            "/gnn/score",
            "/lstm/score",
            "/ensemble/score",
            "/biometrics/score",
            "/aml/score",
            "/bec/score",
            "/explainability/explain",
        ],
    }


@app.get("/health")
async def health():
    return {"status": "ok", "models": "loaded", "version": "1.0.0", "service": "payshield-ml-engine"}


@app.post("/debug/slow")
async def debug_slow(body: dict | None = None):
    if os.getenv("NODE_ENV") == "production" and os.getenv("ENABLE_DEBUG_ENDPOINTS") != "true":
        return {"status": "disabled"}
    duration_seconds = int((body or {}).get("duration_seconds", 60))
    enable_slow_mode(duration_seconds)
    ANOMALY_DETECTED_TOTAL.labels(anomaly_type="ml_engine_latency_injection").inc()
    logger.warning("ML engine slow mode enabled", extra={"duration_seconds": duration_seconds})
    return {"status": "ok", "mode": "slow", "duration_seconds": duration_seconds}


@app.post("/debug/stress")
async def debug_stress(body: dict | None = None):
    if os.getenv("NODE_ENV") == "production" and os.getenv("ENABLE_DEBUG_ENDPOINTS") != "true":
        return {"status": "disabled"}
    duration_seconds = int((body or {}).get("duration_seconds", 45))
    enable_oom_mode(duration_seconds)
    result = await run_safe_oom_stress()
    logger.warning("ML engine stress mode enabled", extra={"duration_seconds": duration_seconds, "stress_result": result})
    return {"status": "ok", "mode": "oom_pressure", "duration_seconds": duration_seconds, "stress_result": result}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
