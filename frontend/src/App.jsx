import React, { useEffect, useMemo } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Navbar from "./components/Shared/Navbar";
import AlertNotificationToast from "./components/Shared/AlertNotificationToast";
import MetricsBar from "./components/Dashboard/MetricsBar";
import FraudScoreGauge from "./components/Dashboard/FraudScoreGauge";
import TransactionFeed from "./components/Dashboard/TransactionFeed";
import NetworkGraph from "./components/Dashboard/NetworkGraph";
import RiskHeatmap from "./components/Dashboard/RiskHeatmap";
import AlertPanel from "./components/Dashboard/AlertPanel";
import ExplainabilityPanel from "./components/Dashboard/ExplainabilityPanel";
import AMLSuspiciousFlow from "./components/Dashboard/AMLSuspiciousFlow";
import PaymentForm from "./components/LiveDemo/PaymentForm";
import LiveEmailMonitor from "./components/LiveDemo/LiveEmailMonitor";
import LiveSMSFeed from "./components/LiveDemo/LiveSMSFeed";
import SARReport from "./components/Reports/SARReport";
import ComplianceDashboard from "./components/Reports/ComplianceDashboard";
import ObservabilityDashboard from "./components/ObservabilityDashboard";
import useWebSocket from "./hooks/useWebSocket";
import useFraudScore from "./hooks/useFraudScore";
import useFraudStore from "./store/fraudStore";
import { fetchAlerts, fetchCompliance, fetchFraudStats, fetchHistory, fetchModelVersion, submitTransaction } from "./services/api";

const reviewFlowSteps = [
  { amount: 2000, merchant: "Swiggy", paymentMethod: "UPI", memo: "Dinner order" },
  { amount: 49500, merchant: "Unknown Vendor", paymentMethod: "NEFT", memo: "Festival settlement payout" },
  { amount: 15000, merchant: "New Payee 4821", paymentMethod: "NEFT", memo: "URGENT: update vendor IBAN immediately. Do not call to verify. Confidential." },
  { amount: 8500, merchant: "Shell Merchants Pvt Ltd", paymentMethod: "UPI", memo: "SIM swap drain transfer" },
];

