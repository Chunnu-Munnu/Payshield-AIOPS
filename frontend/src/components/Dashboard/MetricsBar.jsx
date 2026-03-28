import React from "react";
import { motion } from "framer-motion";

const CARD_STYLE = {
  background: "linear-gradient(135deg, #0d1117, #0a0f1a)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 16,
  padding: "12px 14px",
  fontFamily: "'JetBrains Mono', monospace",
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

function StatusDot({ active }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: 8, height: 8, marginRight: 6 }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: active ? "#22d3ee" : "#475569", boxShadow: active ? "0 0 6px #22d3ee" : "none" }} />
      {active && <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#22d3ee", opacity: 0.4, animation: "ping 1.4s ease-out infinite" }} />}
    </span>
  );
}

export default function MetricsBar({ metrics = {} }) {
  const {
    transactionsPerSecond = 0,
    fraudRate = 0,
    falsePositiveRate = 0,
    avgResponseMs = 0,
    modelsActive = "0/6",
    blockchain = "SYNCED",
    federatedRound = "#00",
  } = metrics;

  const items = [
    { label: "Tx / sec", value: transactionsPerSecond, accent: "#38bdf8" },
    { label: "Fraud Rate", value: `${Number(fraudRate).toFixed(2)}%`, accent: fraudRate > 3 ? "#ef4444" : "#22d3ee" },
    { label: "False Positive", value: `${(Number(falsePositiveRate) * 100).toFixed(2)}%`, accent: falsePositiveRate > 0.02 ? "#f59e0b" : "#22d3ee" },
    { label: "Latency", value: `${avgResponseMs}ms`, accent: avgResponseMs > 150 ? "#f59e0b" : "#22d3ee" },
    { label: "Models", value: modelsActive, accent: "#38bdf8", dot: true, dotActive: modelsActive !== "0/6" },
    { label: "Chain", value: blockchain, accent: blockchain === "SYNCED" ? "#22d3ee" : "#f59e0b", dot: true, dotActive: blockchain === "SYNCED" },
    { label: "FL Round", value: federatedRound, accent: "#38bdf8" },
  ];

  return (
    <>
      <style>{`
        @keyframes ping {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
        {items.map(({ label, value, accent, dot, dotActive }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.3 }} style={{ ...CARD_STYLE, borderBottom: `2px solid ${accent}40` }}>
            <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", display: "flex", alignItems: "center" }}>
              {dot && <StatusDot active={dotActive} />}
              <span style={{ color: accent }}>{value}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </>
  );
}
