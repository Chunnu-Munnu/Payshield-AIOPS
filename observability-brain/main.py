import asyncio
import logging
import os
from collections import deque
from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from pythonjsonlogger import jsonlogger

from blockchain_logger import BlockchainLogger
from correlation.root_cause_engine import RootCauseEngine
from failure_injector import FailureInjector
from ingestion.jaeger_poller import JaegerPoller
from ingestion.loki_poller import LokiPoller
from ingestion.prometheus_poller import PrometheusPoller
from models.log_anomaly_detector import (
    MODEL_DIR as LOG_MODEL_DIR,
    TRAINING_DATA_PATH as LOG_TRAINING_DATA_PATH,
    LogAnomalyDetector,
    generate_log_training_data,
    train_log_model,
)
from models.lstm_detector import LSTMDetector, TRAINING_DATA_PATH, WEIGHTS_PATH, generate_training_data, train_lstm
from orchestrator import Orchestrator
from remediation.remediation_engine import RemediationEngine


def configure_logging() -> logging.Logger:
    handler = logging.StreamHandler()
    handler.setFormatter(jsonlogger.JsonFormatter("%(asctime)s %(levelname)s %(message)s"))
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)
    return logging.getLogger("observability-brain")


logger = configure_logging()
app = FastAPI(title="PayShield Observability Brain", version="1.0.0")
websocket_clients: set[WebSocket] = set()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

prometheus_poller = PrometheusPoller()
loki_poller = LokiPoller()
jaeger_poller = JaegerPoller()

if not TRAINING_DATA_PATH.exists():
    generate_training_data()
if not LOG_TRAINING_DATA_PATH.exists():
    generate_log_training_data()

lstm_detector = LSTMDetector()
log_detector = LogAnomalyDetector()
blockchain_logger = BlockchainLogger()
root_cause_engine = RootCauseEngine()
failure_injector = FailureInjector()


async def broadcast_event(payload: dict) -> None:
    closed = []
    for websocket in websocket_clients:
        try:
            await websocket.send_json(payload)
        except Exception:
            closed.append(websocket)
    for websocket in closed:
        websocket_clients.discard(websocket)


remediation_engine = RemediationEngine(blockchain_logger=blockchain_logger, step_callback=broadcast_event)


orchestrator = Orchestrator(
    prometheus_poller=prometheus_poller,
    loki_poller=loki_poller,
    jaeger_poller=jaeger_poller,
    lstm_detector=lstm_detector,
    log_detector=log_detector,
    root_cause_engine=root_cause_engine,
    remediation_engine=remediation_engine,
    blockchain_logger=blockchain_logger,
    broadcast=broadcast_event,
)


@app.on_event("startup")
async def startup() -> None:
    if os.getenv("OBSERVABILITY_TRAIN_ON_BOOT", "false").lower() == "true":
        if not WEIGHTS_PATH.exists():
            train_lstm(str(TRAINING_DATA_PATH))
        if not LOG_MODEL_DIR.exists() and not (LOG_MODEL_DIR / "lightweight_log_model.pkl").exists():
            train_log_model(str(LOG_TRAINING_DATA_PATH))
    asyncio.create_task(prometheus_poller.run_forever())
    asyncio.create_task(loki_poller.run_forever())
    asyncio.create_task(jaeger_poller.run_forever())
    asyncio.create_task(orchestrator.run_forever())
    logger.info("observability_brain_started")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "observability-brain", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/metrics")
async def metrics() -> Response:
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/api/anomalies")
async def anomalies() -> list:
    return list(orchestrator.anomalies)


@app.get("/api/root-cause/latest")
async def latest_root_cause() -> dict:
    return orchestrator.latest_root_cause.to_dict() if orchestrator.latest_root_cause else {}


@app.get("/api/remediation/history")
async def remediation_history() -> list:
    return [record.to_dict() for record in orchestrator.remediation_history]


@app.post("/api/inject-failure")
async def inject_failure(body: dict) -> JSONResponse:
    failure_type = body.get("type", "cascade_failure")
    orchestrator.reset_for_demo()
    await broadcast_event({
        "type": "DEMO_RESET",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    await broadcast_event({
        "type": "DEMO_INJECTION_STARTED",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "failureType": failure_type,
        "message": f"{failure_type} scheduled. Waiting for telemetry to confirm the incident.",
    })
    result = await failure_injector.inject(failure_type)
    return JSONResponse(
        {
            "failure_type": failure_type,
            "status": "scheduled",
            "scheduled_at": datetime.now(timezone.utc).isoformat(),
            "details": result.get("details", {}),
        }
    )


@app.websocket("/ws/live-feed")
async def websocket_live_feed(websocket: WebSocket) -> None:
    await websocket.accept()
    websocket_clients.add(websocket)
    try:
        while True:
            await asyncio.sleep(15)
            await websocket.send_json({"type": "HEARTBEAT", "timestamp": datetime.now(timezone.utc).isoformat()})
    except WebSocketDisconnect:
        websocket_clients.discard(websocket)
    except Exception:
        websocket_clients.discard(websocket)
