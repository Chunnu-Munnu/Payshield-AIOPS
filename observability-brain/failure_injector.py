import asyncio
import time
from typing import Dict
from uuid import uuid4

import docker
import httpx


class FailureInjector:
    def __init__(self) -> None:
        self.http = httpx.AsyncClient(timeout=10.0)
        self.docker = docker.from_env()

    async def inject(self, failure_type: str) -> Dict[str, object]:
        if failure_type == "ml_engine_oom":
            response = await self.http.post("http://payshield-ml-engine:8000/debug/stress", json={"duration_seconds": 45})
            asyncio.create_task(self._drive_backend_load(duration_seconds=10, concurrency=2, pause_seconds=0.6))
            return {"failure_type": failure_type, "status": "triggered", "details": response.json()}

        if failure_type == "ml_engine_latency":
            response = await self.http.post("http://payshield-ml-engine:8000/debug/slow", json={"duration_seconds": 45})
            asyncio.create_task(self._drive_backend_load(duration_seconds=12, concurrency=4, pause_seconds=0.5))
            return {
                "failure_type": failure_type,
                "status": "triggered",
                "details": {
                    **response.json(),
                    "load_burst": {
                        "duration_seconds": 12,
                        "concurrency": 4,
                        "pause_seconds": 0.5,
                    },
                },
            }

        if failure_type == "backend_error_burst":
            response = await self.http.post("http://payshield-backend:3001/debug/error-burst", json={"durationMs": 30000})
            asyncio.create_task(self._drive_backend_load(duration_seconds=8, concurrency=3, pause_seconds=0.4))
            return {"failure_type": failure_type, "status": "triggered", "details": response.json()}

        if failure_type == "redis_disconnect":
            await self.http.post("http://payshield-backend:3001/debug/cache-fallback", json={"durationMs": 25000})
            container = self.docker.containers.get("redis")
            container.pause()
            asyncio.create_task(self._unpause_later(container, 20))
            return {"failure_type": failure_type, "status": "triggered", "details": {"paused_seconds": 20, "cache_mode": "memory_fallback"}}

        if failure_type == "blockchain_hang":
            container = self.docker.containers.get("payshield-blockchain")
            container.pause()
            asyncio.create_task(self._unpause_later(container, 20))
            return {"failure_type": failure_type, "status": "triggered", "details": {"paused_seconds": 20}}

        if failure_type == "frontend_crash":
            container = self.docker.containers.get("payshield-frontend")
            container.stop(timeout=2)
            asyncio.create_task(self._start_later("payshield-frontend", 15))
            return {"failure_type": failure_type, "status": "triggered", "details": {"restart_after_seconds": 15}}

        if failure_type == "simulator_stop":
            container = self.docker.containers.get("payshield-simulator")
            container.stop(timeout=2)
            asyncio.create_task(self._start_later("payshield-simulator", 15))
            return {"failure_type": failure_type, "status": "triggered", "details": {"restart_after_seconds": 15}}

        if failure_type == "cascade_failure":
            first = await self.inject("ml_engine_latency")
            asyncio.create_task(self._inject_backend_burst_later(delay_seconds=4))
            return {
                "failure_type": failure_type,
                "status": "triggered",
                "details": {
                    "ml_engine_latency": first,
                    "backend_error_burst": {"status": "scheduled", "delay_seconds": 4},
                },
            }

        return {"failure_type": failure_type, "status": "ignored", "details": {"reason": "unknown failure type"}}

    async def _inject_backend_burst_later(self, delay_seconds: int) -> None:
        await asyncio.sleep(delay_seconds)
        try:
            await self.inject("backend_error_burst")
        except Exception:
            pass

    async def _drive_backend_load(self, duration_seconds: int, concurrency: int, pause_seconds: float) -> None:
        deadline = time.time() + max(1, duration_seconds)
        while time.time() < deadline:
            requests = [
                self.http.post(
                    "http://payshield-backend:3001/api/transactions/submit",
                    json=self._build_demo_transaction(),
                    timeout=8.0,
                )
                for _ in range(max(1, concurrency))
            ]
            await asyncio.gather(*requests, return_exceptions=True)
            await asyncio.sleep(max(0.1, pause_seconds))

    def _build_demo_transaction(self) -> Dict[str, object]:
        unique_id = uuid4().hex[:8]
        return {
            "txId": f"OBS-{unique_id}",
            "amount": 68999,
            "currency": "INR",
            "merchant": "Observability Demo Vendor",
            "merchantName": "Observability Demo Vendor",
            "country": "IN",
            "paymentMethod": "UPI",
            "memo": "Observability demo traffic for ML latency validation",
            "deviceId": f"obs-device-{unique_id}",
            "userId": "observability-demo",
            "userEmail": "demo@payshield.ai",
            "behavioralData": {
                "typingCadenceDeviation": 0.31,
                "touchPressure": 0.64,
                "copyPasteRatio": 0.03,
            },
            "simulatedFraud": False,
        }

    async def _unpause_later(self, container, seconds: int) -> None:
        await asyncio.sleep(seconds)
        try:
            container.unpause()
        except Exception:
            pass

    async def _start_later(self, container_name: str, seconds: int) -> None:
        await asyncio.sleep(seconds)
        try:
            container = self.docker.containers.get(container_name)
            container.start()
        except Exception:
            pass