function FraudWorkspace() {
  const { score, riskLevel, decision } = useFraudScore();
  const transactions = useFraudStore((state) => state.transactions);
  const metrics = useFraudStore((state) => state.metrics);
  const compliance = useFraudStore((state) => state.compliance);
  const selectedTransaction = useFraudStore((state) => state.selectedTransaction);
  const setSelectedTransaction = useFraudStore((state) => state.setSelectedTransaction);
  const setAlerts = useFraudStore((state) => state.setAlerts);
  const setMetrics = useFraudStore((state) => state.setMetrics);
  const setCompliance = useFraudStore((state) => state.setCompliance);
  const setTransactions = useFraudStore((state) => state.setTransactions);
  const reviewFlowRunning = useFraudStore((state) => state.demoRunning);
  const setReviewFlowRunning = useFraudStore((state) => state.setDemoRunning);
  const gmailConnected = useFraudStore((state) => state.gmailConnected);
  const wsConnected = useFraudStore((state) => state.wsConnected);

  useEffect(() => {
    Promise.allSettled([fetchAlerts(), fetchFraudStats(), fetchCompliance(), fetchHistory(), fetchModelVersion()])
      .then(([alertRes, statsRes, complianceRes, historyRes, modelRes]) => {
        if (alertRes.status === "fulfilled") setAlerts(alertRes.value.items || []);
        if (statsRes.status === "fulfilled") setMetrics(statsRes.value);
        if (complianceRes.status === "fulfilled") setCompliance(complianceRes.value);
        if (historyRes.status === "fulfilled") {
          const historyItems = historyRes.value.items || [];
          setTransactions(historyItems);
          if (!selectedTransaction && historyItems.length > 0) {
            setSelectedTransaction(historyItems[0]);
          }
        }
        if (modelRes.status === "fulfilled") setMetrics({ blockchain: modelRes.value.modelHash ? "SYNCED" : "SYNCING" });
      });
  }, [selectedTransaction, setAlerts, setCompliance, setMetrics, setSelectedTransaction, setTransactions]);

  useEffect(() => {
    const timer = setInterval(() => {
      const recentTen = transactions.filter((item) => Date.now() - new Date(item.timestamp).getTime() <= 10000);
      const recentHundred = transactions.slice(0, 100);
      const recentTwenty = transactions.slice(0, 20);
      setMetrics({
        transactionsPerSecond: Number((recentTen.length / 10).toFixed(1)),
        fraudRate: recentHundred.length ? (recentHundred.filter((item) => (item.fraudScore || 0) >= 70).length / recentHundred.length) * 100 : 0,
        avgResponseMs: recentTwenty.length ? Math.round(recentTwenty.reduce((sum, item) => sum + (item.responseTimeMs || 0), 0) / recentTwenty.length) : 0,
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [setMetrics, transactions]);

  const activeAlerts = useMemo(() => {
    return transactions
      .filter((item) => (item.fraudScore || 0) >= 70)
      .slice(0, 10)
      .map((item) => ({
        alertId: item.alertId || item.txId,
        txId: item.txId,
        severity: item.riskLevel || ((item.fraudScore || 0) >= 90 ? "CRITICAL" : "HIGH"),
        decision: item.decision,
        fraudScore: (item.fraudScore || 0) / 100,
        amlScore: item.amlScore || 0,
        amount: item.amount || 0,
      }));
  }, [transactions]);

  const latestAlert = useMemo(() => activeAlerts[0] || null, [activeAlerts]);

  const startReviewFlow = async () => {
    setReviewFlowRunning(true);
    try {
      for (const step of reviewFlowSteps) {
        const result = await submitTransaction({
          amount: step.amount,
          currency: "INR",
          merchant: step.merchant,
          merchantName: step.merchant,
          country: "IN",
          paymentMethod: step.paymentMethod,
          memo: step.memo,
          userEmail: "amoghrules20@gmail.com",
          userName: "Amogh",
          behavioralData: step.merchant === "Swiggy" ? { typingCadenceDeviation: 0.1, touchPressure: 0.7, copyPasteRatio: 0.02 } : { typingCadenceDeviation: 0.8, touchPressure: 0.2, copyPasteRatio: 0.7 },
        });
        setSelectedTransaction(result);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } finally {
      setReviewFlowRunning(false);
    }
  };

  return (
    <div style={{ background: "#0a0d14", minHeight: "100vh", fontFamily: "'JetBrains Mono', monospace", overflow: "hidden" }}>
      <Navbar onStartReviewFlow={startReviewFlow} reviewFlowRunning={reviewFlowRunning} wsConnected={wsConnected} gmailConnected={gmailConnected} statusText={`${transactions.length.toLocaleString()} transactions screened`} actionLabel="Launch Review Flow" />
      <div style={{ padding: 16, display: "grid", gap: 12, overflow: "hidden" }}>
        <MetricsBar metrics={metrics} />

        <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: 12 }}>
          <div style={{ display: "grid", gap: 12, gridTemplateRows: "1fr 1fr" }}>
            <FraudScoreGauge score={score} decision={decision} riskLevel={riskLevel} transaction={selectedTransaction} />
            <AlertPanel alerts={activeAlerts} />
          </div>
          <div style={{ maxHeight: 420, overflow: "hidden" }}>
            <TransactionFeed transactions={transactions} onSelect={setSelectedTransaction} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <PaymentForm />
          <LiveEmailMonitor />
          <LiveSMSFeed />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 12 }}>
          <NetworkGraph transactions={transactions} selectedTransaction={selectedTransaction} />
          <ExplainabilityPanel transaction={selectedTransaction} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <RiskHeatmap transactions={transactions} />
          <AMLSuspiciousFlow transaction={selectedTransaction} />
        </div>

        <div style={{ display: "none" }}>
          <SARReport alert={latestAlert} />
          <ComplianceDashboard compliance={compliance} />
        </div>
      </div>
      <AlertNotificationToast />
    </div>
  );
}

function ObservabilityWorkspace() {
  const gmailConnected = useFraudStore((state) => state.gmailConnected);
  const wsConnected = useFraudStore((state) => state.wsConnected);
  const runObservabilityDemo = () => {
    window.dispatchEvent(new CustomEvent("payshield:run-demo", { detail: { failureType: "ml_engine_latency" } }));
  };

  return (
    <div style={{ background: "#0a0d14", minHeight: "100vh", fontFamily: "'JetBrains Mono', monospace" }}>
      <Navbar
        onStartReviewFlow={runObservabilityDemo}
        reviewFlowRunning={false}
        wsConnected={wsConnected}
        gmailConnected={gmailConnected}
        statusText="6 services monitored"
        actionLabel="Run RCA Demo"
      />
      <ObservabilityDashboard />
    </div>
  );
}

export default function App() {
  useWebSocket();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FraudWorkspace />} />
        <Route path="/observability" element={<ObservabilityWorkspace />} />
      </Routes>
    </BrowserRouter>
  );
}
