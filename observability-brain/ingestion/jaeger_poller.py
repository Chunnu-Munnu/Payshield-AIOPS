import asyncio
import time
from collections import deque
from threading import Lock
from typing import Deque, Dict, List

import httpx


JAEGER_URL = "http://jaeger:16686"
OPERATION_WEIGHTS = {
    "ml_engine_http_call": 1.0,
    "ensemble_voting": 0.9,
    "shap_explanation_computation": 0.65,
    "blockchain_write": 0.85,
    "websocket_broadcast": 0.45,
}


class JaegerPoller:
    def __init__(self, base_url: str = JAEGER_URL) -> None:
        self.base_url = base_url.rstrip("/")
        self.buffer: Deque[Dict[str, object]] = deque(maxlen=1000)
        self.lock = Lock()
        self.client = httpx.AsyncClient(timeout=8.0)
        self.services = ["payshield-backend", "payshield-ml-engine"]

    async def _fetch_service_traces(self, service_name: str) -> List[Dict[str, object]]:
        end_ts = int(time.time() * 1_000_000)
        start_ts = end_ts - 60_000_000
        response = await self.client.get(
            f"{self.base_url}/api/traces",
            params={"service": service_name, "start": start_ts, "end": end_ts, "limit": 20},
        )
        response.raise_for_status()
        return response.json().get("data", [])

    async def poll_once(self) -> List[Dict[str, object]]:
        flagged = []
        for service_name in self.services:
            try:
                traces = await self._fetch_service_traces(service_name)
            except Exception:
                continue
            for trace in traces:
                processes = trace.get("processes", {})
                for span in trace.get("spans", []):
                    process = processes.get(span.get("processID"), {})
                    service = process.get("serviceName", service_name)
                    tags = {tag.get("key"): tag.get("value") for tag in span.get("tags", [])}
                    duration_ms = span.get("duration", 0) / 1000
                    error = bool(tags.get("error"))
                    http_status = tags.get("http.status_code")
                    if duration_ms > 2000 or error:
                        base_weight = OPERATION_WEIGHTS.get(span.get("operationName"), 0.55)
                        severity = min(
                            0.99,
                            base_weight +
                            (0.22 if error else 0.0) +
                            min(0.3, max(0.0, duration_ms - 2000) / 8000),
                        )
                        flagged.append({
                            "traceId": trace.get("traceID"),
                            "service": service,
                            "operation": span.get("operationName"),
                            "duration_ms": duration_ms,
                            "error": error,
                            "http.status_code": http_status,
                            "severity": severity,
                            "start_time": span.get("startTime", 0),
                        })

        with self.lock:
            self.buffer.extend(flagged)
        return flagged

    async def run_forever(self) -> None:
        while True:
            try:
                await self.poll_once()
            finally:
                await asyncio.sleep(3)

    def get_buffer(self) -> Deque[Dict[str, object]]:
        with self.lock:
            return deque(self.buffer, maxlen=1000)
