// FILE: alertMailer.js
// ROLE: Send real-time HTML fraud alert emails to amoghrules20@gmail.com
// INSPIRED BY: JP Morgan Chase real-time client fraud notification
// PERFORMANCE TARGET: Email dispatched < 500ms, completely non-blocking

const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");

const smtpConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
const smtpFlag = (process.env.ENABLE_SMTP_ALERTS || "auto").toLowerCase();
const smtpEnabled = smtpFlag === "true" || (smtpFlag === "auto" && smtpConfigured);
const alertCooldownMs = Number(process.env.ALERT_EMAIL_COOLDOWN_MS || "180000");
const lastAlertSentAt = new Map();

const transporter = smtpEnabled && smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

if (transporter) {
  transporter.verify((err) => {
    if (err) console.error("[Email] SMTP connection failed:", err.message);
    else console.log("[Email] SMTP connected - fraud alerts ready to send");
  });
} else {
  console.log("[Email] SMTP alerts disabled for demo runtime");
}

function generateDisputeToken(txId, userId) {
  return jwt.sign(
    { txId, userId, action: "dispute" },
    process.env.JWT_SECRET || "payshield-jwt",
    { expiresIn: "24h" }
  );
}

async function sendFraudAlert(payload) {
  const {
    userEmail,
    userName,
    txId,
    txAmount,
    txCurrency = "INR",
    merchant,
    timestamp,
    fraudScore,
    decision,
    riskLevel = "HIGH",
    topReasons = [],
    blockchainTxHash,
    disputeToken,
  } = payload;

  if (!userEmail || !transporter) return;

  const cooldownKey = `${String(userEmail).toLowerCase()}:${String(decision || "alert").toLowerCase()}`;
  const lastSentAt = lastAlertSentAt.get(cooldownKey) || 0;
  if ((Date.now() - lastSentAt) < alertCooldownMs) {
    console.log(`[Email] Skipping alert to ${userEmail} due to cooldown window`);
    return;
  }

  const subjects = {
    block: `PayShield: Transaction BLOCKED — ${txId}`,
    quarantine: `PayShield: Transaction Under Review — ${txId}`,
    step_up_auth: `PayShield: Verify Your Transaction — ${txId}`,
  };
  const subject = subjects[decision] || `PayShield: Suspicious Activity — ${txId}`;
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3001";
  const dc = decision === "block" ? "#ef4444" : decision === "quarantine" ? "#f59e0b" : "#38bdf8";
  const dlabel = { block: "BLOCKED", quarantine: "UNDER REVIEW", step_up_auth: "2FA REQUIRED" }[decision] || String(decision || "ALERT").toUpperCase();
  const fmtAmount = `${txCurrency} ${parseFloat(txAmount || 0).toLocaleString("en-IN")}`;
  const fmtTime = new Date(timestamp).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" });
  const reasonsHTML = topReasons.map((r) => `<li style="margin:5px 0;color:#94a3b8;font-size:13px;">• ${r}</li>`).join("");

  const html = `<!DOCTYPE html><html><body style="background:#0a0d14;margin:0;padding:20px;font-family:'Courier New',monospace;">
<div style="max-width:560px;margin:0 auto;background:#111827;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
  <div style="background:#0d1117;padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
    <div style="font-size:18px;font-weight:700;color:#38bdf8;letter-spacing:0.1em;">PAYSHIELD AI</div>
    <div style="font-size:11px;color:#475569;margin-top:2px;">AUTONOMOUS FRAUD INTELLIGENCE NETWORK</div>
  </div>
  <div style="background:${dc}18;border-left:4px solid ${dc};padding:16px 24px;margin:16px;border-radius:8px;">
    <div style="font-size:14px;font-weight:700;color:${dc};letter-spacing:0.1em;">${dlabel}</div>
    <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Hello ${userName}, a transaction requires your immediate attention.</div>
  </div>
  <div style="background:rgba(255,255,255,0.02);border-radius:10px;margin:0 16px;padding:16px;border:1px solid rgba(255,255,255,0.06);">
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:6px 0;font-size:11px;color:#475569;letter-spacing:0.08em;">TRANSACTION ID</td><td style="padding:6px 0;font-size:11px;color:#f1f5f9;text-align:right;">${txId}</td></tr>
      <tr><td style="padding:6px 0;font-size:11px;color:#475569;">AMOUNT</td><td style="padding:6px 0;font-size:15px;font-weight:700;color:#f1f5f9;text-align:right;">${fmtAmount}</td></tr>
      <tr><td style="padding:6px 0;font-size:11px;color:#475569;">MERCHANT</td><td style="padding:6px 0;font-size:12px;color:#f1f5f9;text-align:right;">${merchant}</td></tr>
      <tr><td style="padding:6px 0;font-size:11px;color:#475569;">DATE & TIME</td><td style="padding:6px 0;font-size:11px;color:#94a3b8;text-align:right;">${fmtTime}</td></tr>
      <tr><td style="padding:6px 0;font-size:11px;color:#475569;">FRAUD SCORE</td><td style="padding:6px 0;font-size:15px;font-weight:700;color:${dc};text-align:right;">${fraudScore}/100</td></tr>
      <tr><td style="padding:6px 0;font-size:11px;color:#475569;">RISK LEVEL</td><td style="padding:6px 0;font-size:11px;color:${dc};text-align:right;letter-spacing:0.08em;">${riskLevel}</td></tr>
    </table>
  </div>
  ${topReasons.length > 0 ? `<div style="margin:12px 16px;padding:14px;background:rgba(239,68,68,0.06);border-radius:10px;border:1px solid rgba(239,68,68,0.15);"><div style="font-size:10px;color:#475569;letter-spacing:0.08em;margin-bottom:8px;">WHY THIS WAS FLAGGED</div><ul style="margin:0;padding:0;list-style:none;">${reasonsHTML}</ul></div>` : ""}
  <div style="margin:0 16px;padding:12px;background:rgba(56,189,248,0.04);border-radius:8px;border:1px solid rgba(56,189,248,0.1);">
    <div style="font-size:10px;color:#334155;letter-spacing:0.06em;">⛓ BLOCKCHAIN AUDIT PROOF</div>
    <div style="font-size:10px;color:#475569;margin-top:3px;word-break:break-all;">${blockchainTxHash || "Logging to chain..."}</div>
  </div>
  <div style="padding:16px;display:flex;gap:10px;">
    <a href="${baseUrl}/api/alerts/confirm?token=${disputeToken}" style="flex:1;display:block;text-align:center;padding:12px;background:#22d3ee18;border:1px solid #22d3ee44;border-radius:10px;color:#22d3ee;font-size:11px;font-weight:700;text-decoration:none;letter-spacing:0.08em;">✓ THIS WAS ME</a>
    <a href="${baseUrl}/api/alerts/dispute?token=${disputeToken}" style="flex:1;display:block;text-align:center;padding:12px;background:#ef444418;border:1px solid #ef444444;border-radius:10px;color:#ef4444;font-size:11px;font-weight:700;text-decoration:none;letter-spacing:0.08em;">✗ DISPUTE NOW</a>
  </div>
  <div style="padding:14px 16px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
    <div style="font-size:10px;color:#334155;">PayShield AI Security | 6-Model Fraud Intelligence Network</div>
    <div style="font-size:9px;color:#1e293b;margin-top:3px;">Automated security alert. Do not reply.</div>
  </div>
</div></body></html>`;

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || "PayShield AI"}" <${process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER}>`,
      to: userEmail,
      subject,
      html,
    });
    lastAlertSentAt.set(cooldownKey, Date.now());
    console.log(`[Email] ✓ Fraud alert sent to ${userEmail} | MessageID: ${info.messageId}`);
  } catch (err) {
    console.error("[Email] Send failed:", err.message);
  }
}

module.exports = { sendFraudAlert, generateDisputeToken };
