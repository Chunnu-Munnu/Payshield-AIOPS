import React from "react";

export default function AttackPatternSelector({ value, onChange }) {
  const options = ["card_not_present", "account_takeover", "synthetic_identity", "fraud_ring", "bec", "micro_bot"];
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} style={{ background: "#111827", color: "#f1f5f9", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12, width: "100%", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", cursor: "pointer" }}>
      {options.map((option) => (
        <option key={option} value={option}>{option.replaceAll("_", " ")}</option>
      ))}
    </select>
  );
}
