import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import * as d3 from "d3";

import {
  fetchSystemStatus,
  fetchObservabilityAnomalies,
  fetchObservabilityMetrics,
  fetchRemediationHistory,
  fetchRootCauseLatest,
  injectObservabilityFailure,
} from "../services/api";

const brainWsUrl = import.meta.env.VITE_OBSERVABILITY_WS_URL || "ws://localhost:9000/ws/live-feed";
const serviceList = [
  "payshield-frontend",
  "payshield-backend",
  "payshield-ml-engine",
  "payshield-blockchain",
  "payshield-simulator",
  "redis",
];
const failureTypes = ["ml_engine_latency", "ml_engine_oom", "cascade_failure"];

function humanize(value = "") {
  return String(value || "")
    .replace(/^payshield-/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\bml\b/gi, "ML")
    .replace(/\brca\b/gi, "RCA")
    .replace(/\bapi\b/gi, "API")
    .replace(/\bws\b/gi, "WS")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

const palette = {
  ink: "#f8fafc",
  text: "#dbe7f5",
  muted: "#7c8aa5",
  faint: "#51607a",
  border: "rgba(255,255,255,0.07)",
  borderStrong: "rgba(255,255,255,0.13)",
  panel: "linear-gradient(180deg, rgba(13,17,23,0.98), rgba(10,15,26,0.98))",
  surface: "rgba(255,255,255,0.035)",
  blue: "#38bdf8",
  blueSoft: "rgba(56,189,248,0.1)",
  green: "#22c55e",
  greenSoft: "rgba(34,197,94,0.1)",
  red: "#ef4444",
  redSoft: "rgba(239,68,68,0.1)",
  amber: "#f59e0b",
  amberSoft: "rgba(245,158,11,0.1)",
};

const panelStyle = {
  borderRadius: 22,
  border: `1px solid ${palette.border}`,
  background: palette.panel,
  boxShadow: "0 18px 40px rgba(0,0,0,0.24)",
};

function scoreColor(score) {
  if (score > 0.65) return palette.red;
  if (score >= 0.4) return palette.amber;
  return palette.green;
}

function statusLabel(score) {
  if (score > 0.65) return "critical";
  if (score >= 0.4) return "watch";
  return "stable";
}

function MetricChip({ label, value, accent = palette.blue, accentSoft = palette.blueSoft }) {
  return (
    <div style={{ borderRadius: 18, padding: 16, background: accentSoft, border: `1px solid ${palette.border}` }}>
      <div style={{ color: palette.muted, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800 }}>{label}</div>
      <div style={{ color: accent, fontSize: 18, fontWeight: 900, marginTop: 10, lineHeight: 1.2 }}>{value}</div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <div style={{ color: palette.ink, fontWeight: 900, fontSize: 16, letterSpacing: "0.02em" }}>{children}</div>;
}

function GaugeCard({ service, score }) {
  const bounded = Math.max(0, Math.min(1, score || 0));
  const color = scoreColor(bounded);
  const arc = d3.arc().innerRadius(32).outerRadius(40).startAngle(-Math.PI / 2).endAngle(-Math.PI / 2 + Math.PI * bounded);

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} style={{ ...panelStyle, padding: 16, display: "grid", gap: 10 }}>
      <div style={{ color: palette.muted, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800 }}>{humanize(service)}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <svg width="110" height="68" viewBox="0 0 120 70">
          <g transform="translate(60,60)">
            <path d={d3.arc().innerRadius(32).outerRadius(40).startAngle(-Math.PI / 2).endAngle(Math.PI / 2)()} fill="rgba(255,255,255,0.08)" />
            <path d={arc()} fill={color} />
          </g>
        </svg>
        <div style={{ textAlign: "right" }}>
          <div style={{ color, fontSize: 22, fontWeight: 800 }}>{Math.round(bounded * 100)}%</div>
          <div style={{ color: palette.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>{statusLabel(bounded)}</div>
        </div>
      </div>
    </motion.div>
  );
}

export default function ObservabilityDashboard() {
  const [anomalies, setAnomalies] = useState([]);
  const [latestRootCause, setLatestRootCause] = useState(null);
  const [remediations, setRemediations] = useState([]);
  const [lastCycleDurationMs, setLastCycleDurationMs] = useState(0);
  const [injecting, setInjecting] = useState(null);
  const [injectionStatus, setInjectionStatus] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [remediationSteps, setRemediationSteps] = useState([]);

  const displayedRootCause = useMemo(() => {
    if (latestRootCause?.root_cause_service && latestRootCause.root_cause_service !== "unknown") {
      return latestRootCause;
    }
    const anomalyRoot = anomalies[0]?.rootCause || anomalies[0];
    return anomalyRoot?.root_cause_service ? anomalyRoot : latestRootCause;
  }, [anomalies, latestRootCause]);

  const handleInject = useCallback(async (failureType) => {
    setInjecting(failureType);
    setRemediationSteps([]);
    setAnomalies([]);
    setLatestRootCause(null);
    setInjectionStatus({ type: "info", message: `Scheduling ${failureType} for the next RCA cycle...` });
    try {
      const response = await injectObservabilityFailure(failureType);
      setInjectionStatus({ type: "success", message: `${response.failure_type} scheduled. Waiting for telemetry confirmation.` });
      setTimeout(async () => {
        try {
          const [anomalyRes, rootRes, remediationRes] = await Promise.all([
            fetchObservabilityAnomalies(),
            fetchRootCauseLatest(),
            fetchRemediationHistory(),
          ]);
          setAnomalies(anomalyRes || []);
          setLatestRootCause(rootRes || null);
          setRemediations(remediationRes || []);
        } catch (_error) {
        }
      }, 4000);
    } catch (error) {
      setInjectionStatus({
        type: "error",
        message: error?.response?.data?.detail || error?.message || `Failed to schedule ${failureType}.`,
      });
    } finally {
      setInjecting(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let socket;

    const refresh = async () => {
      const [anomalyRes, rootRes, remediationRes, metricsText, systemStatusRes] = await Promise.allSettled([
        fetchObservabilityAnomalies(),
        fetchRootCauseLatest(),
        fetchRemediationHistory(),
        fetchObservabilityMetrics(),
        fetchSystemStatus(),
      ]);

      if (!mounted) return;
      if (anomalyRes.status === "fulfilled") setAnomalies(anomalyRes.value || []);
      if (rootRes.status === "fulfilled") setLatestRootCause(rootRes.value || null);
      if (remediationRes.status === "fulfilled") setRemediations(remediationRes.value || []);
      if (systemStatusRes.status === "fulfilled") setSystemStatus(systemStatusRes.value || null);
      if (metricsText.status === "fulfilled") {
        const match = metricsText.value.match(/last_cycle_duration_ms\s+(\d+(\.\d+)?)/);
        if (match) setLastCycleDurationMs(Number(match[1]));
      }
    };

    refresh();
    const interval = setInterval(refresh, 3000);

    try {
      socket = new WebSocket(brainWsUrl);
      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.type === "DEMO_RESET") {
          setAnomalies([]);
          setLatestRootCause(null);
          setRemediations([]);
          setRemediationSteps([]);
        }
        if (payload.type === "DEMO_INJECTION_STARTED") {
          setInjectionStatus({ type: "info", message: payload.message || `${payload.failureType} scheduled.` });
        }
        if (payload.type === "ANOMALY_DETECTED") {
          setAnomalies((current) => [payload, ...current].slice(0, 20));
          setLatestRootCause(payload.rootCause);
        }
        if (payload.type === "REMEDIATION_STEP") {
          setRemediationSteps((current) => [payload, ...current].slice(0, 20));
        }
        if (payload.type === "REMEDIATION_EXECUTED") {
          setRemediations((current) => [payload.remediation, ...current].slice(0, 50));
        }
      };
    } catch (_error) {
    }

    return () => {
      mounted = false;
      clearInterval(interval);
      socket?.close();
    };
  }, []);

  useEffect(() => {
    const onRunDemo = (event) => {
      handleInject(event.detail?.failureType || "ml_engine_latency");
    };
    window.addEventListener("payshield:run-demo", onRunDemo);
    return () => window.removeEventListener("payshield:run-demo", onRunDemo);
  }, [handleInject]);

  const latestLogs = displayedRootCause?.log_evidence || [];
  const latestTraces = displayedRootCause?.trace_evidence || [];
  const shapFeatures = displayedRootCause?.shap_top_features || [];
  const evidenceChannels = displayedRootCause?.evidence_channels || [];
  const stabilizationSteps = displayedRootCause?.stabilization_steps || [];
  const compositeScores = displayedRootCause?.composite_scores || {};
  const ensembleBreakdown = displayedRootCause?.ensemble_breakdown || {};
  const causeChain = displayedRootCause?.cause_chain || [];
  const metricEvidence = Object.entries(displayedRootCause?.metric_evidence || {})
    .filter(([, value]) => Number.isFinite(Number(value)) && Number(value) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 8);

  const slaColor = lastCycleDurationMs > 14000 ? palette.red : lastCycleDurationMs >= 12000 ? palette.amber : palette.green;
  const fallbackActive = systemStatus?.fraudScoringMode === "fallback" || systemStatus?.fallbackActive;
  const fallbackDurationSeconds = Math.max(0, Math.round((systemStatus?.fallbackDurationMs || 0) / 1000));
  const incidentTimestampMs = displayedRootCause?.timestamp ? Date.parse(displayedRootCause.timestamp) : 0;
  const remediationTimestampMs = systemStatus?.lastRemediationTimestamp ? Date.parse(systemStatus.lastRemediationTimestamp) : 0;
  const incidentRecovered =
    Boolean(displayedRootCause?.root_cause_service) &&
    !fallbackActive &&
    Boolean(systemStatus?.mlEngineHealthy) &&
    Boolean(remediationTimestampMs) &&
    remediationTimestampMs >= incidentTimestampMs;

  const currentStateLabel = incidentRecovered ? "Recovered" : fallbackActive ? "Remediating" : "Monitoring";
  const serviceScores = useMemo(() => {
    const compositeScoreMap = displayedRootCause?.composite_scores || {};
    const next = {
      "payshield-frontend": 0.04,
      "payshield-backend": fallbackActive ? 0.72 : 0.08,
      "payshield-ml-engine": systemStatus?.mlEngineHealthy ? (incidentRecovered ? 0.08 : compositeScoreMap["payshield-ml-engine"] || 0.08) : 0.9,
      "payshield-blockchain": systemStatus?.blockchainHealthy ? 0.04 : 0.9,
      "payshield-simulator": 0.04,
      redis: systemStatus?.cacheMode === "memory_fallback" ? 0.45 : 0.08,
    };

    if (!incidentRecovered && displayedRootCause?.root_cause_service && compositeScoreMap[displayedRootCause.root_cause_service]) {
      next[displayedRootCause.root_cause_service] = compositeScoreMap[displayedRootCause.root_cause_service];
    }

    return next;
  }, [displayedRootCause, fallbackActive, incidentRecovered, systemStatus]);

  const incidentColor = scoreColor(displayedRootCause?.confidence || 0.1);
  const incidentServiceLabel = displayedRootCause?.root_cause_service ? humanize(displayedRootCause.root_cause_service) : "Awaiting anomaly";
  const incidentFailureLabel = displayedRootCause?.failure_type ? humanize(displayedRootCause.failure_type) : "No attributed failure yet";
  const evidenceSummary = evidenceChannels.length ? evidenceChannels.map(humanize).join(" + ") : "Awaiting telemetry consensus";

  return (
    <div style={{ display: "grid", gap: 18, padding: 22, color: palette.text, fontFamily: "'JetBrains Mono', monospace", background: "transparent" }}>
      {fallbackActive && (
        <div style={{ ...panelStyle, padding: 18, border: `1px solid rgba(245,158,11,0.28)`, background: "linear-gradient(180deg, rgba(245,158,11,0.08), rgba(13,17,23,0.98))" }}>
          <div style={{ color: palette.amber, fontSize: 19, fontWeight: 900, letterSpacing: "0.03em" }}>Fallback Mode Active</div>
          <div style={{ color: palette.text, fontSize: 13, marginTop: 6 }}>
            The backend is keeping scoring available with degraded logic while the ML engine is being restored.
          </div>
          <div style={{ color: palette.muted, fontSize: 11, marginTop: 8 }}>
            Active for {fallbackDurationSeconds}s | ML healthy: {systemStatus?.mlEngineHealthy ? "yes" : "no"} | Last remediation: {systemStatus?.lastRemediationTimestamp || "pending"}
          </div>
        </div>
      )}

      <div style={{ ...panelStyle, padding: 20, display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: palette.blue, fontSize: 38, fontWeight: 900, letterSpacing: "0.08em", lineHeight: 1.05 }}>OBSERVABILITY BRAIN</div>
            <div style={{ color: palette.muted, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800, marginTop: 6 }}>
              Multi-signal RCA | Self-healing | 15s SLA
            </div>
          </div>
          {injectionStatus && (
            <div
              style={{
                minWidth: 280,
                maxWidth: 420,
                fontSize: 12,
                borderRadius: 16,
                padding: 12,
                background:
                  injectionStatus.type === "success"
                    ? palette.greenSoft
                    : injectionStatus.type === "error"
                      ? palette.redSoft
                      : palette.blueSoft,
                color:
                  injectionStatus.type === "success"
                    ? palette.green
                    : injectionStatus.type === "error"
                      ? palette.red
                      : palette.blue,
                border: `1px solid ${palette.border}`,
              }}
            >
              {injectionStatus.message}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
          <MetricChip label="Detection confidence" value={displayedRootCause?.confidence ? `${Math.round(displayedRootCause.confidence * 100)}%` : "Monitoring"} accent={incidentColor} accentSoft={incidentColor === palette.red ? palette.redSoft : incidentColor === palette.amber ? palette.amberSoft : palette.greenSoft} />
          <MetricChip label="Scoring mode" value={systemStatus?.fraudScoringMode || "loading"} accent={fallbackActive ? palette.amber : palette.blue} accentSoft={fallbackActive ? palette.amberSoft : palette.blueSoft} />
          <MetricChip label="Evidence channels" value={evidenceChannels.length ? evidenceChannels.join(" + ") : "awaiting consensus"} accent={palette.green} accentSoft={palette.greenSoft} />
          <MetricChip label="Active remediation" value={fallbackActive ? "in progress" : remediations[0]?.success ? "last run recovered" : "idle"} accent={palette.ink} accentSoft={"rgba(15,23,42,0.05)"} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {serviceList.map((service) => (
            <GaugeCard key={service} service={service} score={serviceScores[service]} />
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.08fr 1.22fr", gap: 18 }}>
        <div style={{ ...panelStyle, padding: 18 }}>
          <SectionTitle>Live Anomaly Feed</SectionTitle>
          <div style={{ display: "grid", gap: 10, maxHeight: 420, overflowY: "auto", marginTop: 14 }}>
            {anomalies.length === 0 && (
              <div style={{ padding: 18, borderRadius: 16, background: palette.surface, color: palette.muted, fontSize: 12 }}>
                Waiting for a high-confidence incident. Trigger <strong>ml_engine_latency</strong> or <strong>cascade_failure</strong> to watch the RCA loop live.
              </div>
            )}
            {anomalies.slice(0, 20).map((entry, index) => {
              const rootCause = entry.rootCause || entry;
              return (
                <div key={`${rootCause.anomaly_id || index}`} style={{ padding: 14, borderRadius: 18, background: palette.surface, border: `1px solid ${palette.border}`, borderLeft: `4px solid ${scoreColor(rootCause.confidence || 0)}` }}>
                  <div style={{ fontSize: 13, color: palette.ink, fontWeight: 900 }}>{humanize(rootCause.root_cause_service)}</div>
                  <div style={{ fontSize: 11, color: palette.muted, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{humanize(rootCause.failure_type)}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginTop: 10, alignItems: "center" }}>
                    <div style={{ fontSize: 11, color: palette.text }}>
                      Confidence: <strong>{Math.round((rootCause.confidence || 0) * 100)}%</strong>
                    </div>
                    <div style={{ fontSize: 10, color: palette.faint }}>{rootCause.signal_consensus ?? 0}/3 signals</div>
                  </div>
                  <div style={{ fontSize: 10, color: palette.faint, marginTop: 6 }}>{rootCause.timestamp || entry.timestamp}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ ...panelStyle, padding: 18, display: "grid", gap: 14 }}>
          <SectionTitle>Root Cause Detail Panel</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 12 }}>
            <div>
              <div style={{ color: palette.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 800 }}>Attributed Service</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: incidentColor, lineHeight: 1.05, marginTop: 6 }}>
                {incidentServiceLabel}
              </div>
            </div>
            <div style={{ borderRadius: 18, border: `1px solid ${palette.border}`, background: palette.surface, padding: 14, display: "grid", gap: 8 }}>
              <div style={{ color: palette.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 800 }}>Failure Pattern</div>
              <div style={{ color: palette.ink, fontSize: 18, fontWeight: 900 }}>{incidentFailureLabel}</div>
              <div style={{ color: palette.text, fontSize: 12 }}>{displayedRootCause?.confidence ? `${Math.round(displayedRootCause.confidence * 100)}% confidence` : "Monitoring"}</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: incidentRecovered ? palette.green : fallbackActive ? palette.amber : palette.muted, fontWeight: 700 }}>
            Current state: {displayedRootCause?.root_cause_service ? currentStateLabel : "Monitoring"}
          </div>
          <div style={{ padding: 14, borderRadius: 18, background: palette.surface, border: `1px solid ${palette.border}` }}>
            <div style={{ color: palette.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 800 }}>Business Impact</div>
            <div style={{ fontSize: 14, color: palette.text, lineHeight: 1.7, marginTop: 8 }}>
              {displayedRootCause?.business_impact || "No high-confidence root cause attributed yet."}
            </div>
          </div>

          <div style={{ padding: 16, borderRadius: 18, background: palette.blueSoft, border: `1px solid ${palette.border}` }}>
            <div style={{ color: palette.blue, fontSize: 11, fontWeight: 900, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Why The Brain Blamed This Service
            </div>
            <div style={{ color: palette.text, fontSize: 14, lineHeight: 1.75 }}>
              {displayedRootCause?.operator_summary || displayedRootCause?.explainability_summary || "The observability brain is waiting for enough evidence to attribute a root cause."}
            </div>
          </div>

          <div style={{ padding: 14, borderRadius: 18, background: palette.surface, border: `1px solid ${palette.border}` }}>
            <div style={{ color: palette.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 800 }}>Cause Chain</div>
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              {causeChain.length === 0 && <div style={{ color: palette.muted, fontSize: 12 }}>Cause propagation will appear after attribution.</div>}
              {causeChain.map((step, index) => (
                <div key={`${step}-${index}`} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: palette.text }}>
                  <span style={{ minWidth: 22, height: 22, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: palette.blueSoft, color: palette.blue, fontWeight: 800 }}>
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div style={{ padding: 14, borderRadius: 18, background: palette.surface, border: `1px solid ${palette.border}` }}>
              <div style={{ color: palette.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 800 }}>Evidence Channels</div>
              <div style={{ color: palette.text, fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>{evidenceSummary}</div>
            </div>
            <div style={{ padding: 14, borderRadius: 18, background: palette.surface, border: `1px solid ${palette.border}` }}>
              <div style={{ color: palette.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 800 }}>Recommended action</div>
              <div style={{ color: palette.text, fontSize: 12, marginTop: 8, lineHeight: 1.7 }}>{displayedRootCause?.recommended_action || "Continue monitoring until confidence improves."}</div>
            </div>
            <div style={{ padding: 14, borderRadius: 18, background: palette.surface, border: `1px solid ${palette.border}` }}>
              <div style={{ color: palette.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 800 }}>Remediation rationale</div>
              <div style={{ color: palette.text, fontSize: 12, marginTop: 8, lineHeight: 1.7 }}>{displayedRootCause?.remediation_rationale || "No automated remediation rationale available yet."}</div>
            </div>
          </div>

          <div style={{ fontSize: 12, color: palette.muted }}>
            Signal consensus: <strong style={{ color: palette.text }}>{displayedRootCause?.signal_consensus ?? 0} of 3 telemetry channels agreed</strong>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <SectionTitle>Stabilization Plan</SectionTitle>
              {stabilizationSteps.length === 0 && <div style={{ fontSize: 11, color: palette.muted }}>No stabilization steps available until a root cause is confirmed.</div>}
              {stabilizationSteps.map((step, index) => (
                <div key={`${step}-${index}`} style={{ display: "flex", gap: 10, fontSize: 11, color: palette.text }}>
                  <span style={{ color: palette.blue, fontWeight: 700 }}>{index + 1}.</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <SectionTitle>Composite Scores</SectionTitle>
              {Object.entries(compositeScores).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => (
                <div key={name} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: palette.text }}>
                  <span>{humanize(name)}</span>
                  <span>{Number(value).toFixed(3)}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <SectionTitle>Metric Evidence</SectionTitle>
              {metricEvidence.length === 0 && <div style={{ fontSize: 11, color: palette.muted }}>No metric evidence captured yet.</div>}
              {metricEvidence.map(([name, value]) => (
                <div key={name} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: palette.text }}>
                  <span>{humanize(name)}</span>
                  <span>{Number(value).toFixed(3)}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <SectionTitle>Explainability Features</SectionTitle>
              {shapFeatures.length === 0 && <div style={{ fontSize: 11, color: palette.muted }}>Feature contribution scores will appear after attribution.</div>}
              {shapFeatures.map((item, index) => (
                <div key={`${item.feature}-${index}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: palette.text, gap: 10 }}>
                  <span>{item.feature}</span>
                  <span>{Number(item.score).toFixed(3)}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <SectionTitle>Log Evidence</SectionTitle>
              {latestLogs.length === 0 && <div style={{ fontSize: 11, color: palette.muted }}>Awaiting anomalous log cluster.</div>}
              {latestLogs.slice(0, 3).map((item, index) => (
                <div key={`${item.timestamp || index}`} style={{ fontSize: 11, color: palette.text, background: palette.surface, borderRadius: 14, padding: 10, border: `1px solid ${palette.border}`, lineHeight: 1.65 }}>
                  {item.text || item.message}
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <SectionTitle>Trace Evidence</SectionTitle>
              {latestTraces.length === 0 && <div style={{ fontSize: 11, color: palette.muted }}>Awaiting correlated latency or error spans.</div>}
              {latestTraces.slice(0, 3).map((item, index) => (
                <div key={`${item.traceId}-${item.operation || "trace"}-${index}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: palette.text, gap: 10 }}>
                  <span>{String(item.traceId).slice(0, 16)}...</span>
                  <span>{Math.round(item.duration_ms)}ms</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <SectionTitle>Ensemble Breakdown</SectionTitle>
            {Object.entries(ensembleBreakdown[displayedRootCause?.root_cause_service] || {}).length === 0 && (
              <div style={{ fontSize: 11, color: palette.muted }}>The ensemble vote will appear once the incident is fully attributed.</div>
            )}
            {Object.entries(ensembleBreakdown[displayedRootCause?.root_cause_service] || {}).map(([name, value]) => (
              <div key={name} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: palette.text }}>
                <span>{humanize(name)}</span>
                <span>{Number(value).toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 18 }}>
        <div style={{ ...panelStyle, padding: 18 }}>
          <SectionTitle>Remediation Timeline</SectionTitle>
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {remediations.length === 0 && (
              <div style={{ padding: 18, borderRadius: 16, background: palette.surface, color: palette.muted, fontSize: 12 }}>
                No remediation has been executed yet in this session.
              </div>
            )}
            {remediations.slice(0, 12).map((record, index) => (
              <div key={`${record.remediation_id || index}`} style={{ padding: 14, borderRadius: 18, background: palette.surface, border: `1px solid ${palette.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: palette.ink, fontWeight: 800 }}>
                  <span>{record.root_cause_result?.root_cause_service || "unknown"}</span>
                  <span>{record.recovery_time_ms} ms</span>
                </div>
                <div style={{ color: palette.text, fontSize: 11, marginTop: 6 }}>{(record.actions_taken || []).join(" | ")}</div>
                <div style={{ color: palette.faint, fontSize: 10, marginTop: 6 }}>{record.blockchain_tx_hash || "blockchain log pending or unavailable"}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ ...panelStyle, padding: 18 }}>
            <SectionTitle>Live Recovery Steps</SectionTitle>
            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              {remediationSteps.length === 0 && (
                <div style={{ color: palette.muted, fontSize: 11 }}>
                  No remediation in progress. Trigger <strong>ml_engine_latency</strong> or <strong>cascade_failure</strong> to watch recovery steps arrive live.
                </div>
              )}
              {remediationSteps.map((step, index) => (
                <div
                  key={`${step.timestamp}-${step.step}-${index}`}
                  style={{
                    padding: 12,
                    borderRadius: 16,
                    background: palette.surface,
                    border: `1px solid ${palette.border}`,
                    borderLeft: `4px solid ${step.state === "failed" ? palette.red : step.state === "completed" ? palette.green : palette.blue}`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, color: palette.ink, fontWeight: 800 }}>
                    <span>{step.step}</span>
                    <span style={{ color: step.state === "failed" ? palette.red : step.state === "completed" ? palette.green : palette.blue }}>{step.state}</span>
                  </div>
                  <div style={{ color: palette.text, fontSize: 11, marginTop: 6 }}>{step.detail}</div>
                  <div style={{ color: palette.faint, fontSize: 10, marginTop: 6 }}>
                    {step.service} | {step.failureType} | {step.timestamp}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...panelStyle, padding: 18 }}>
            <SectionTitle>Runtime Status</SectionTitle>
            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              {[
                ["Fraud scoring mode", systemStatus?.fraudScoringMode || "loading"],
                ["Fallback active", fallbackActive ? "yes" : "no"],
                ["ML engine healthy", systemStatus?.mlEngineHealthy ? "yes" : "no"],
                ["Blockchain healthy", systemStatus?.blockchainHealthy ? "yes" : "no"],
                ["Observability brain healthy", systemStatus?.observabilityBrainHealthy ? "yes" : "no"],
                ["Cache mode", systemStatus?.cacheMode || "loading"],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: palette.text }}>
                  <span style={{ color: palette.muted }}>{label}</span>
                  <span style={{ fontWeight: 700 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...panelStyle, padding: 18 }}>
            <SectionTitle>15-Second SLA Meter</SectionTitle>
            <div style={{ marginTop: 18, height: 16, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, (lastCycleDurationMs / 15000) * 100)}%`, height: "100%", background: slaColor }} />
            </div>
            <div style={{ marginTop: 12, fontSize: 30, fontWeight: 900, color: slaColor }}>{Math.round(lastCycleDurationMs)} ms</div>
            <div style={{ color: palette.muted, fontSize: 11 }}>Green under 12s | Amber 12-14s | Red over 14s</div>
          </div>

          <div style={{ ...panelStyle, padding: 18 }}>
            <SectionTitle>Failure Injection Panel</SectionTitle>
            <div style={{ color: palette.muted, fontSize: 11, marginTop: 8, marginBottom: 12 }}>
              Recommended demo paths: <strong>ml_engine_latency</strong> and <strong>cascade_failure</strong>. Both show fallback activation and visible remediation steps.
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {failureTypes.map((failureType) => (
                <button
                  key={failureType}
                  onClick={() => handleInject(failureType)}
                  disabled={injecting === failureType}
                  style={{
                    border: `1px solid ${palette.borderStrong}`,
                    borderRadius: 16,
                    padding: "13px 14px",
                    textAlign: "left",
                    background: injecting === failureType ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                    color: palette.text,
                    cursor: "pointer",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {injecting === failureType ? `Injecting ${failureType}...` : failureType}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
