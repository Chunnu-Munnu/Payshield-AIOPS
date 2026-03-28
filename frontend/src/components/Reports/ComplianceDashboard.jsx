import React from "react";

export default function ComplianceDashboard({ compliance }) {
  const data = compliance || {};
  return (
    <div style={{ background: "linear-gradient(135deg, #0d1117, #0a0f1a)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.12em", color: "#475569", textTransform: "uppercase" }}>Compliance Dashboard</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
        {Object.entries(data).map(([key, value]) => (
          <div key={key} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 12 }}>
            <div style={{ color: "#94a3b8", fontSize: 11 }}>{key}</div>
            <div style={{ marginTop: 6, fontWeight: 700, color: "#f1f5f9" }}>{typeof value === "number" ? value.toFixed(3) : String(value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
