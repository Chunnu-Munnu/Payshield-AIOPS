# FILE: velocity_tracker.py
# ROLE: Track short-term transaction velocity and rolling throughput metrics
# INSPIRED BY: Card network risk velocity counters
# PERFORMANCE TARGET: Constant-time updates
from __future__ import annotations

from collections import deque
from time import time


class VelocityTracker:
    def __init__(self) -> None:
        self.events = deque(maxlen=10_000)

    def mark(self) -> None:
        self.events.append(time())

    def rate_per_second(self, window_seconds: int = 5) -> float:
        cutoff = time() - window_seconds
        return len([ts for ts in self.events if ts >= cutoff]) / max(window_seconds, 1)
