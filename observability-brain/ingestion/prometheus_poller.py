import asyncio
import socket
import time
from collections import deque
from threading import Lock
from typing import Deque, Dict

import httpx
import docker


PROMETHEUS_URL = "http://prometheus:9090"


class PrometheusPoller:
    def __init__(self, base_url: str = PROMETHEUS_URL) -> None:
        self.base_url = base_url.rstrip("/")
        self.buffer: Deque[Dict[str, float]] = deque(maxlen=300)
        self.lock = Lock()
        self.client = httpx.AsyncClient(timeout=5.0)
        try:
            self.docker = docker.from_env()
        except Exception:
            self.docker = None
        self.query_map = {
            "ml_engine_latency_p95": 'histogram_quantile(0.95, sum(rate(payshield_ml_engine_latency_seconds_bucket[2m])) by (le))',
            "backend_error_rate": 'sum(rate(http_request_duration_seconds_count{status=~"5.."}[2m])) / clamp_min(sum(rate(http_request_duration_seconds_count[2m])), 0.0001)',
            "fraud_score_mean": 'sum(rate(payshield_fraud_score_histogram_sum[2m])) / clamp_min(sum(rate(payshield_fraud_score_histogram_count[2m])), 0.0001)',
            "ensemble_confidence_mean": 'sum(rate(payshield_model_confidence_score_sum{model_name="XGBoost"}[2m])) / clamp_min(sum(rate(payshield_model_confidence_score_count{model_name="XGBoost"}[2m])), 0.0001)',
            "blockchain_write_latency_p95": 'histogram_quantile(0.95, sum(rate(payshield_blockchain_write_latency_seconds_bucket[2m])) by (le))',
            "websocket_connections": 'sum(payshield_websocket_connections_active)',
            "transaction_rate": 'sum(rate(payshield_transactions_total[2m]))',
            "cpu_usage_backend": 'sum(rate(payshield_backend_process_cpu_seconds_total[2m]))',
            "cpu_usage_ml": 'sum(rate(process_cpu_seconds_total{job="payshield-ml-engine"}[2m]))',
            "memory_usage_backend": 'sum(payshield_backend_process_resident_memory_bytes)',
            "memory_usage_ml": 'sum(process_resident_memory_bytes{job="payshield-ml-engine"})',
            "bec_detection_rate": 'sum(rate(payshield_email_bec_detections_total[2m]))',
            "brain_cpu_usage": 'sum(rate(process_cpu_seconds_total{job="observability-brain"}[2m]))',
            "brain_memory_usage": 'sum(process_resident_memory_bytes{job="observability-brain"})',
            "runtime_fallback_active": "sum(payshield_runtime_fallback_active)",
            "cache_fallback_active": "sum(payshield_cache_fallback_active)",
        }

    async def _probe_http(self, url: str) -> float:
        try:
            response = await self.client.get(url)
            return 1.0 if response.status_code == 200 else 0.0
        except Exception:
            return 0.0

    def _probe_tcp(self, host: str, port: int) -> float:
        try:
            with socket.create_connection((host, port), timeout=1.5):
                return 1.0
        except OSError:
            return 0.0

    def _container_running(self, container_name: str) -> float:
        if not self.docker:
            return 1.0
        try:
            container = self.docker.containers.get(container_name)
            container.reload()
            return 1.0 if container.status == "running" else 0.0
        except Exception:
            return 0.0

    async def _query(self, expression: str) -> float:
        response = await self.client.get(f"{self.base_url}/api/v1/query", params={"query": expression})
        response.raise_for_status()
        payload = response.json()
        result = payload.get("data", {}).get("result", [])
        if not result:
            return 0.0
        return float(result[0]["value"][1])

    async def poll_once(self) -> Dict[str, float]:
        snapshot: Dict[str, float] = {"timestamp": time.time()}
        for name, expression in self.query_map.items():
            try:
                snapshot[name] = await self._query(expression)
            except Exception:
                snapshot[name] = 0.0

        snapshot["frontend_health"] = self._probe_tcp("payshield-frontend", 5173)
        snapshot["backend_health"] = await self._probe_http("http://payshield-backend:3001/health")
        snapshot["ml_engine_health"] = await self._probe_http("http://payshield-ml-engine:8000/health")
        snapshot["blockchain_rpc_health"] = self._probe_tcp("payshield-blockchain", 8545)
        snapshot["redis_tcp_health"] = self._probe_tcp("redis", 6379)
        snapshot["frontend_container_running"] = self._container_running("payshield-frontend")
        snapshot["backend_container_running"] = self._container_running("payshield-backend")
        snapshot["ml_engine_container_running"] = self._container_running("payshield-ml-engine")
        snapshot["blockchain_container_running"] = self._container_running("payshield-blockchain")
        snapshot["simulator_container_running"] = self._container_running("payshield-simulator")
        snapshot["redis_container_running"] = self._container_running("redis")

        with self.lock:
            self.buffer.append(snapshot)
        return snapshot

    async def run_forever(self) -> None:
        while True:
            await self.poll_once()
            await asyncio.sleep(2)

    def get_buffer(self) -> Deque[Dict[str, float]]:
        with self.lock:
            return deque(self.buffer, maxlen=300)
