import asyncio
import logging
import socket
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Awaitable, Callable, List
from uuid import uuid4

import docker
import httpx

from blockchain_logger import BlockchainLogger


LOGGER = logging.getLogger("observability-brain.remediation")


@dataclass
class RemediationRecord:
    remediation_id: str
    timestamp: str
    root_cause_result: object
    actions_taken: List[str]
    recovery_time_ms: int
    success: bool
    blockchain_tx_hash: str | None = None

    def to_dict(self) -> dict:
        payload = asdict(self)
        payload["root_cause_result"] = self.root_cause_result.to_dict()
        return payload


class RemediationEngine:
    def __init__(
        self,
        blockchain_logger: BlockchainLogger | None = None,
        step_callback: Callable[[dict], Awaitable[None]] | None = None,
    ) -> None:
        self.client = docker.from_env()
        self.blockchain_logger = blockchain_logger or BlockchainLogger()
        self.http = httpx.AsyncClient(timeout=5.0)
        self.history: List[RemediationRecord] = []
        self.step_callback = step_callback

    async def _emit_step(self, root_cause_result, step: str, detail: str, state: str = "in_progress", extra: dict | None = None) -> None:
        if not self.step_callback:
            return
        payload = {
            "type": "REMEDIATION_STEP",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "service": root_cause_result.root_cause_service,
            "failureType": root_cause_result.failure_type,
            "step": step,
            "state": state,
            "detail": detail,
        }
        if extra:
            payload.update(extra)
        await self.step_callback(payload)

    async def _restart_container(self, container_name: str) -> None:
        container = self.client.containers.get(container_name)
        container.restart(timeout=5)

    async def _exec_in_container(self, container_name: str, command: List[str], workdir: str | None = None) -> bool:
        container = self.client.containers.get(container_name)
        result = container.exec_run(command, workdir=workdir)
        exit_code = result.exit_code if hasattr(result, "exit_code") else result[0]
        if exit_code != 0:
            output = result.output.decode("utf-8", errors="ignore") if hasattr(result, "output") else str(result[1])
            LOGGER.warning(
                "container_exec_failed",
                extra={"container": container_name, "command": " ".join(command), "exit_code": exit_code, "output": output[-4000:]},
            )
            return False
        return True

    async def _poll_http(self, url: str, max_seconds: int = 10) -> bool:
        deadline = time.time() + max_seconds
        while time.time() < deadline:
            try:
                response = await self.http.get(url)
                if response.status_code == 200:
                    return True
            except Exception:
                pass
            await asyncio.sleep(1)
        return False

    async def _poll_port(self, host: str, port: int, max_seconds: int = 10) -> bool:
        deadline = time.time() + max_seconds
        while time.time() < deadline:
            try:
                with socket.create_connection((host, port), timeout=2):
                    return True
            except OSError:
                await asyncio.sleep(1)
        return False

    async def _container_running(self, container_name: str, max_seconds: int = 10) -> bool:
        deadline = time.time() + max_seconds
        while time.time() < deadline:
            try:
                container = self.client.containers.get(container_name)
                container.reload()
                if container.status == "running":
                    return True
            except Exception:
                pass
            await asyncio.sleep(1)
        return False

    async def _count_transactions(self) -> int:
        try:
            response = await self.http.get("http://payshield-backend:3001/api/transactions/history", params={"limit": 100})
            return len(response.json().get("items", []))
        except Exception:
            return 0

    async def remediate(self, root_cause_result) -> RemediationRecord:
        started_at = time.time()
        actions_taken: List[str] = []
        success = False
        blockchain_tx_hash = None
        transactions_before = await self._count_transactions()

        try:
            await self._emit_step(
                root_cause_result,
                "remediation_started",
                f"Starting remediation for {root_cause_result.root_cause_service}.",
            )
            if root_cause_result.root_cause_service == "payshield-ml-engine" or root_cause_result.failure_type == "CASCADE_FAILURE":
                await self._emit_step(
                    root_cause_result,
                    "fallback_enabling",
                    "Switching backend to fallback scoring so transactions keep flowing during ML recovery.",
                )
                await self.http.post("http://payshield-backend:3001/api/fallback/enable", json={"reason": root_cause_result.failure_type})
                actions_taken.append("fallback_activated")
                await self._emit_step(
                    root_cause_result,
                    "fallback_activated",
                    "Fallback mode is active. The backend is serving synthetic risk scores while the ML engine recovers.",
                    state="completed",
                )
                await asyncio.sleep(2)
                await self._emit_step(
                    root_cause_result,
                    "container_restart_started",
                    "Restarting the payshield-ml-engine container through the Docker API.",
                )
                await self._restart_container("payshield-ml-engine")
                actions_taken.append("container_restarted")
                await self._emit_step(
                    root_cause_result,
                    "container_restart_completed",
                    "ML engine container restart issued successfully.",
                    state="completed",
                )
                await self._emit_step(
                    root_cause_result,
                    "healthcheck_wait",
                    "Polling the ML engine /health endpoint until the service becomes healthy again.",
                )
                healthy = await self._poll_http("http://payshield-ml-engine:8000/health", max_seconds=10)
                if healthy:
                    await self._emit_step(
                        root_cause_result,
                        "healthcheck_passed",
                        "ML engine is healthy again. Restoring full ensemble scoring mode.",
                        state="completed",
                    )
                    await self.http.post("http://payshield-backend:3001/api/fallback/disable")
                    actions_taken.append("fallback_disabled")
                    await self._emit_step(
                        root_cause_result,
                        "fallback_disabled",
                        "Fallback mode has been disabled and full ensemble scoring is restored.",
                        state="completed",
                    )
                else:
                    await self._emit_step(
                        root_cause_result,
                        "healthcheck_failed",
                        "ML engine did not become healthy before the remediation timeout.",
                        state="failed",
                    )
                success = healthy

            elif root_cause_result.root_cause_service == "payshield-blockchain":
                await self._emit_step(
                    root_cause_result,
                    "container_restart_started",
                    "Restarting the blockchain node container.",
                )
                await self._restart_container("payshield-blockchain")
                actions_taken.append("container_restarted")
                await self._emit_step(
                    root_cause_result,
                    "container_restart_completed",
                    "Blockchain node restart issued successfully.",
                    state="completed",
                )
                rpc_ready = await self._poll_port("payshield-blockchain", 8545, max_seconds=10)
                if rpc_ready:
                    await self._emit_step(
                        root_cause_result,
                        "contracts_redeploy_started",
                        "Blockchain RPC is back. Redeploying the observability contract.",
                    )
                    redeployed = await self._exec_in_container(
                        "payshield-blockchain",
                        ["npx", "hardhat", "run", "scripts/deploy_observability.js", "--network", "localhost"],
                        workdir="/app",
                    )
                    if redeployed:
                        actions_taken.append("contracts_redeployed")
                        await self._emit_step(
                            root_cause_result,
                            "contracts_redeployed",
                            "Observability contract redeployed successfully.",
                            state="completed",
                        )
                success = rpc_ready

            elif root_cause_result.root_cause_service == "payshield-backend":
                await self._emit_step(
                    root_cause_result,
                    "container_restart_started",
                    "Restarting the backend API container.",
                )
                await self._restart_container("payshield-backend")
                actions_taken.append("container_restarted")
                success = await self._poll_http("http://payshield-backend:3001/health", max_seconds=10)
                await self._emit_step(
                    root_cause_result,
                    "backend_health_status",
                    "Backend health endpoint recovered." if success else "Backend did not recover before timeout.",
                    state="completed" if success else "failed",
                )

            elif root_cause_result.root_cause_service == "redis":
                await self._emit_step(
                    root_cause_result,
                    "memory_cache_fallback_active",
                    "Switching to in-memory cache fallback while Redis is restarted.",
                    state="completed",
                )
                actions_taken.append("memory_cache_fallback_active")
                await self._restart_container("redis")
                actions_taken.append("redis_restarted")
                success = await self._poll_port("redis", 6379, max_seconds=10)
                if success:
                    actions_taken.append("redis_recovered")
                await self._emit_step(
                    root_cause_result,
                    "redis_health_status",
                    "Redis is responding again." if success else "Redis did not recover before timeout.",
                    state="completed" if success else "failed",
                )

            elif root_cause_result.root_cause_service == "payshield-frontend":
                await self._emit_step(
                    root_cause_result,
                    "container_restart_started",
                    "Restarting the frontend container.",
                )
                await self._restart_container("payshield-frontend")
                actions_taken.append("container_restarted")
                success = await self._poll_http("http://payshield-frontend:5173", max_seconds=10)
                await self._emit_step(
                    root_cause_result,
                    "frontend_health_status",
                    "Frontend is serving traffic again." if success else "Frontend did not recover before timeout.",
                    state="completed" if success else "failed",
                )

            elif root_cause_result.root_cause_service == "payshield-simulator":
                await self._emit_step(
                    root_cause_result,
                    "container_restart_started",
                    "Restarting the simulator so real transaction load resumes.",
                )
                await self._restart_container("payshield-simulator")
                actions_taken.append("container_restarted")
                success = await self._container_running("payshield-simulator", max_seconds=10)
                await self._emit_step(
                    root_cause_result,
                    "simulator_health_status",
                    "Simulator is running again." if success else "Simulator did not recover before timeout.",
                    state="completed" if success else "failed",
                )

            else:
                actions_taken.append("suppressed_no_supported_remediation")
                await self._emit_step(
                    root_cause_result,
                    "remediation_unsupported",
                    "No supported automated remediation exists for this root cause.",
                    state="failed",
                )
                success = False
        except Exception as exc:
            LOGGER.error("remediation_failed", extra={"error": str(exc), "service": root_cause_result.root_cause_service})
            await self._emit_step(
                root_cause_result,
                "remediation_exception",
                f"Remediation failed with exception: {exc}",
                state="failed",
            )
            success = False

        recovery_time_ms = int((time.time() - started_at) * 1000)
        transactions_after = await self._count_transactions()
        record = RemediationRecord(
            remediation_id=str(uuid4()),
            timestamp=datetime.now(timezone.utc).isoformat(),
            root_cause_result=root_cause_result,
            actions_taken=actions_taken + [f"transactions_during_outage_count={max(0, transactions_after - transactions_before)}"],
            recovery_time_ms=recovery_time_ms,
            success=success,
        )

        try:
            blockchain_tx_hash = await self.blockchain_logger.log_remediation(record)
            record.blockchain_tx_hash = blockchain_tx_hash
        except Exception as exc:
            LOGGER.warning("remediation_blockchain_log_failed", extra={"error": str(exc)})

        try:
            await self.http.post(
                "http://payshield-backend:3001/api/system/remediation-mark",
                json={"timestamp": record.timestamp},
            )
        except Exception:
            pass

        self.history.insert(0, record)
        self.history = self.history[:250]
        await self._emit_step(
            root_cause_result,
            "remediation_finished",
            "Remediation completed successfully." if success else "Remediation completed, but service recovery was not confirmed.",
            state="completed" if success else "failed",
            extra={"recoveryTimeMs": recovery_time_ms},
        )
        return record
