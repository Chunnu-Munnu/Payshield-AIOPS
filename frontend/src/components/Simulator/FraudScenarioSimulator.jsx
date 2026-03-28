import React, { useState } from "react";
import { simulateFraud } from "../../services/api";
import AttackPatternSelector from "./AttackPatternSelector";
import useFraudStore from "../../store/fraudStore";

export default function FraudScenarioSimulator() {
  const [pattern, setPattern] = useState("fraud_ring");
  const [amount, setAmount] = useState(7800);
  const [loading, setLoading] = useState(false);
  const addTransaction = useFraudStore((state) => state.addTransaction);
  const setSelectedTransaction = useFraudStore((state) => state.setSelectedTransaction);
  const addAlert = useFraudStore((state) => state.addAlert);

  const runSimulation = async () => {
    setLoading(true);
    try {
      const { result, transaction, alert } = await simulateFraud({ pattern, amount });
      const tx = {
        txId: transaction.txId,
        amount: transaction.amount,
        currency: transaction.currency || "INR",
        merchant: transaction.merchantName,
        country: transaction.country || transaction.geolocation?.country || "IN",
        fraudScore: Math.round(result.fraudScore * 100),
        riskSignal: 1,
        decision: result.decision,
        explanation: result.explanation,
        detectedPattern: result.detectedPattern,
        amlRiskScore: result.amlScore,
        suspiciousAccounts: result.suspiciousAccounts,
        timestamp: new Date().toISOString(),
        userId: transaction.userId,
        deviceId: transaction.deviceId,
      };
      addTransaction(tx);
      if (alert) {
        addAlert({
          ...alert,
          severity: String(alert.severity || "high").toUpperCase(),
        });
      }
      setSelectedTransaction(tx);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "linear-gradient(135deg, #0d1117, #0a0f1a)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: 20 }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", marginBottom: 12, fontSize: 11, letterSpacing: "0.12em", color: "#475569", textTransform: "uppercase" }}>Fraud Scenario Control</div>
      <AttackPatternSelector value={pattern} onChange={setPattern} />
      <div style={{ marginTop: 12, color: "#94a3b8", fontSize: 12 }}>
        Amount: ₹{Number(amount).toLocaleString("en-IN")}
        <input type="range" min="100" max="20000" value={amount} onChange={(e) => setAmount(Number(e.target.value))} style={{ width: "100%", marginTop: 8 }} />
      </div>
      <button onClick={runSimulation} disabled={loading} style={{ marginTop: 16, width: "100%", background: "#38bdf8", color: "#04131b", border: 0, borderRadius: 12, padding: "12px 16px", fontWeight: 700 }}>
        {loading ? "Simulating..." : "Simulate Attack"}
      </button>
    </div>
  );
}
