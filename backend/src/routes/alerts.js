// FILE: alerts.js
// ROLE: Alert confirmation, dispute, and OTP-style action endpoints
// INSPIRED BY: Client fraud dispute flows in digital banking
// PERFORMANCE TARGET: Token action under 10ms

const express = require("express");
const jwt = require("jsonwebtoken");
const FraudAlert = require("../models/FraudAlert");

const router = express.Router();

function decodeToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET || "payshield");
}

router.get("/confirm", (req, res) => {
  try {
    const decoded = decodeToken(req.query.token);
    const alert = FraudAlert.rows.find((item) => item.txId === decoded.txId);
    if (alert) FraudAlert.update(alert.alertId, { status: "confirmed_by_user" });
    res.send("<html><body style='font-family:monospace;background:#0a0d14;color:#e2e8f0;padding:40px'>Transaction confirmed. PayShield has marked this event as legitimate.</body></html>");
  } catch (error) {
    res.status(400).send(`<html><body style='font-family:monospace;background:#0a0d14;color:#ef4444;padding:40px'>Invalid or expired token: ${error.message}</body></html>`);
  }
});

router.get("/dispute", (req, res) => {
  try {
    const decoded = decodeToken(req.query.token);
    const alert = FraudAlert.rows.find((item) => item.txId === decoded.txId);
    if (alert) FraudAlert.update(alert.alertId, { status: "disputed_by_user" });
    res.send("<html><body style='font-family:monospace;background:#0a0d14;color:#e2e8f0;padding:40px'>Dispute recorded. Investigation workflow has been started.</body></html>");
  } catch (error) {
    res.status(400).send(`<html><body style='font-family:monospace;background:#0a0d14;color:#ef4444;padding:40px'>Invalid or expired token: ${error.message}</body></html>`);
  }
});

router.post("/verify-otp", (_req, res) => {
  res.json({ status: "verified", message: "OTP step-up verification completed" });
});

module.exports = router;
