from collections import defaultdict
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from math import isfinite
from typing import Dict, List, Optional
from uuid import uuid4


@dataclass
class RootCauseResult:
    anomaly_id: str
    timestamp: str
    root_cause_service: str
    failure_type: str
    confidence: float
    signal_consensus: int = 0
    composite_scores: Dict[str, float] = field(default_factory=dict)
    ensemble_breakdown: Dict[str, Dict[str, float]] = field(default_factory=dict)
    adaptive_weights: Dict[str, Dict[str, float]] = field(default_factory=dict)
    metric_evidence: Dict[str, float] = field(default_factory=dict)
    log_evidence: List[dict] = field(default_factory=list)
    trace_evidence: List[dict] = field(default_factory=list)
    business_impact: str = ""
    shap_top_features: List[dict] = field(default_factory=list)
    supporting_services: List[str] = field(default_factory=list)
    recommended_action: str = ""
    explainability_summary: str = ""
    operator_summary: str = ""
    remediation_rationale: str = ""
    stabilization_steps: List[str] = field(default_factory=list)
    evidence_channels: List[str] = field(default_factory=list)
    cause_chain: List[str] = field(default_factory=list)
    suppression_reason: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


class RootCauseEngine:
    service_names = [
        "payshield-frontend",
        "payshield-backend",
        "payshield-ml-engine",
        "payshield-blockchain",
        "payshield-simulator",
        "redis",
    ]

    business_impacts = {
        "payshield-ml-engine": "Fraud detection accuracy degraded. Transactions are being scored by fallback logic only.",
        "payshield-blockchain": "Audit trail integrity at risk. Decisions are not being logged immutably.",
        "payshield-backend": "Transaction ingestion disrupted. Payment submissions may be failing.",
        "payshield-frontend": "Operator visibility lost. Dashboard feed offline.",
        "payshield-simulator": "Load generation stopped. No new transactions are entering the pipeline.",
        "redis": "Cache resilience degraded. Backend is serving from memory fallback instead of Redis.",
    }

    recommended_actions = {
        "payshield-ml-engine": "Enable fallback scoring, restart the ML engine, verify health, then restore ensemble mode.",
        "payshield-blockchain": "Restart blockchain node, verify RPC, and redeploy observability contracts.",
        "payshield-backend": "Restart backend and verify transaction health endpoint.",
        "payshield-frontend": "Restart frontend container and verify operator dashboard access.",
        "payshield-simulator": "Restart load generator container to restore live traffic.",
        "redis": "Restart Redis and keep backend in memory fallback until Redis is healthy again.",
    }
    dependency_graph = {
        "payshield-frontend": ["payshield-backend"],
        "payshield-simulator": ["payshield-backend"],
        "payshield-backend": ["payshield-ml-engine", "payshield-blockchain", "redis"],
        "payshield-ml-engine": [],
        "payshield-blockchain": [],
        "redis": [],
    }
    hard_failure_types = {"BLOCKCHAIN_HANG", "FRONTEND_OUTAGE", "LOAD_GENERATOR_STOPPED"}

    def _build_explainability_features(
        self,
        metric_signals: Dict[str, float],
        metric_snapshot: Optional[Dict[str, float]],
        composite_scores: Dict[str, float],
    ) -> List[dict]:
        snapshot = metric_snapshot or {}
        candidate_scores = {
            "ml_engine_degradation_probability": metric_signals.get("payshield-ml-engine", 0.0),
            "backend_degradation_probability": metric_signals.get("payshield-backend", 0.0),
            "blockchain_degradation_probability": metric_signals.get("payshield-blockchain", 0.0),
            "frontend_degradation_probability": metric_signals.get("payshield-frontend", 0.0),
            "simulator_degradation_probability": metric_signals.get("payshield-simulator", 0.0),
            "redis_degradation_probability": metric_signals.get("redis", 0.0),
            "ml_engine_latency_p95": min(1.0, float(snapshot.get("ml_engine_latency_p95", 0.0)) / 5.0),
            "backend_error_rate": min(1.0, float(snapshot.get("backend_error_rate", 0.0))),
            "blockchain_write_latency_p95": min(1.0, float(snapshot.get("blockchain_write_latency_p95", 0.0)) / 8.0),
            "runtime_fallback_active": min(1.0, float(snapshot.get("runtime_fallback_active", 0.0))),
            "cache_fallback_active": min(1.0, float(snapshot.get("cache_fallback_active", 0.0))),
            "ml_engine_health_loss": max(0.0, 1.0 - float(snapshot.get("ml_engine_health", 1.0))),
            "backend_health_loss": max(0.0, 1.0 - float(snapshot.get("backend_health", 1.0))),
            "blockchain_rpc_health_loss": max(0.0, 1.0 - float(snapshot.get("blockchain_rpc_health", 1.0))),
            "frontend_health_loss": max(0.0, 1.0 - float(snapshot.get("frontend_health", 1.0))),
            "simulator_stopped": max(0.0, 1.0 - float(snapshot.get("simulator_container_running", 1.0))),
            "redis_health_loss": max(0.0, 1.0 - float(snapshot.get("redis_tcp_health", 1.0))),
        }
        for service_name, score in composite_scores.items():
            candidate_scores[f"composite_{service_name}"] = score
        explainable = []
        for name, score in candidate_scores.items():
            numeric_score = float(score)
            if not isfinite(numeric_score) or numeric_score <= 0:
                continue
            explainable.append({"feature": name, "score": round(min(numeric_score, 1.0), 4)})
        explainable.sort(key=lambda item: item["score"], reverse=True)
        return explainable[:6]

    def _bootstrap_service_scores(self, metric_signals: Dict[str, float]) -> Dict[str, float]:
        service_scores = {service_name: 0.0 for service_name in self.service_names}
        for service_name, probability in metric_signals.items():
            if service_name in service_scores:
                service_scores[service_name] = max(service_scores[service_name], float(probability))
        return service_scores

    def _apply_snapshot_heuristics(self, service_scores: Dict[str, float], snapshot: Optional[Dict[str, float]]) -> List[str]:
        metric_evidence = []
        if not snapshot:
            return metric_evidence

        if snapshot.get("runtime_fallback_active", 0.0) > 0.5:
            service_scores["payshield-ml-engine"] = max(service_scores["payshield-ml-engine"], 0.88)
            metric_evidence.append("runtime_fallback_active")
        if snapshot.get("cache_fallback_active", 0.0) > 0.5 or snapshot.get("redis_tcp_health", 1.0) < 0.5:
            service_scores["redis"] = max(service_scores["redis"], 0.85)
            metric_evidence.append("cache_fallback_active")
        if snapshot.get("frontend_container_running", 1.0) < 0.5 or snapshot.get("frontend_health", 1.0) < 0.5:
            service_scores["payshield-frontend"] = max(service_scores["payshield-frontend"], 0.82)
            metric_evidence.append("frontend_health")
        if snapshot.get("simulator_container_running", 1.0) < 0.5:
            service_scores["payshield-simulator"] = max(service_scores["payshield-simulator"], 0.84)
            metric_evidence.append("simulator_container_running")
        if snapshot.get("blockchain_container_running", 1.0) < 0.5 or snapshot.get("blockchain_rpc_health", 1.0) < 0.5:
            service_scores["payshield-blockchain"] = max(service_scores["payshield-blockchain"], 0.9)
            metric_evidence.append("blockchain_rpc_health")
        if snapshot.get("backend_container_running", 1.0) < 0.5 or snapshot.get("backend_health", 1.0) < 0.5:
            service_scores["payshield-backend"] = max(service_scores["payshield-backend"], 0.9)
            metric_evidence.append("backend_health")
        if snapshot.get("ml_engine_container_running", 1.0) < 0.5 or snapshot.get("ml_engine_health", 1.0) < 0.5:
            service_scores["payshield-ml-engine"] = max(service_scores["payshield-ml-engine"], 0.92)
            metric_evidence.append("ml_engine_health")
        return metric_evidence

    def _upstream_candidates(self, service_name: str) -> List[str]:
        upstream = []
        for candidate, downstream in self.dependency_graph.items():
            if service_name in downstream:
                upstream.append(candidate)
        return upstream

    def _topology_adjustment(self, service_name: str, base_scores: Dict[str, float]) -> float:
        upstream_scores = [base_scores.get(upstream_service, 0.0) for upstream_service in self._upstream_candidates(service_name)]
        downstream_scores = [base_scores.get(downstream_service, 0.0) for downstream_service in self.dependency_graph.get(service_name, [])]
        upstream_bonus = min(0.12, max(upstream_scores, default=0.0) * 0.12)
        symptom_penalty = min(0.1, max(downstream_scores, default=0.0) * 0.08) if service_name in {"payshield-frontend", "payshield-backend"} else 0.0
        return upstream_bonus - symptom_penalty

    def _dependency_cascade_adjustment(
        self,
        service_name: str,
        base_scores: Dict[str, float],
        snapshot: Optional[Dict[str, float]],
    ) -> float:
        snapshot = snapshot or {}
        bonus = 0.0

        if service_name == "payshield-ml-engine":
            backend_score = base_scores.get("payshield-backend", 0.0)
            if backend_score > 0.45 and float(snapshot.get("runtime_fallback_active", 0.0)) > 0.5:
                bonus += 0.12
            if float(snapshot.get("ml_engine_latency_p95", 0.0)) > 2.0:
                bonus += 0.08

        if service_name == "redis":
            backend_score = base_scores.get("payshield-backend", 0.0)
            if backend_score > 0.35 and float(snapshot.get("cache_fallback_active", 0.0)) > 0.5:
                bonus += 0.1

        if service_name == "payshield-backend":
            if base_scores.get("payshield-ml-engine", 0.0) > 0.65 and float(snapshot.get("runtime_fallback_active", 0.0)) > 0.5:
                bonus -= 0.14
            if base_scores.get("redis", 0.0) > 0.65 and float(snapshot.get("cache_fallback_active", 0.0)) > 0.5:
                bonus -= 0.1

        if service_name == "payshield-frontend":
            if base_scores.get("payshield-backend", 0.0) > 0.55 and float(snapshot.get("frontend_health", 1.0)) >= 0.5:
                bonus -= 0.12

        return max(-0.2, min(0.2, bonus))

    def _temporal_bonus(self, service_name: str, trace_by_service: Dict[str, List[dict]]) -> float:
        traces = sorted(trace_by_service.get(service_name, []), key=lambda item: item.get("start_time", 0))
        if not traces:
            return 0.0
        earliest = traces[0]
        if earliest.get("error") and float(earliest.get("duration_ms", 0.0)) > 2500:
            return 0.08
        if earliest.get("error"):
            return 0.05
        return 0.02

    def _adaptive_weights(self, metric_probability: float, log_ratio: float, trace_ratio: float) -> Dict[str, float]:
        base_weights = {
            "metric_score": 0.45,
            "log_score": 0.35,
            "trace_score": 0.20,
        }
        signal_strengths = {
            "metric_score": min(1.0, metric_probability / 0.72) if metric_probability > 0 else 0.0,
            "log_score": min(1.0, log_ratio / 0.3) if log_ratio > 0 else 0.0,
            "trace_score": min(1.0, trace_ratio / 0.25) if trace_ratio > 0 else 0.0,
        }
        weighted_total = sum(base_weights[key] * max(signal_strengths[key], 0.2 if signal_strengths[key] > 0 else 0.0) for key in base_weights)
        if weighted_total <= 0:
            return base_weights
        return {
            key: (base_weights[key] * max(signal_strengths[key], 0.2 if signal_strengths[key] > 0 else 0.0)) / weighted_total
            for key in base_weights
        }

    def _signal_consensus(self, metric_probability: float, log_ratio: float, trace_ratio: float) -> int:
        votes = 0
        if metric_probability >= 0.72:
            votes += 1
        if log_ratio >= 0.2:
            votes += 1
        if trace_ratio >= 0.15:
            votes += 1
        return votes

    def _evidence_channels(self, metric_probability: float, log_ratio: float, trace_ratio: float, snapshot: Optional[Dict[str, float]]) -> List[str]:
        channels: List[str] = []
        if metric_probability >= 0.72:
            channels.append("metrics")
        if log_ratio >= 0.2:
            channels.append("logs")
        if trace_ratio >= 0.15:
            channels.append("traces")
        if snapshot and float(snapshot.get("runtime_fallback_active", 0.0)) > 0.5:
            channels.append("runtime-state")
        return channels

    def _stabilization_steps(self, root_cause_service: str) -> List[str]:
        mapping = {
            "payshield-ml-engine": [
                "Switch backend to fallback scoring",
                "Restart the ML engine container",
                "Wait for /health recovery",
                "Restore full ensemble scoring",
            ],
            "payshield-blockchain": [
                "Restart blockchain node",
                "Verify RPC responsiveness",
                "Redeploy observability contract",
            ],
            "payshield-backend": [
                "Restart backend API",
                "Verify transaction ingestion health",
                "Resume normal routing",
            ],
            "redis": [
                "Keep memory fallback active",
                "Restart Redis",
                "Return cache reads to Redis after health recovers",
            ],
        }
        return mapping.get(root_cause_service, ["Continue monitoring and verify service recovery"])

    def _cause_chain(self, root_cause_service: str, snapshot: Optional[Dict[str, float]], composite_scores: Dict[str, float]) -> List[str]:
        snapshot = snapshot or {}
        if root_cause_service == "payshield-ml-engine" and (
            float(snapshot.get("runtime_fallback_active", 0.0)) > 0.5 or composite_scores.get("payshield-backend", 0.0) > 0.35
        ):
            return ["ML engine degraded", "Backend switched to fallback scoring", "Transaction scoring stayed available"]
        if root_cause_service == "redis" and (
            float(snapshot.get("cache_fallback_active", 0.0)) > 0.5 or composite_scores.get("payshield-backend", 0.0) > 0.35
        ):
            return ["Redis degraded", "Backend switched to memory cache fallback", "API stayed available"]
        if root_cause_service == "payshield-blockchain":
            return ["Blockchain RPC degraded", "Audit logging was interrupted", "Observability evidence trail required recovery"]
        if root_cause_service == "payshield-backend":
            return ["Backend API degraded", "Transaction ingestion failed", "Client requests were impacted"]
        return [f"{root_cause_service} degraded", "Observability brain attributed the dominant upstream fault"]

    def _explainability_summary(
        self,
        root_cause_service: str,
        confidence: float,
        channels: List[str],
        shap_top_features: List[dict],
        snapshot: Optional[Dict[str, float]],
    ) -> str:
        if root_cause_service == "unknown":
            return "Signals were present, but the ensemble did not reach the remediation threshold with enough confidence."
        snapshot = snapshot or {}
        strongest_features = ", ".join(item["feature"] for item in shap_top_features[:3]) or "composite anomaly score"
        channel_text = ", ".join(channels) if channels else "telemetry heuristics"
        if root_cause_service == "payshield-ml-engine":
            latency_value = round(float(snapshot.get("ml_engine_latency_p95", 0.0)), 2)
            return (
                f"Metrics identify the ML engine as the dominant upstream fault with {round(confidence * 100)}% confidence. "
                f"The strongest evidence is elevated ML latency (p95 {latency_value}s) plus runtime fallback activation. "
                f"Key explainability features: {strongest_features}. Evidence channels used: {channel_text}."
            )
        return (
            f"The ensemble attributes the incident to {root_cause_service} with {round(confidence * 100)}% confidence. "
            f"Key explainability features: {strongest_features}. Evidence channels used: {channel_text}."
        )

    def _remediation_rationale(self, root_cause_service: str, failure_type: str) -> str:
        if root_cause_service == "payshield-ml-engine":
            return "Fallback is activated first so transaction scoring remains available while the ML container is restarted and health-checked."
        if root_cause_service == "payshield-blockchain":
            return "The blockchain node is restarted and contract deployment is re-run because audit integrity depends on RPC and contract availability."
        if root_cause_service == "redis":
            return "Redis is restarted while the backend stays on memory fallback to avoid interrupting transaction processing."
        if root_cause_service == "payshield-backend":
            return "The backend is restarted directly because ingestion is the failing control point for the payment workflow."
        return f"Automated remediation is selected for {failure_type} based on service ownership and runtime dependency impact."

    def _operator_summary(
        self,
        root_cause_service: str,
        failure_type: str,
        confidence: float,
        channels: List[str],
        snapshot: Optional[Dict[str, float]],
    ) -> str:
        if root_cause_service == "unknown":
            return "Signals are present, but the observability brain is still below the confidence threshold for autonomous remediation."
        channel_text = ", ".join(channels) if channels else "telemetry heuristics"
        snapshot = snapshot or {}
        if root_cause_service == "payshield-ml-engine":
            latency = round(float(snapshot.get("ml_engine_latency_p95", 0.0)), 2)
            return f"Root cause is ML engine degradation with {round(confidence * 100)}% confidence. Metrics and runtime-state show elevated ML latency ({latency}s p95) and fallback activation."
        return f"Root cause is {root_cause_service} with {round(confidence * 100)}% confidence, based on {channel_text}."

    def correlate(
        self,
        metric_signals: Dict[str, float],
        log_signals: List[dict],
        trace_signals: List[dict],
        metric_snapshot: Optional[Dict[str, float]] = None,
    ) -> RootCauseResult:
        now = datetime.now(timezone.utc).isoformat()
        service_scores = self._bootstrap_service_scores(metric_signals)
        log_by_service: Dict[str, List[dict]] = defaultdict(list)
        trace_by_service: Dict[str, List[dict]] = defaultdict(list)
        metric_evidence_keys = self._apply_snapshot_heuristics(service_scores, metric_snapshot)

        for item in log_signals:
            if not item.get("is_anomalous"):
                continue
            service = item.get("service", "unknown")
            log_by_service[service].append(item)

        for item in trace_signals:
            service = item.get("service", "unknown")
            trace_by_service[service].append(item)

        total_logs = max(1, len([item for item in log_signals if item.get("is_anomalous")]))
        total_traces = max(1, len(trace_signals))
        composite_scores: Dict[str, float] = {}
        ensemble_breakdown: Dict[str, Dict[str, float]] = {}
        adaptive_weights: Dict[str, Dict[str, float]] = {}
        signal_consensus: Dict[str, int] = {}

        for service_name in self.service_names:
            metric_probability = float(service_scores.get(service_name, 0.0))
            anomalous_logs = log_by_service.get(service_name, [])
            error_traces = [
                trace_item
                for trace_item in trace_by_service.get(service_name, [])
                if trace_item.get("error") or float(trace_item.get("duration_ms", 0.0)) > 2000
            ]
            log_ratio = sum(item.get("anomaly_probability", 0.0) for item in anomalous_logs) / total_logs
            trace_ratio = sum(float(trace_item.get("severity", 0.0)) for trace_item in error_traces) / total_traces
            topology_score = self._topology_adjustment(service_name, service_scores)
            dependency_cascade_score = self._dependency_cascade_adjustment(service_name, service_scores, metric_snapshot)
            temporal_bonus = self._temporal_bonus(service_name, trace_by_service)
            normalized_weights = self._adaptive_weights(metric_probability, log_ratio, trace_ratio)
            adaptive_weights[service_name] = {name: round(value, 4) for name, value in normalized_weights.items()}
            signal_consensus[service_name] = self._signal_consensus(metric_probability, log_ratio, trace_ratio)
            consensus_bonus = 0.05 if signal_consensus[service_name] >= 2 else 0.0
            composite = (
                normalized_weights["metric_score"] * metric_probability +
                normalized_weights["log_score"] * log_ratio +
                normalized_weights["trace_score"] * trace_ratio
            )
            composite_scores[service_name] = max(0.0, min(0.99, composite + topology_score + dependency_cascade_score + temporal_bonus + consensus_bonus))
            ensemble_breakdown[service_name] = {
                "metric_score": round(metric_probability, 4),
                "log_score": round(log_ratio, 4),
                "trace_score": round(trace_ratio, 4),
                "topology_score": round(topology_score, 4),
                "dependency_cascade_score": round(dependency_cascade_score, 4),
                "temporal_bonus": round(temporal_bonus, 4),
                "consensus_bonus": round(consensus_bonus, 4),
            }

        root_cause_service = max(composite_scores, key=composite_scores.get) if composite_scores else "unknown"
        confidence = min(0.99, composite_scores.get(root_cause_service, 0.0))
        failure_type = "DEGRADATION"
        snapshot = metric_snapshot or {}
        blockchain_hard_down = snapshot.get("blockchain_container_running", 1.0) < 0.5 or snapshot.get("blockchain_rpc_health", 1.0) < 0.5
        frontend_hard_down = snapshot.get("frontend_container_running", 1.0) < 0.5 or snapshot.get("frontend_health", 1.0) < 0.5
        simulator_hard_down = snapshot.get("simulator_container_running", 1.0) < 0.5
        redis_hard_down = snapshot.get("redis_container_running", 1.0) < 0.5 or snapshot.get("redis_tcp_health", 1.0) < 0.5

        backend_logs = " ".join(item.get("text", item.get("message", "")) for item in log_by_service.get("payshield-backend", []))
        ml_logs = " ".join(item.get("text", item.get("message", "")) for item in log_by_service.get("payshield-ml-engine", []))
        if (
            composite_scores.get("payshield-ml-engine", 0.0) > 0.7 and
            composite_scores.get("payshield-backend", 0.0) > 0.5 and
            ("timeout" in backend_logs.lower() or "timeout" in ml_logs.lower() or metric_snapshot and metric_snapshot.get("runtime_fallback_active", 0.0) > 0.5)
        ):
            failure_type = "CASCADE_FAILURE"
            confidence = min(0.99, confidence + 0.1)
            root_cause_service = "payshield-ml-engine"
        elif root_cause_service == "payshield-ml-engine":
            failure_type = "ML_ENGINE_DEGRADATION"
        elif root_cause_service == "payshield-blockchain" and blockchain_hard_down:
            failure_type = "BLOCKCHAIN_HANG"
        elif root_cause_service == "payshield-backend":
            failure_type = "BACKEND_ERROR_BURST"
        elif root_cause_service == "payshield-frontend" and frontend_hard_down:
            failure_type = "FRONTEND_OUTAGE"
        elif root_cause_service == "payshield-simulator" and simulator_hard_down:
            failure_type = "LOAD_GENERATOR_STOPPED"
        elif root_cause_service == "redis" and redis_hard_down:
            failure_type = "CACHE_PRESSURE"

        shap_top_features = self._build_explainability_features(metric_signals, metric_snapshot, composite_scores)

        business_impact = self.business_impacts.get(root_cause_service, "Moderate: upstream observability signal requires intervention.")

        if (
            root_cause_service == "payshield-blockchain"
            and composite_scores.get("payshield-ml-engine", 0.0) > 0.55
        ):
            business_impact = "Critical: both fraud detection and audit logging compromised simultaneously."

        recommended_action = self.recommended_actions.get(root_cause_service, "Suppress alert and continue monitoring until confidence improves.")
        evidence_channels = self._evidence_channels(
            service_scores.get(root_cause_service, 0.0),
            sum(item.get("anomaly_probability", 0.0) for item in log_by_service.get(root_cause_service, [])) / total_logs if root_cause_service != "unknown" else 0.0,
            sum(float(trace_item.get("severity", 0.0)) for trace_item in trace_by_service.get(root_cause_service, [])) / total_traces if root_cause_service != "unknown" else 0.0,
            metric_snapshot,
        )

        if root_cause_service == "payshield-blockchain" and not blockchain_hard_down and signal_consensus.get(root_cause_service, 0) < 2:
            confidence = min(confidence, 0.64)
        if root_cause_service == "payshield-frontend" and not frontend_hard_down and signal_consensus.get(root_cause_service, 0) < 2:
            confidence = min(confidence, 0.64)
        if root_cause_service == "payshield-simulator" and not simulator_hard_down and signal_consensus.get(root_cause_service, 0) < 2:
            confidence = min(confidence, 0.64)
        if root_cause_service == "redis" and not redis_hard_down and signal_consensus.get(root_cause_service, 0) < 2:
            confidence = min(confidence, 0.64)

        suppression_reason = ""
        if confidence <= 0.65:
            root_cause_service = "unknown"
            recommended_action = "Suppress alert and continue monitoring until confidence improves."
            failure_type = "SUPPRESSED"
            suppression_reason = "Composite confidence below 0.65 threshold."

        explainability_summary = self._explainability_summary(
            root_cause_service,
            confidence,
            evidence_channels,
            shap_top_features,
            metric_snapshot,
        )
        operator_summary = self._operator_summary(
            root_cause_service,
            failure_type,
            confidence,
            evidence_channels,
            metric_snapshot,
        )
        remediation_rationale = self._remediation_rationale(root_cause_service, failure_type)
        stabilization_steps = self._stabilization_steps(root_cause_service)
        cause_chain = self._cause_chain(root_cause_service, metric_snapshot, composite_scores)

        return RootCauseResult(
            anomaly_id=str(uuid4()),
            timestamp=now,
            root_cause_service=root_cause_service,
            failure_type=failure_type,
            confidence=round(confidence, 4),
            signal_consensus=signal_consensus.get(root_cause_service, 0),
            composite_scores={service_name: round(score, 4) for service_name, score in composite_scores.items()},
            ensemble_breakdown=ensemble_breakdown,
            adaptive_weights=adaptive_weights,
            metric_evidence={
                **{key: float(value) for key, value in metric_signals.items()},
                **{key: float(metric_snapshot[key]) for key in metric_evidence_keys if metric_snapshot and key in metric_snapshot},
                **{f"composite_{service_name}": float(score) for service_name, score in composite_scores.items()},
            },
            log_evidence=log_by_service.get(root_cause_service, [])[:3],
            trace_evidence=trace_by_service.get(root_cause_service, [])[:5],
            business_impact=business_impact,
            shap_top_features=shap_top_features,
            supporting_services=[service for service, score in composite_scores.items() if service != root_cause_service and score > 0.2],
            recommended_action=recommended_action,
            explainability_summary=explainability_summary,
            operator_summary=operator_summary,
            remediation_rationale=remediation_rationale,
            stabilization_steps=stabilization_steps,
            evidence_channels=evidence_channels,
            cause_chain=cause_chain,
            suppression_reason=suppression_reason,
        )
