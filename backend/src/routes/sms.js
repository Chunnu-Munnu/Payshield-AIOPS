// FILE: sms.js
// ROLE: Receive real Indian bank SMS alerts via SMS Forwarder Android app
// INSPIRED BY: Real-time UPI transaction monitoring for Indian banks
// PERFORMANCE TARGET: SMS parsed and scored < 500ms

const express = require("express");
const axios = require("axios");
const { trace } = require("@opentelemetry/api");

const smsParser = require("../services/smsParser");
const telemetry = require("../services/telemetry");
const { logger } = require("../services/logger");
const { broadcastToClients } = require("../server");

const router = express.Router();
let testIndex = 0;
const tracer = trace.getTracer("payshield-backend");

router.post("/incoming", async (req, res) => {
  const { from, body, date } = req.body;
  if (!body) return res.json({ status: "ignored", reason: "empty body" });
  const parseSpan = tracer.startSpan("sms_parse", {
    attributes: { sender: from || "unknown" },
  });
  logger.info({ from, preview: body.slice(0, 120) }, "sms_received");
  const parsed = smsParser.parseIndianBankSMS(body, from);
  parseSpan.setAttributes({
    isPaymentSMS: parsed.isPaymentSMS,
    bankName: parsed.bankName || from || "unknown",
  });
  parseSpan.end();
  if (!parsed.isPaymentSMS) return res.json({ status: "ignored", reason: "not a payment SMS", parsed });
  telemetry.payshieldSmsParsedTotal.labels(parsed.bankName || from || "unknown").inc();

  const smsEventId = `sms-${Date.now()}`;

  try {
    const result = await axios.post(`http://localhost:${process.env.PORT || 3001}/api/transactions/submit`, {
      txId: `SMS-${Date.now()}`,
      amount: parsed.amount,
      currency: "INR",
      merchant: parsed.merchant || parsed.description || "Bank Transfer",
      merchantName: parsed.merchant || "Bank Transfer",
      country: "IN",
      paymentMethod: parsed.paymentMethod || "UPI",
      memo: body,
      timestamp: date || new Date().toISOString(),
      upiId: parsed.upiId || null,
      utrNumber: parsed.utrNumber || null,
      isSMSTransaction: true,
      userEmail: process.env.DEMO_USER_EMAIL,
      userName: "SMS User",
    }, { timeout: 10000 });

    broadcastToClients({
      type: "LIVE_SMS_SCORED",
      eventId: smsEventId,
      from,
      raw: body,
      parsed,
      result: result.data,
      timestamp: new Date().toISOString(),
    });

    logger.info({
      eventId: smsEventId,
      txId: result.data.txId,
      bankName: parsed.bankName,
      fraudScore: result.data.fraudScore,
      decision: result.data.decision,
    }, "sms_scored");
    return res.json({ status: "scored", parsed, result: result.data });
  } catch (error) {
    logger.error({ from, error: error.message }, "sms_scoring_failed");
    return res.status(500).json({ error: error.message });
  }
});

router.post("/test", async (req, res) => {
  const testSMSOptions = [
    "INR 2000.00 debited from A/c XX1234 on 23-03-26 to VPA swiggy@ybl. UPI Ref 412345678901. If not done by you call 1800.",
    "Rs.49500.00 debited from Ac XXXXXX1234 on 23/03/26. Info: NEFT to Unknown Vendor. UTR:HDFC2534XXXXXX.",
    "INR 15000.00 debited from A/c XX7788 on 23-03-26 to VPA newpayee4821@okhdfcbank. UPI Ref 712345678901. URGENT vendor account update.",
    "INR 8500.00 debited from A/c XX9999 on 23-03-26 to VPA shellmerchants@ibl. UPI Ref 812345678901.",
  ];
  const sms = req.body.sms || testSMSOptions[testIndex % testSMSOptions.length];
  testIndex += 1;
  const result = await axios.post(`http://localhost:${process.env.PORT || 3001}/api/sms/incoming`, { from: "HDFCBK", body: sms, date: new Date().toISOString() });
  res.json(result.data);
});

module.exports = router;
