// FILE: email.js
// ROLE: Gmail monitor status + test BEC email endpoint
// INSPIRED BY: JP Morgan email payment instruction fraud workflows
// PERFORMANCE TARGET: < 100ms status response

const express = require("express");
const nodemailer = require("nodemailer");
const axios = require("axios");
const gmailMonitor = require("../services/gmailMonitor");

const router = express.Router();

router.get("/status", (_req, res) => {
  res.json(gmailMonitor.getStatus());
});

router.post("/test-bec", async (req, res) => {
  const scenario = req.body.scenario || "standard";
  const scenarios = {
    standard: {
      subject: "URGENT: Vendor Payment Account Update Required",
      body: `Dear Finance Team,

Our banking details have changed effective immediately. Please update your records before processing the next payment.

New Account Details:
Bank: Deutsche Bank
IBAN: DE89 3704 0044 0532 0130 00
BIC/SWIFT: DEUTDEDB

IMPORTANT: Do not call to verify these details. This change has been approved by our CFO and must be processed today.

This communication is strictly confidential.

Best regards,
Rajesh Kumar
Chief Financial Officer`,
    },
    ceo_fraud: {
      subject: "Confidential — CEO Wire Transfer Request",
      body: `This is urgent and confidential.

I need you to process a wire transfer of ₹15,00,000 to a new vendor account immediately. This is time-sensitive and has board approval.

Account: Unknown Vendor Pvt Ltd
IFSC: HDFC0001234
Account: 50100123456789

Do not discuss this with anyone. Process before end of day. I am in a meeting and cannot be reached by phone.

- CEO`,
    },
    invoice_scam: {
      subject: "Updated Invoice — Please Process Payment ASAP",
      body: `Please find the updated payment details for Invoice #INV-2025-0847.

We have recently changed our banking partner. All payments must now be directed to:
New Bank: ICICI Bank
Account: 123456789012
IFSC: ICIC0001234

The old account is no longer active. Payment is overdue — please process by today.

Note: Our accounts team is unavailable by phone. Email only for the next 48 hours.`,
    },
  };
  const selected = scenarios[scenario] || scenarios.standard;

  try {
    const smtpConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS && process.env.GMAIL_USER);
    if (!smtpConfigured) {
      const response = await axios.post(
        `http://localhost:${process.env.PORT || 3001}/api/transactions/submit`,
        {
          txId: `EMAIL-DEMO-${Date.now()}`,
          amount: scenario === "ceo_fraud" ? 1500000 : 49500,
          currency: "INR",
          merchant: "Email Payment Instruction",
          merchantName: "Email Payment Instruction",
          country: "IN",
          paymentMethod: "EMAIL_SCAN",
          memo: `${selected.subject}\n\n${selected.body}`,
          timestamp: new Date().toISOString(),
          userEmail: process.env.DEMO_USER_EMAIL || "demo@payshield.ai",
          userName: "Demo Email Monitor",
          isEmailScan: true,
          suppressEmailAlerts: true,
          emailSubject: selected.subject,
          emailFrom: "simulated-bec@payshield.ai",
        },
        { timeout: 15000 },
      );
      return res.json({
        status: "simulated",
        scenario,
        subject: selected.subject,
        message: "SMTP is disabled in demo mode, so the BEC email was injected directly into the fraud pipeline.",
        result: response.data,
      });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"Test Sender" <${process.env.SMTP_USER}>`,
      to: process.env.GMAIL_USER,
      subject: selected.subject,
      text: selected.body,
    });
    console.log(`[Email] Test BEC email sent (${scenario}) — Gmail monitor will detect within 30s`);
    res.json({
      status: "sent",
      scenario,
      to: process.env.GMAIL_USER,
      subject: selected.subject,
      message: "BEC test email sent. PayShield Gmail monitor will detect it within 30 seconds.",
      watchDashboard: true,
    });
  } catch (error) {
    console.error("[Email] Test BEC send failed:", error.message);
    res.status(500).json({ error: error.message, hint: "Check SMTP credentials in .env" });
  }
});

module.exports = router;
