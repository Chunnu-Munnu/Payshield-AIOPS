// FILE: fraud.js
// ROLE: Fraud alert views, actions, statistics, and simulation endpoints
// INSPIRED BY: Fraud operations command-center APIs
// PERFORMANCE TARGET: Stats endpoint under 5ms

const express = require("express");
const FraudAlert = require("../models/FraudAlert");
const Transaction = require("../models/Transaction");
const mlInference = require("../services/mlInference");
const blockchainLogger = require("../services/blockchainLogger");
const alertMailer = require("../services/alertMailer");

const router = express.Router();

router.get("/alerts", (req, res) => {
  res.json({ items: FraudAlert.list({ status: req.query.status, severity: req.query.severity }) });
});

router.post("/alerts/:alertId/action", (req, res) => {
  const action = req.body.action;
  const nextStatus = {
    approve_block: "closed",
    release: "released",
    escalate: "escalated",
    request_review: "reviewing",
  }[action] || "reviewing";
  const alert = FraudAlert.update(req.params.alertId, { status: nextStatus, analystAction: action });
  res.json({ alert });
});

router.get("/stats", (_req, res) => {
  const alerts = FraudAlert.rows;
  const totalFlagged24hr = alerts.length;
  const falsePositives = alerts.filter((item) => item.status === "released").length;
  const topAttackPatterns = [...new Set(alerts.map((item) => item.detectedPattern).filter(Boolean))].slice(0, 5);
  res.json({
    totalFlagged24hr,
    falsePositiveRate: totalFlagged24hr ? falsePositives / totalFlagged24hr : 0,
    avgResponseMs: 87,
    topAttackPatterns,
  });
});

router.post("/simulate", async (req, res) => {
  const pattern = req.body.pattern || "fraud_ring";
  const scenarioMap = {
    fraud_ring: { amount: Number(req.body.amount || 49500), merchant: "Unknown Vendor", memo: "Festival settlement transfer to mule cluster", deviceId: "shared-device-ring-01" },
    account_takeover: { amount: Number(req.body.amount || 8500), merchant: "Shell Merchants Pvt Ltd", memo: "SIM swap drain transfer", deviceId: "new-device-risk" },
    bec: { amount: Number(req.body.amount || 15000), merchant: "New Payee 4821", memo: "URGENT: update vendor IBAN immediately. Do not call to verify. Confidential.", deviceId: "registered-device-1" },
    micro_bot: { amount: Number(req.body.amount || 700), merchant: "Unknown Vendor", memo: "Warm-up micro transaction burst", deviceId: "bot-device-17" },
  };
  const scenario = scenarioMap[pattern] || scenarioMap.fraud_ring;
  const stored = Transaction.create({
    txId: `SIM-${Date.now()}`,
    userId: "sim-user",
    userEmail: process.env.DEMO_USER_EMAIL || "amoghrules20@gmail.com",
    userName: "Amogh",
    simulatedFraud: true,
    amount: scenario.amount,
    currency: "INR",
    merchant: scenario.merchant,
    merchantName: scenario.merchant,
    country: "IN",
    paymentMethod: pattern === "bec" ? "NEFT" : "UPI",
    timestamp: new Date().toISOString(),
    memo: scenario.memo,
    deviceId: scenario.deviceId,
    behavioralData: { typingCadenceDeviation: 0.92, touchPressure: 0.1, copyPasteRatio: 0.88 },
  });
  const result = await mlInference.scoreTransaction(stored);
  const blockchainResult = await blockchainLogger.registerAndLog(stored, result);
  const alert = FraudAlert.create({
    txId: stored.txId,
    severity: result.fraudScore >= 90 ? "CRITICAL" : "HIGH",
    decision: result.decision,
    fraudScore: result.fraudScore / 100,
    amlScore: result.amlScore || 0,
    explanation: result.explanation,
    detectedPattern: result.detectedPattern || pattern,
    blockchainTxHash: blockchainResult.blockchainTxHash,
    userId: stored.userId,
    status: "open",
  });
  await alertMailer.sendFraudAlert({
    userEmail: stored.userEmail,
    userName: stored.userName,
    txId: stored.txId,
    txAmount: stored.amount,
    txCurrency: "INR",
    merchant: stored.merchantName,
    timestamp: stored.timestamp,
    fraudScore: result.fraudScore,
    decision: result.decision,
    riskLevel: result.fraudScore >= 90 ? "CRITICAL" : "HIGH",
    topReasons: (result.explanation?.topFeatures || []).slice(0, 3).map((item) => item.humanReadable),
    blockchainTxHash: blockchainResult.blockchainTxHash || "pending",
    disputeToken: alertMailer.generateDisputeToken(stored.txId, stored.userId),
  }).catch(() => {});
  res.json({ pattern, transaction: stored, result, alert, blockchainResult });
});

module.exports = router;
