import React, { useState } from "react";
import { testSms } from "../../services/api";
import useFraudStore from "../../store/fraudStore";

export default function LiveSMSFeed() {
  const [sending, setSending] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const smsFeed = useFraudStore((state) => state.smsFeed);

  const trigger = async () => {
    setSending(true);
    try {
      await testSms();
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ background: "linear-gradient(135deg, #0d1117, #0a0f1a)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <style>{`@keyframes slideRightCard { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }`}</style>
      <div style={{ fontSize: 11, letterSpacing: "0.12em", color: "#475569", textTransform: "uppercase" }}>Bank Alert Monitor</div>

      <button onClick={() => setShowSetup((current) => !current)} style={{ textAlign: "left", background: "rgba(255,255,255,0.03)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 10px", cursor: "pointer", fontSize: 11 }}>
        Setup Instructions {showSetup ? "▲" : "▼"}
      </button>
      {showSetup && (
        <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.6 }}>
          1. Install SMS Forwarder
          <br />2. Add HTTP POST to `http://YOUR-IP:3001/api/sms/incoming`
          <br />3. Filter HDFCBK, ICICIB, SBIPSG, AXISBK
          <br />4. Make any UPI payment and it appears here
        </div>
      )}

      <button onClick={trigger} disabled={sending} style={{ background: "#f59e0b", color: "#04131b", border: "none", borderRadius: 12, padding: "10px 12px", fontWeight: 700, cursor: "pointer" }}>
        {sending ? "Submitting..." : "Test Bank SMS"}
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflow: "auto" }}>
        {smsFeed.length === 0 ? (
          <div style={{ textAlign: "center", color: "#475569", fontSize: 12, padding: "18px 8px" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📱</div>
            <div style={{ color: "#334155", fontWeight: 700 }}>Bank SMS monitor ready</div>
            <div style={{ marginTop: 4 }}>Make any UPI payment - your bank SMS appears here instantly</div>
            <button onClick={trigger} disabled={sending} style={{ marginTop: 10, background: "#f59e0b", color: "#04131b", border: "none", borderRadius: 10, padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}>
              Send Test SMS
            </button>
          </div>
        ) : smsFeed.map((entry, index) => {
          const score = Number(entry.result?.fraudScore || entry.fraudScore || 0);
          const decision = String(entry.result?.decision || entry.decision || "approve").toUpperCase();
          return (
            <div key={`${entry.timestamp}-${index}`} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 12, animation: "slideRightCard 0.25s ease-out" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 999, padding: "2px 8px", fontSize: 10 }}>{entry.parsed?.bankName || entry.from || "Bank"}</span>
                <div style={{ color: "#f59e0b", fontWeight: 700, fontSize: 30 }}>₹{Number(entry.parsed?.amount || 0).toLocaleString("en-IN")}</div>
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8" }}>{entry.parsed?.merchant || "Bank Transfer"} • {entry.parsed?.paymentMethod || "UPI"}</div>
              <div style={{ marginTop: 6, fontSize: 10, color: "#64748b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{entry.parsed?.utrNumber || "UTR pending"}</span>
                <span style={{ color: "#f59e0b", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 999, padding: "2px 6px" }}>BANK ALERT</span>
              </div>
              <div style={{ marginTop: 7, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: score >= 70 ? "#ef4444" : "#22d3ee", border: `1px solid ${score >= 70 ? "rgba(239,68,68,0.4)" : "rgba(34,211,238,0.35)"}`, borderRadius: 999, padding: "2px 8px" }}>{score}/100</span>
                <span style={{ fontSize: 10, color: score >= 70 ? "#ef4444" : "#22d3ee", fontWeight: 700 }}>{decision}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
