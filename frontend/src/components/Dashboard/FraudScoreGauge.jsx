import React from "react";
import { motion } from "framer-motion";

const COLORS = {
  low: { stroke: "#38bdf8", glow: "rgba(56,189,248,0.3)", label: "LOW RISK" },
  medium: { stroke: "#f59e0b", glow: "rgba(245,158,11,0.3)", label: "MEDIUM RISK" },
  high: { stroke: "#ef4444", glow: "rgba(239,68,68,0.35)", label: "HIGH RISK" },
};

function polarToCartesian(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx, cy, r, start, end) {
  if (end - start >= 360) end = 359.99;
  const s = polarToCartesian(cx, cy, r, start);
  const e = polarToCartesian(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

export default function FraudScoreGauge({ score = 0, decision = "pending" }) {
  const tier = score >= 70 ? "high" : score >= 30 ? "medium" : "low";
  const { stroke, glow, label } = COLORS[tier];
  const filled = (score / 100) * 360;

  const decisionStyles = {
    block: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)" },
    quarantine: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
    step_up_auth: { color: "#38bdf8", bg: "rgba(56,189,248,0.12)", border: "rgba(56,189,248,0.3)" },
    approve: { color: "#22d3ee", bg: "rgba(34,211,238,0.12)", border: "rgba(34,211,238,0.3)" },
    pending: { color: "#64748b", bg: "rgba(100,116,139,0.12)", border: "rgba(100,116,139,0.3)" },
  };
  const ds = decisionStyles[decision] || decisionStyles.pending;

  return (
    <div style={{ background: "linear-gradient(135deg, #0d1117 0%, #0a0f1a 100%)", borderRadius: 20, padding: "16px 16px", border: "1px solid rgba(255,255,255,0.06)", boxShadow: `0 0 60px ${glow}`, fontFamily: "'JetBrains Mono', monospace", minHeight: 240, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ alignSelf: "flex-start", fontSize: 11, letterSpacing: "0.12em", color: "#475569", textTransform: "uppercase" }}>Fraud Score</div>

      <div style={{ position: "relative", width: 160, height: 160 }}>
        <svg viewBox="0 0 160 160" width="160" height="160" style={{ position: "absolute", top: 0, left: 0 }}>
          <circle cx="80" cy="80" r="62" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
          {score > 0 && (
            <motion.path
              d={arcPath(80, 80, 62, 0, filled)}
              fill="none"
              stroke={stroke}
              strokeWidth="10"
              strokeLinecap="round"
              filter={`drop-shadow(0 0 8px ${stroke})`}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          )}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <motion.div key={score} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200 }} style={{ fontSize: 42, fontWeight: 700, lineHeight: 1, color: "#f1f5f9" }}>
            {score}
          </motion.div>
          <div style={{ fontSize: 10, letterSpacing: "0.1em", color: stroke, marginTop: 4 }}>{label}</div>
        </div>
      </div>

      <div style={{ padding: "7px 18px", borderRadius: 999, background: ds.bg, border: `1px solid ${ds.border}`, color: ds.color, fontSize: 11, letterSpacing: "0.14em", fontWeight: 700 }}>
        {decision.replace(/_/g, " ").toUpperCase()}
      </div>
      <div style={{ fontSize: 10, color: "#334155", marginTop: 4 }}>
        {score >= 70 ? "Alert sent to amoghrules20@gmail.com" : "Transaction cleared - no alert"}
      </div>
    </div>
  );
}
