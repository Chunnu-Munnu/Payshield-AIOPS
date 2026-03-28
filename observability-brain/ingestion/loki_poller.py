import asyncio
import json
import time
from collections import deque
from threading import Lock
from typing import Deque, Dict, List

import httpx


LOKI_URL = "http://loki:3100"


class LokiPoller:
    def __init__(self, base_url: str = LOKI_URL) -> None:
        self.base_url = base_url.rstrip("/")
        self.buffer: Deque[Dict[str, str]] = deque(maxlen=5000)
        self.lock = Lock()
        self.client = httpx.AsyncClient(timeout=5.0)
        self.seen = set()

    @staticmethod
    def _extract_level(message: str) -> str:
        lowered = message.lower()
        for level in ["critical", "error", "warn", "info", "debug"]:
            if level in lowered:
                return "warning" if level == "warn" else level
        return "info"

    @staticmethod
    def _extract_service(stream_labels: Dict[str, str], message_obj: Dict[str, str], raw_line: str) -> str:
        return (
            message_obj.get("service")
            or stream_labels.get("service_name")
            or stream_labels.get("container_name")
            or ("payshield-ml-engine" if "ml-engine" in raw_line else "payshield-backend")
        )

    async def poll_once(self) -> List[Dict[str, str]]:
        end_ns = int(time.time() * 1_000_000_000)
        start_ns = end_ns - 15_000_000_000
        response = await self.client.get(
            f"{self.base_url}/loki/api/v1/query_range",
            params={
                "query": '{job="docker"}',
                "start": start_ns,
                "end": end_ns,
                "limit": 50,
                "direction": "backward",
            },
        )
        response.raise_for_status()
        payload = response.json()
        parsed_logs = []
        for stream in payload.get("data", {}).get("result", []):
            stream_labels = stream.get("stream", {})
            for timestamp_ns, raw_line in stream.get("values", []):
                try:
                    message_obj = json.loads(raw_line)
                except json.JSONDecodeError:
                    message_obj = {}
                log_entry = {
                    "timestamp": message_obj.get("timestamp") or str(timestamp_ns),
                    "level": message_obj.get("level") or self._extract_level(raw_line),
                    "service": self._extract_service(stream_labels, message_obj, raw_line),
                    "traceId": message_obj.get("traceId"),
                    "message": message_obj.get("message") or raw_line,
                }
                dedupe_key = f"{log_entry['timestamp']}|{log_entry['service']}|{log_entry['message']}"
                if dedupe_key in self.seen:
                    continue
                self.seen.add(dedupe_key)
                parsed_logs.append(log_entry)

        with self.lock:
            self.buffer.extend(parsed_logs)
        return parsed_logs

    async def run_forever(self) -> None:
        while True:
            try:
                await self.poll_once()
            finally:
                await asyncio.sleep(2)

    def get_buffer(self) -> Deque[Dict[str, str]]:
        with self.lock:
            return deque(self.buffer, maxlen=5000)
