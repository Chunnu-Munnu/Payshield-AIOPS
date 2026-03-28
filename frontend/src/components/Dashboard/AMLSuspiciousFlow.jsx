import React from "react";
import { motion } from "framer-motion";

const PATTERN_STYLES = {
  smurfing: { color: "#ef4444", label: "SMURFING", desc: "Multiple small deposits to avoid reporting thresholds." },
  layering: { color: "#f59e0b", label: "LAYERING", desc: "Rapid fund movement through intermediary accounts." },
  fan_out: { color: "#ef4444", label: "FAN-OUT", desc: "Single source dispersed to many destinations rapidly." },
  round_trip: { color: "#f59e0b", label: "ROUND-TRIP", desc: "Funds routed back to originating account via proxies." },
  circular_flow: { color: "#ef4444", label: "CIRCULAR FLOW", desc: "Triangular transaction loop detected across linked parties." },
  unknown: { color: "#64748b", label: "UNKNOWN", desc: "Unclassified suspicious activity pattern." },
  none: { color: "#22d3ee", label: "NORMAL FLOW", desc: "No AML pattern detected in this transaction path." },
};

function FlowNode({ label, sublabel, highlight, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1, type: "spring", stiffness: 180 }}
      style={{
        background: highlight ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${highlight ? "rgba(239,68,68,0.24)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 16,
        padding: "14px 16px",
        textAlign: "center",
        flex: 1,
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 9, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 12, color: highlight ? "#fca5a5" : "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sublabel || "-"}</div>
    </motion.div>
  );
}

function Arrow({ color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", flexShrink: 0, padding: "0 6px" }}>
      <svg width="34" height="12" viewBox="0 0 34 12" fill="none">
        <motion.line x1="2" y1="6" x2="28" y2="6" stroke={color} strokeWidth="1.5" strokeDasharray="4 3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.2 }} />
        <path d="M26 2.5L32 6L26 9.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </div>
  );
}

export default function AMLSuspiciousFlow({ transaction }) {
  const patternKey = (transaction?.detectedPattern || "none").toLowerCase().replace(/ /g, "_");
  const pattern = PATTERN_STYLES[patternKey] || PATTERN_STYLES.unknown;
  const suspiciousAccounts = transaction?.suspiciousAccounts || [];
  const intermediaries = suspiciousAccounts.length > 0 ? suspiciousAccounts.slice(0, 2).join(" · ") : "XX1234";

  if (!transaction && (patternKey === "none" || !patternKey)) {
    return (
      <div className="ps-card p-10 flex flex-col items-center justify-center min-h-[220px] gap-3">
        <div style={{ fontSize: 28, color: "#334155" }}>◈</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>AML monitoring active</div>
      </div>
    );
  }

  return (
    <div style={{ background: "linear-gradient(135deg, #0d1117 0%, #0a0f1a 100%)", borderRadius: 20, padding: 20, border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <span style={{ fontSize: 11, letterSpacing: "0.12em", color: "#475569", textTransform: "uppercase" }}>AML Flow Analysis</span>
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} style={{ background: `${pattern.color}15`, border: `1px solid ${pattern.color}40`, color: pattern.color, borderRadius: 999, padding: "5px 12px", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em" }}>{pattern.label}</motion.div>
      </div>

      <div style={{ background: `${pattern.color}10`, border: `1px solid ${pattern.color}25`, borderRadius: 12, padding: "10px 14px", fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
        {pattern.desc}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <FlowNode label="Source" sublabel={transaction?.userId?.slice(0, 14) || "load@payshield"} highlight={patternKey !== "none"} index={0} />
        <Arrow color={pattern.color} />
        <FlowNode label="Intermediaries" sublabel={intermediaries} highlight={false} index={1} />
        <Arrow color={pattern.color} />
        <FlowNode label="Destination" sublabel={transaction?.merchant?.slice(0, 16) || "Unknown Vendor"} highlight={patternKey === "circular_flow" || patternKey === "round_trip"} index={2} />
      </div>

      {transaction?.utrNumber && <div style={{ fontSize: 10, color: "#64748b" }}>UTR: {transaction.utrNumber}</div>}

      {transaction?.amlRiskScore !== undefined && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.08em" }}>AML RISK SCORE</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 120, height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 999 }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${(transaction.amlRiskScore || 0) * 100}%` }} transition={{ duration: 0.4, ease: "easeOut" }} style={{ height: "100%", borderRadius: 999, background: pattern.color, boxShadow: `0 0 8px ${pattern.color}` }} />
            </div>
            <span style={{ fontSize: 11, color: pattern.color, fontWeight: 700 }}>{Math.round((transaction.amlRiskScore || 0) * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
