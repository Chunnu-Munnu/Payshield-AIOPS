import React from "react";

export default function SARReport({ alert }) {
  return (
    <div style={{ background: "linear-gradient(135deg, #0d1117, #0a0f1a)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.12em", color: "#475569", textTransform: "uppercase" }}>SAR Report</div>
      <div style={{ fontSize: 12, color: "#94a3b8" }}>{alert ? "Auto-generated FinCEN-style suspicious activity report for the latest AML-linked alert." : "Generate a suspicious activity report by triggering an alert."}</div>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 14, fontSize: 12, color: "#cbd5e1", lineHeight: 1.7 }}>
        <div>Alert ID: {alert?.alertId || "Awaiting alert"}</div>
        <div>Decision: {alert?.decision || "n/a"}</div>
        <div>Pattern: {alert?.detectedPattern || "unknown"}</div>
        <div>Blockchain Ref: {alert?.blockchainTxHash || "pending"}</div>
      </div>
    </div>
  );
}
