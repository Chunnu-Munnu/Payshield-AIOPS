// FILE: sarGenerator.js
// ROLE: Generate FinCEN-style suspicious activity reports
// INSPIRED BY: FinCEN SAR schema and AML casework
// PERFORMANCE TARGET: Report generation under 10ms
const { v4: uuidv4 } = require("uuid");

function buildSar(alert, transaction) {
  const caseId = `SAR-${uuidv4().slice(0, 8).toUpperCase()}`;
  const indicators = [
    transaction.circularFlowDetected ? "circular_flow" : null,
    transaction.sharedDeviceCount > 3 ? "fan_out" : null,
    alert.detectedPattern || null,
  ].filter(Boolean);
  return {
    caseId,
    filingInstitution: "PayShield Demo Bank",
    generatedAt: new Date().toISOString(),
    subject: {
      userId: transaction.userId,
      email: transaction.userEmail,
      riskLevel: alert.severity,
    },
    suspiciousActivity: {
      description: alert.explanation?.naturalLanguageExplanation || "Automated fraud risk exceeded AML threshold.",
      indicators,
      transactionSummary: {
        txId: transaction.txId,
        amount: transaction.amount,
        merchant: transaction.merchantName,
        timestamp: transaction.timestamp,
      },
    },
    blockchainReference: alert.blockchainTxHash || null,
    html: `<html><body><h1>${caseId}</h1><p>${transaction.txId} flagged for ${indicators.join(", ") || "anomalous activity"}.</p></body></html>`,
  };
}

module.exports = { buildSar };
