// FILE: gmailMonitor.js
// ROLE: Real-time Gmail IMAP monitor with controlled ingestion
// INSPIRED BY: Payment-instruction risk monitoring
// PERFORMANCE TARGET: New email scored within 35 seconds without startup flood

const Imap = require("imap");
const { simpleParser } = require("mailparser");
const axios = require("axios");
const { trace } = require("@opentelemetry/api");

const telemetry = require("./telemetry");
const { logger } = require("./logger");

let imapConnection = null;
let isConnected = false;
let broadcastFn = null;
let emailCount = 0;
let becCount = 0;
let reconnectTimer = null;
let inboxReady = false;

const initialUnseenUids = new Set();
const processedUids = new Set();
const tracer = trace.getTracer("payshield-backend");

function setBroadcast(fn) {
  broadcastFn = fn;
}

function startGmailMonitor() {
  const user = process.env.GMAIL_USER;
  const password = process.env.GMAIL_APP_PASSWORD;
  if (!user || !password) {
    logger.info("gmail_monitor_disabled_missing_credentials");
    return;
  }

  logger.info({ user: maskEmail(user) }, "gmail_monitor_starting");
  imapConnection = new Imap({
    user,
    password,
    host: "imap.gmail.com",
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    keepalive: { interval: 10000, idleInterval: 300000, forceNoop: true },
  });

  imapConnection.once("ready", () => {
    isConnected = true;
    inboxReady = false;
    logger.info({ user: maskEmail(user) }, "gmail_monitor_connected");
    if (broadcastFn) {
      broadcastFn({
        type: "GMAIL_MONITOR_STATUS",
        status: "CONNECTED",
        email: maskEmail(user),
        timestamp: new Date().toISOString(),
      });
    }
    openInbox();
  });

  imapConnection.on("mail", (numNew) => {
    logger.info({ numNew }, "gmail_monitor_new_mail");
    fetchUnseenEmails();
  });

  imapConnection.once("error", (err) => {
    logger.error({ error: err.message }, "gmail_monitor_error");
    isConnected = false;
    inboxReady = false;
    if (broadcastFn) {
      broadcastFn({ type: "GMAIL_MONITOR_STATUS", status: "ERROR", error: err.message });
    }
    scheduleReconnect();
  });

  imapConnection.once("end", () => {
    logger.warn("gmail_monitor_connection_ended");
    isConnected = false;
    inboxReady = false;
    scheduleReconnect();
  });

  imapConnection.connect();
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(startGmailMonitor, 30000);
}

function openInbox() {
  imapConnection.openBox("INBOX", false, (err, box) => {
    if (err) {
      logger.error({ error: err.message }, "gmail_monitor_open_inbox_failed");
      return;
    }
    inboxReady = true;
    initialUnseenUids.clear();
    processedUids.clear();
    logger.info({ totalMessages: box.messages.total }, "gmail_monitor_inbox_ready");

    // Baseline existing unseen emails so startup does not flood the stream.
    imapConnection.search(["UNSEEN"], (searchErr, results) => {
      if (!searchErr && Array.isArray(results)) {
        for (const uid of results) initialUnseenUids.add(uid);
      }
    });
  });
}

function fetchUnseenEmails() {
  if (!imapConnection || !inboxReady) return;
  imapConnection.search(["UNSEEN"], (err, results) => {
    if (err || !results || results.length === 0) return;

    const newUids = results.filter((uid) => !initialUnseenUids.has(uid) && !processedUids.has(uid));
    if (newUids.length === 0) return;

    const fetcher = imapConnection.fetch(newUids, { bodies: "", markSeen: true });
    fetcher.on("message", (msg) => {
      let uid = null;
      msg.on("attributes", (attrs) => {
        uid = attrs.uid;
      });
      msg.on("body", (stream) => {
        simpleParser(stream, async (parseErr, parsed) => {
          if (parseErr) return;
          if (uid) processedUids.add(uid);

          const from = parsed.from?.text || "Unknown Sender";
          const subject = parsed.subject || "(no subject)";
          const textBody = parsed.text || "";
          const fullText = `${subject} ${textBody}`.trim();
          const timestamp = new Date().toISOString();
          emailCount += 1;
          const scanSpan = tracer.startSpan("email_scan", {
            attributes: {
              from: maskEmail(from),
              subject: subject.slice(0, 100),
            },
          });

          if (broadcastFn) {
            broadcastFn({
              type: "GMAIL_EMAIL_RECEIVED",
              from: maskEmail(from),
              subject: subject.slice(0, 100),
              preview: textBody.slice(0, 150),
              timestamp,
              emailNum: emailCount,
            });
          }

          try {
            const response = await axios.post(
              `http://localhost:${process.env.PORT || 3001}/api/transactions/submit`,
              {
                txId: `EMAIL-${Date.now()}-${emailCount}`,
                amount: 0,
                currency: "INR",
                merchant: from.slice(0, 60),
                merchantName: from.slice(0, 60),
                country: "IN",
                paymentMethod: "EMAIL_SCAN",
                memo: fullText,
                timestamp,
                userEmail: process.env.DEMO_USER_EMAIL,
                userName: "Gmail Monitor",
                isEmailScan: true,
                suppressEmailAlerts: true,
                emailSubject: subject,
                emailFrom: from,
              },
              { timeout: 15000 },
            );

            const result = response.data;
            if ((result.becScore || 0) >= 0.68 || result.fraudScore >= 70) {
              becCount += 1;
              telemetry.payshieldEmailBecDetectionsTotal.inc();
            }
            logger.info({
              from: maskEmail(from),
              subject: subject.slice(0, 100),
              txId: result.txId,
              fraudScore: result.fraudScore,
              becScore: result.becScore || 0,
              decision: result.decision,
            }, "gmail_email_scored");
            scanSpan.setAttributes({
              txId: result.txId,
              fraudScore: result.fraudScore,
              becScore: result.becScore || 0,
              decision: result.decision,
            });

            if (broadcastFn) {
              broadcastFn({
                type: "GMAIL_EMAIL_SCORED",
                from: maskEmail(from),
                subject: subject.slice(0, 100),
                fraudScore: result.fraudScore,
                becScore: result.becScore || 0,
                decision: result.decision,
                flaggedPhrases: (result.explanation?.topFeatures || [])
                  .filter((feature) => feature.shap_value > 0)
                  .slice(0, 3)
                  .map((feature) => feature.humanReadable),
                timestamp,
                emailCount,
                becCount,
                isLive: true,
              });
            }
          } catch (scoreErr) {
            scanSpan.recordException(scoreErr);
            logger.error({ from: maskEmail(from), error: scoreErr.message }, "gmail_email_scoring_failed");
          } finally {
            scanSpan.end();
          }
        });
      });
    });

    fetcher.once("error", (fetchErr) => logger.error({ error: fetchErr.message }, "gmail_fetch_failed"));
  });
}

function maskEmail(email) {
  const match = email.match(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (!match) return `${String(email).slice(0, 4)}***`;
  return `${match[1].slice(0, 2)}***@${match[2]}`;
}

function getStatus() {
  return {
    connected: isConnected,
    email: process.env.GMAIL_USER ? maskEmail(process.env.GMAIL_USER) : null,
    emailCount,
    becCount,
  };
}

module.exports = { startGmailMonitor, setBroadcast, getStatus };
