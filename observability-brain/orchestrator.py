import asyncio
import logging
import time
from collections import deque
from datetime import datetime, timezone
from typing import Callable, List

from prometheus_client import Counter, Gauge

from blockchain_logger import BlockchainLogger
from correlation.root_cause_engine import RootCauseEngine, RootCauseResult
from ingestion.jaeger_poller import JaegerPoller
from ingestion.loki_poller import LokiPoller
from ingestion.prometheus_poller import PrometheusPoller
from models.log_anomaly_detector import LogAnomalyDetector
from models.lstm_detector import LSTMDetector
from remediation.remediation_engine import RemediationEngine, RemediationRecord


LOGGER = logging.getLogger("observability-brain.orchestrator")
LAST_CYCLE_DURATION_MS = Gauge("last_cycle_duration_ms", "Duration of the last orchestration cycle in milliseconds")
ANOMALY_EVENTS_TOTAL = Counter("observability_brain_anomaly_events_total", "Total anomaly events emitted by the brain")
ANOMALY_CONFIRMATIONS_TOTAL = Counter(
    "observability_brain_confirmed_incidents_total",
    "Total confirmed incidents after consensus and repeat-cycle validation",
)


class Orchestrator:
    def __init__(
        self,
        prometheus_poller: PrometheusPoller,
        loki_poller: LokiPoller,
        jaeger_poller: JaegerPoller,
        lstm_detector: LSTMDetector,
        log_detector: LogAnomalyDetector,
        root_cause_engine: RootCauseEngine,
        remediation_engine: RemediationEngine,
        blockchain_logger: BlockchainLogger,
        broadcast: Callable[[dict], asyncio.Future | None],
    ) -> None:
        self.prometheus_poller = prometheus_poller
        self.loki_poller = loki_poller
        self.jaeger_poller = jaeger_poller
        self.lstm_detector = lstm_detector
        self.log_detector = log_detector
        self.root_cause_engine = root_cause_engine
        self.remediation_engine = remediation_engine
        self.blockchain_logger = blockchain_logger
        self.broadcast = broadcast
        self.anomalies: deque = deque(maxlen=100)
        self.latest_root_cause: RootCauseResult | None = None
        self.remediation_history: List[RemediationRecord] = []
        self.last_actioned_signals: dict[str, float] = {}
        self.pending_confirmations: dict[str, int] = {}
        self.started_at = time.time()
        self.startup_grace_seconds = 20

    def _signal_key(self, root_cause: RootCauseResult) -> str:
        return f"{root_cause.root_cause_service}:{root_cause.failure_type}"

    def _should_remediate(self, root_cause: RootCauseResult, cooldown_seconds: int = 20) -> bool:
        signal_key = self._signal_key(root_cause)
        last_seen_at = self.last_actioned_signals.get(signal_key)
        if last_seen_at is None:
            return True
        return (time.time() - last_seen_at) >= cooldown_seconds

    def _requires_confirmation(self, root_cause: RootCauseResult) -> bool:
        if root_cause.failure_type in {"SUPPRESSED"}:
            return False
        if root_cause.confidence >= 0.85:
            return False
        if root_cause.failure_type in {"BLOCKCHAIN_HANG", "FRONTEND_OUTAGE", "LOAD_GENERATOR_STOPPED"}:
            return False
        return root_cause.signal_consensus < 2

    def reset_for_demo(self) -> None:
        self.anomalies.clear()
        self.latest_root_cause = None
        self.remediation_history = []
        self.remediation_engine.history = []
        self.last_actioned_signals.clear()
        self.pending_confirmations.clear()
        self.started_at = time.time() - self.startup_grace_seconds - 1

    async def run_forever(self) -> None:
        while True:
            cycle_started_at = time.time()
            try:
                metric_window = self.prometheus_poller.get_buffer()
                recent_logs = list(self.loki_poller.get_buffer())[-32:]
                trace_signals = list(self.jaeger_poller.get_buffer())[-50:]
                latest_snapshot = list(metric_window)[-1] if metric_window else {}

                metric_signals = self.lstm_detector.detect_degradation(metric_window)
                log_classifications = self.log_detector.classify_log_batch([item.get("message", "") for item in recent_logs])
                anomalous_logs = []
                for log_entry, classification in zip(recent_logs[-len(log_classifications):], log_classifications):
                    merged = {**log_entry, **classification}
                    if merged.get("is_anomalous"):
                        anomalous_logs.append(merged)

                root_cause = self.root_cause_engine.correlate(metric_signals, anomalous_logs, trace_signals, latest_snapshot)

                if root_cause.confidence > 0.65:
                    if (time.time() - self.started_at) < self.startup_grace_seconds:
                        LOGGER.info(
                            "anomaly_suppressed_startup_grace",
                            extra={
                                "service": root_cause.root_cause_service,
                                "failure_type": root_cause.failure_type,
                                "confidence": root_cause.confidence,
                            },
                        )
                        continue
                    signal_key = self._signal_key(root_cause)
                    if self._requires_confirmation(root_cause):
                        attempts = self.pending_confirmations.get(signal_key, 0) + 1
                        self.pending_confirmations[signal_key] = attempts
                        LOGGER.info(
                            "anomaly_pending_confirmation",
                            extra={
                                "service": root_cause.root_cause_service,
                                "failure_type": root_cause.failure_type,
                                "confidence": root_cause.confidence,
                                "signal_consensus": root_cause.signal_consensus,
                                "attempt": attempts,
                            },
                        )
                        if attempts < 2:
                            continue
                    else:
                        self.pending_confirmations.pop(signal_key, None)

                    if not self._should_remediate(root_cause):
                        LOGGER.info(
                            "anomaly_suppressed_cooldown",
                            extra={"service": root_cause.root_cause_service, "failure_type": root_cause.failure_type, "confidence": root_cause.confidence},
                        )
                        continue

                    anomaly_event = {
                        "type": "ANOMALY_DETECTED",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "rootCause": root_cause.to_dict(),
                    }
                    self.latest_root_cause = root_cause
                    self.anomalies.appendleft(anomaly_event)
                    ANOMALY_EVENTS_TOTAL.inc()
                    ANOMALY_CONFIRMATIONS_TOTAL.inc()
                    await self.blockchain_logger.log_anomaly(root_cause)
                    await self.broadcast(anomaly_event)

                    self.last_actioned_signals[signal_key] = time.time()
                    self.pending_confirmations.pop(signal_key, None)
                    remediation_record = await self.remediation_engine.remediate(root_cause)
                    self.remediation_history = self.remediation_engine.history
                    await self.broadcast({
                        "type": "REMEDIATION_EXECUTED",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "remediation": remediation_record.to_dict(),
                    })
                else:
                    LOGGER.info("anomaly_suppressed", extra={"confidence": root_cause.confidence, "service": root_cause.root_cause_service})
            except Exception as exc:
                LOGGER.error("orchestrator_cycle_failed", extra={"error": str(exc)})
            finally:
                duration_ms = int((time.time() - cycle_started_at) * 1000)
                LAST_CYCLE_DURATION_MS.set(duration_ms)
                if duration_ms > 12000:
                    LOGGER.warning("orchestrator_cycle_sla_warning", extra={"last_cycle_duration_ms": duration_ms})
                await asyncio.sleep(2)
