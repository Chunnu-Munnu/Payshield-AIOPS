import React, { useState } from "react";
import { sendTestBecEmail } from "../../services/api";
import useFraudStore from "../../store/fraudStore";

const scenarios = [
  { key: "standard", label: "Vendor Change", desc: "IBAN update request" },
  { key: "ceo_fraud", label: "Executive Request", desc: "Executive wire order" },
  { key: "invoice_scam", label: "Invoice Update", desc: "Invoice account change" },
];

export default function LiveEmailMonitor() {
  const [sending, setSending] = useState(false);
  const [scenario, setScenario] = useState("standard");
  const [message, setMessage] = useState("");
  const emailFeed = useFraudStore((state) => state.emailFeed);
  const gmailConnected = useFraudStore((state) => state.gmailConnected);

  const trigger = async () => {
    setSending(true);
    try {
      const response = await sendTestBecEmail(scenario);
      setMessage(response.message);
    } catch (error) {
      setMessage(error.response?.data?.error || "Email submission failed.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ background: "linear-gradient(135deg, #0d1117, #0a0f1a)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <style>{`
        @keyframes pulseOpacity { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes slideLeftCard { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.12em", color: "#475569", textTransform: "uppercase" }}>Email Instruction Monitor</div>
          <div style={{ marginTop: 6, fontSize: 12, color: gmailConnected ? "#22c55e" : "#ef4444", display: "flex", alignItems: "center", gap: 8 }}>
            Watching am***@gmail.com
            {gmailConnected && (
              <>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e", animation: "ping 1.4s ease-out infinite" }} />
                <span style={{ animation: "pulseOpacity 0.8s ease-in-out infinite", color: "#22c55e" }}>Scanning inbox...</span>
              </>
            )}
          </div>
        </div>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: gmailConnected ? "#22c55e" : "#ef4444", boxShadow: gmailConnected ? "0 0 10px #22c55e" : "0 0 10px #ef4444" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
        {scenarios.map((item) => (
          <button key={item.key} onClick={() => setScenario(item.key)} style={{ textAlign: "left", background: "rgba(255,255,255,0.03)", color: scenario === item.key ? "#e2f7ff" : "#94a3b8", border: `1px solid ${scenario === item.key ? "#38bdf8" : "rgba(255,255,255,0.08)"}`, borderLeft: scenario === item.key ? "3px solid #38bdf8" : "3px solid transparent", borderRadius: 12, padding: "8px 10px", cursor: "pointer" }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{item.label}</div>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{item.desc}</div>
          </button>
        ))}
      </div>

      <button onClick={trigger} disabled={sending} style={{ background: "#38bdf8", color: "#04131b", border: "none", borderRadius: 12, padding: "10px 12px", fontWeight: 700, cursor: "pointer" }}>
        {sending ? "Submitting..." : "Send Review Email"}
      </button>
      {message && <div style={{ fontSize: 11, color: "#94a3b8" }}>{message}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflow: "auto" }}>
        {emailFeed.length === 0 ? (
          <div style={{ color: "#475569", fontSize: 12, textAlign: "center", padding: "18px 8px" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📧</div>
            <div style={{ color: "#334155", fontWeight: 700 }}>Gmail inbox monitor active</div>
            <div style={{ marginTop: 4 }}>Send a test email above - detection appears here within 30 seconds</div>
          </div>
        ) : emailFeed.map((email, index) => (
          <div key={`${email.subject}-${index}`} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 12, animation: "slideLeftCard 0.25s ease-out" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div style={{ color: "#f1f5f9", fontSize: 12, fontWeight: 700, lineHeight: 1.4 }}>{email.subject}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 9, color: "#38bdf8", border: "1px solid rgba(56,189,248,0.4)", borderRadius: 999, padding: "2px 6px" }}>GMAIL LIVE</span>
                <span style={{ color: (email.fraudScore || 0) >= 70 ? "#ef4444" : "#22d3ee", fontWeight: 700, fontSize: 11 }}>{email.fraudScore ? `${email.fraudScore}/100` : "scanning..."}</span>
              </div>
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8", display: "flex", justifyContent: "space-between" }}>
              <span>From {email.from}</span>
              <span style={{ color: (String(email.decision || "").toLowerCase() === "block") ? "#ef4444" : "#22d3ee", fontWeight: 700 }}>{email.decision ? email.decision.toUpperCase() : "SCANNING"}</span>
            </div>
            {email.flaggedPhrases?.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {email.flaggedPhrases.map((phrase) => (
                  <span key={phrase} style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 999, padding: "3px 8px", fontSize: 10, color: "#fca5a5" }}>{phrase}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
