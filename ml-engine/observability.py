import asyncio
import gc
import logging
import math
import random
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Optional

from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode
from prometheus_client import Counter, Histogram
from pythonjsonlogger import jsonlogger


MODEL_INFERENCE_LATENCY = Histogram(
    "payshield_model_inference_latency_seconds",
    "Latency of model inference endpoints",
    labelnames=["model_name"],
    buckets=[0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10],
)

MODEL_CONFIDENCE_SCORE = Histogram(
    "payshield_model_confidence_score",
    "Model confidence scores emitted by the ML engine",
    labelnames=["model_name"],
    buckets=[i / 10 for i in range(11)],
)

ENSEMBLE_DECISION_TOTAL = Counter(
    "payshield_ensemble_decision_total",
    "Total ensemble decisions by outcome and risk band",
    labelnames=["decision", "risk_band"],
)

FEATURE_EXTRACTION_LATENCY = Histogram(
    "payshield_feature_extraction_latency_seconds",
    "Latency of feature extraction",
    buckets=[0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5],
)

DISTILBERT_TOKENIZATION_LATENCY = Histogram(
    "payshield_distilbert_tokenization_latency_seconds",
    "Latency of DistilBERT tokenization and text pre-processing",
    buckets=[0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2],
)

ANOMALY_DETECTED_TOTAL = Counter(
    "payshield_anomaly_detected_total",
    "Detected anomalies by anomaly type",
    labelnames=["anomaly_type"],
)

_SLOW_MODE_UNTIL = 0.0
_OOM_MODE_UNTIL = 0.0


class TraceContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        span = trace.get_current_span()
        span_context = span.get_span_context() if span else None
        record.timestamp = datetime.now(timezone.utc).isoformat()
        record.service = "payshield-ml-engine"
        record.traceId = f"{span_context.trace_id:032x}" if span_context and span_context.is_valid else None
        record.spanId = f"{span_context.span_id:016x}" if span_context and span_context.is_valid else None
        if not hasattr(record, "model_name"):
            record.model_name = None
        if not hasattr(record, "inference_latency_ms"):
            record.inference_latency_ms = None
        if not hasattr(record, "confidence_score"):
            record.confidence_score = None
        return True


def configure_logging() -> logging.Logger:
    root_logger = logging.getLogger()
    if getattr(root_logger, "_payshield_json_logging", False):
        return logging.getLogger("payshield-ml")

    handler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter(
        "%(timestamp)s %(levelname)s %(service)s %(traceId)s %(spanId)s %(message)s %(model_name)s %(inference_latency_ms)s %(confidence_score)s"
    )
    handler.setFormatter(formatter)
    handler.addFilter(TraceContextFilter())

    root_logger.handlers = [handler]
    root_logger.setLevel(logging.INFO)
    root_logger._payshield_json_logging = True
    return logging.getLogger("payshield-ml")


def get_logger(name: str = "payshield-ml") -> logging.Logger:
    return logging.getLogger(name)


@contextmanager
def traced_operation(name: str, **attributes):
    tracer = trace.get_tracer("payshield-ml-engine")
    with tracer.start_as_current_span(name) as span:
        for key, value in attributes.items():
            if value is not None:
                span.set_attribute(key, value)
        yield span


@contextmanager
def timed_model_inference(model_name: str):
    started_at = time.perf_counter()
    with traced_operation(f"{model_name.lower()}_model_inference", model_name=model_name) as span:
        try:
            yield span
        except Exception as exc:
            duration_seconds = time.perf_counter() - started_at
            MODEL_INFERENCE_LATENCY.labels(model_name=model_name).observe(duration_seconds)
            span.record_exception(exc)
            span.set_status(Status(StatusCode.ERROR, str(exc)))
            raise
        else:
            duration_seconds = time.perf_counter() - started_at
            MODEL_INFERENCE_LATENCY.labels(model_name=model_name).observe(duration_seconds)
            span.set_attribute("inference_latency_ms", round(duration_seconds * 1000, 2))


def record_model_confidence(model_name: str, confidence_score: float) -> float:
    bounded = max(0.0, min(1.0, float(confidence_score)))
    MODEL_CONFIDENCE_SCORE.labels(model_name=model_name).observe(bounded)
    return bounded


def record_ensemble_decision(decision: str, confidence_score: float) -> None:
    risk_band = "low"
    if confidence_score >= 0.85:
        risk_band = "critical"
    elif confidence_score >= 0.7:
        risk_band = "high"
    elif confidence_score >= 0.5:
        risk_band = "medium"
    ENSEMBLE_DECISION_TOTAL.labels(decision=decision, risk_band=risk_band).inc()


async def maybe_apply_slow_mode() -> None:
    if time.time() < _SLOW_MODE_UNTIL:
        await asyncio.sleep(random.uniform(3, 6))


def enable_slow_mode(duration_seconds: int = 60) -> float:
    global _SLOW_MODE_UNTIL
    _SLOW_MODE_UNTIL = time.time() + max(1, duration_seconds)
    return _SLOW_MODE_UNTIL


def enable_oom_mode(duration_seconds: int = 45) -> float:
    global _OOM_MODE_UNTIL
    _OOM_MODE_UNTIL = time.time() + max(1, duration_seconds)
    return _OOM_MODE_UNTIL


def oom_mode_active() -> bool:
    return time.time() < _OOM_MODE_UNTIL


async def run_safe_oom_stress(max_chunks: int = 18, chunk_dim: int = 4096) -> dict:
    allocations = []
    allocated_bytes = 0
    chunk_bytes = chunk_dim * chunk_dim * 4
    try:
        for _ in range(max_chunks):
            allocations.append(bytearray(chunk_bytes))
            allocated_bytes += chunk_bytes
            await asyncio.sleep(0)
        return {
            "status": "pressure_created_without_runtime_oom",
            "device": "cpu-memory",
            "allocated_mb": round(allocated_bytes / (1024 * 1024), 2),
        }
    except MemoryError as exc:
        ANOMALY_DETECTED_TOTAL.labels(anomaly_type="ml_engine_oom").inc()
        return {
            "status": "oom_detected",
            "device": "cpu-memory",
            "allocated_mb": round(allocated_bytes / (1024 * 1024), 2),
            "error": str(exc),
        }
    finally:
        allocations.clear()
        gc.collect()


def maybe_raise_oom_pressure() -> None:
    if oom_mode_active():
        raise RuntimeError("ML engine under OOM pressure")


def log_model_event(
    logger: logging.Logger,
    message: str,
    *,
    model_name: Optional[str] = None,
    inference_latency_ms: Optional[float] = None,
    confidence_score: Optional[float] = None,
    level: int = logging.INFO,
    **extra,
) -> None:
    payload = dict(extra)
    payload["model_name"] = model_name
    payload["inference_latency_ms"] = None if inference_latency_ms is None else round(float(inference_latency_ms), 2)
    payload["confidence_score"] = None if confidence_score is None else round(float(confidence_score), 4)
    logger.log(level, message, extra=payload)


def cosine_confidence(*values: float) -> float:
    if not values:
        return 0.0
    squared_sum = sum(float(value) ** 2 for value in values)
    return min(1.0, math.sqrt(squared_sum / len(values)))
