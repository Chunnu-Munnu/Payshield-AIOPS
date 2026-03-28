import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const FILTERS = ["All", "Flagged", "Blocked", "Cleared", "Gmail", "SMS"];

function riskColor(score) {
  if (score >= 90) return { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.22)", badge: "#ef4444" };
  if (score >= 70) return { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)", badge: "#f59e0b" };
  return { bg: "rgba(34,211,238,0.04)", border: "rgba(34,211,238,0.1)", badge: "#22d3ee" };
}

function ScoreBadge({ score }) {
  const { badge } = riskColor(score);
  return <span style={{ background: `${badge}20`, border: `1px solid ${badge}55`, color: badge, borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{score}</span>;
}

function SourceBadge({ source }) {
  const map = {
    GMAIL_LIVE: { color: "#38bdf8", bg: "rgba(56,189,248,0.15)" },
    BANK_SMS: { color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
    MANUAL: { color: "#22d3ee", bg: "rgba(34,211,238,0.12)" },
    RESILIENCE: { color: "#a78bfa", bg: "rgba(167,139,250,0.15)" },
    FALLBACK: { color: "#a78bfa", bg: "rgba(167,139,250,0.15)" },
  };
  const labelMap = {
    GMAIL_LIVE: "GMAIL_LIVE",
    BANK_SMS: "BANK_SMS",
    MANUAL: "MANUAL",
    RESILIENCE: "RESILIENCE",
    FALLBACK: "RESILIENCE",
  };
  const palette = map[source] || { color: "#64748b", bg: "rgba(100,116,139,0.15)" };
  return <span style={{ color: palette.color, border: `1px solid ${palette.color}55`, background: palette.bg, borderRadius: 999, padding: "2px 7px", fontSize: 9, fontWeight: 700 }}>{labelMap[source] || "MANUAL"}</span>;
}

export default function TransactionFeed({ transactions = [], onSelect }) {
  const [filter, setFilter] = useState("All");
  const filtered = useMemo(() => transactions.filter((tx) => {
    if (filter === "Flagged") return (tx.fraudScore || 0) >= 70;
    if (filter === "Blocked") return ["block", "quarantine"].includes(tx.decision);
    if (filter === "Cleared") return (tx.fraudScore || 0) < 70;
    if (filter === "Gmail") return tx.source === "GMAIL_LIVE";
    if (filter === "SMS") return tx.source === "BANK_SMS";
    return true;
  }), [transactions, filter]);

  const noChannelResults = (filter === "Gmail" || filter === "SMS") && filtered.length === 0;

  return (
    <div style={{ background: "linear-gradient(135deg, #0d1117 0%, #0a0f1a 100%)", borderRadius: 20, padding: 16, border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 11, letterSpacing: "0.12em", color: "#475569", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
          {transactions.length > 0 && (
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22d3ee", boxShadow: "0 0 6px #22d3ee", animation: "ping 1.2s ease-out infinite" }} />
          )}
          Transaction Feed <span style={{ color: "#334155" }}>({transactions.length})</span>
        </span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.map((item) => (
            <button key={item} onClick={() => setFilter(item)} style={{ background: filter === item ? "#38bdf8" : "transparent", border: `1px solid ${filter === item ? "#38bdf8" : "rgba(255,255,255,0.08)"}`, color: filter === item ? "#020c14" : "#64748b", padding: "4px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
              {item.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div style={{ maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        <AnimatePresence initial={false}>
          {filtered.map((tx) => {
            const { bg, border } = riskColor(tx.fraudScore || 0);
            return (
              <motion.button key={tx.txId} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} onClick={() => onSelect?.(tx)} style={{ textAlign: "left", background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "10px 12px", color: "#e2e8f0", cursor: "pointer", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ color: "#f1f5f9", fontWeight: 700 }}>₹{Number(tx.amount || 0).toLocaleString("en-IN")}</div>
                    <SourceBadge source={tx.source} />
                  </div>
                  <ScoreBadge score={tx.fraudScore || 0} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
                  <div style={{ color: "#cbd5e1" }}>{tx.merchant}</div>
                  <div style={{ color: "#64748b" }}>{String(tx.decision || "approve").replace(/_/g, " ").toUpperCase()}</div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 10, color: "#64748b" }}>
                  <span>{new Date(tx.timestamp).toLocaleString("en-IN")}</span>
                  <span>{tx.paymentMethod || "UPI"} • {tx.country || "IN"}</span>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
        {noChannelResults && <div style={{ textAlign: "center", color: "#334155", padding: "32px 0", fontSize: 12 }}>Send a test email or bank SMS to see live detection here</div>}
        {!noChannelResults && filtered.length === 0 && <div style={{ textAlign: "center", color: "#334155", padding: "32px 0", fontSize: 12 }}>No live transactions match this filter.</div>}
      </div>
    </div>
  );
}
