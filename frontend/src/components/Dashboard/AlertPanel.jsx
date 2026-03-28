import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SEVERITY_STYLES = {
  CRITICAL: { color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.25)", dot: "#ef4444" },
  HIGH: { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)", dot: "#f59e0b" },
  MEDIUM: { color: "#38bdf8", bg: "rgba(56,189,248,0.06)", border: "rgba(56,189,248,0.15)", dot: "#38bdf8" },
  LOW: { color: "#475569", bg: "rgba(71,85,105,0.06)", border: "rgba(71,85,105,0.15)", dot: "#475569" },
};

const DECISION_LABELS = {
  block: "BLOCKED",
  quarantine: "QUARANTINED",
  step_up_auth: "2FA REQUIRED",
  approve: "APPROVED",
};

export default function AlertPanel({ alerts = [] }) {
  const displayed = alerts.slice(0, 6);
  const [newIds, setNewIds] = useState(new Set());

  useEffect(() => {
    if (displayed.length === 0) return;
    const next = new Set(newIds);
    displayed.forEach((alert) => {
      const id = alert.alertId || alert.txId;
      if (!next.has(id)) {
        next.add(id);
        setTimeout(() => {
          setNewIds((current) => {
            const copy = new Set(current);
            copy.delete(id);
            return copy;
          });
        }, 5000);
      }
    });
    setNewIds(next);
  }, [alerts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ background: "linear-gradient(135deg, #0d1117 0%, #0a0f1a 100%)", borderRadius: 20, padding: 16, border: "1px solid rgba(255,255,255,0.06)", fontFamily: "'JetBrains Mono', monospace", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, letterSpacing: "0.12em", color: "#475569", textTransform: "uppercase" }}>Active Alerts</span>
        {displayed.length > 0 && <span style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: 999, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>{alerts.length}</span>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <AnimatePresence>
          {displayed.map((alert, i) => {
            const sev = (alert.severity || "LOW").toUpperCase();
            const style = SEVERITY_STYLES[sev] || SEVERITY_STYLES.LOW;
            const decisionLabel = DECISION_LABELS[alert.decision] || (alert.decision || "").toUpperCase();
            const id = alert.alertId || alert.txId || String(i);
            return (
              <motion.div key={id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ delay: i * 0.04 }} style={{ background: style.bg, border: `1px solid ${style.border}`, borderRadius: 12, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ position: "relative", width: 8, height: 8, flexShrink: 0 }}>
                      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: style.dot }} />
                      {sev === "CRITICAL" && <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: style.dot, opacity: 0.4, animation: "ping 1.4s ease-out infinite" }} />}
                    </span>
                    <span style={{ fontSize: 11, color: style.color, fontWeight: 700, letterSpacing: "0.08em" }}>{decisionLabel}</span>
                    {newIds.has(id) && <span style={{ fontSize: 9, color: "#22d3ee", border: "1px solid rgba(34,211,238,0.35)", padding: "1px 6px", borderRadius: 999 }}>NEW</span>}
                  </div>
                  <span style={{ fontSize: 9, color: style.color, background: `${style.color}18`, border: `1px solid ${style.color}30`, borderRadius: 6, padding: "2px 7px", letterSpacing: "0.1em" }}>{sev}</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#64748b" }}>{String(alert.txId || "").slice(0, 22)}...</span>
                  <div style={{ display: "flex", gap: 10 }}>
                    <span style={{ fontSize: 10, color: "#475569" }}>Fraud <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{Math.round((alert.fraudScore || 0) * 100)}%</span></span>
                    <span style={{ fontSize: 10, color: "#475569" }}>AML <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{Math.round((alert.amlScore || 0) * 100)}%</span></span>
                  </div>
                </div>

                {alert.amount !== undefined && (
                  <div style={{ fontSize: 12, color: "#f1f5f9", fontWeight: 700 }}>₹{Number(alert.amount || 0).toLocaleString("en-IN")}</div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        {displayed.length === 0 && <div style={{ textAlign: "center", color: "#1e293b", padding: "18px 0", fontSize: 12 }}><div style={{ fontSize: 22, marginBottom: 8 }}>◎</div>No active alerts</div>}
      </div>
    </div>
  );
}
