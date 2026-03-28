// FILE: server.js
// ROLE: Express API gateway with tracing, metrics, structured logs, fallback control, and realtime broadcasts
// INSPIRED BY: Production fintech gateways with embedded observability
// PERFORMANCE TARGET: Core request overhead below 15ms excluding business logic

require("./tracing");
require("dotenv").config();

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const axios = require("axios");
const { trace } = require("@opentelemetry/api");

const { logger } = require("./services/logger");
const telemetry = require("./services/telemetry");
const runtimeState = require("./services/runtimeState");
const observabilityLedger = require("./services/observabilityLedger");
const redisCache = require("./services/redisCache");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const clients = new Set();
const tracer = trace.getTracer("payshield-backend");

function websocketMetricsSync() {
  telemetry.payshieldWebsocketConnectionsActive.set(clients.size);
}

function refreshRuntimeMetrics() {
  telemetry.payshieldRuntimeFallbackActive.set(runtimeState.isFallbackActive() ? 1 : 0);
  const cacheStatus = redisCache.status();
  telemetry.payshieldCacheFallbackActive.set(cacheStatus.mode === "memory_fallback" ? 1 : 0);
}

wss.on("connection", (ws) => {
  clients.add(ws);
  websocketMetricsSync();
  logger.info({ clients: clients.size }, "websocket_connected");
  ws.send(JSON.stringify({ type: "CONNECTED", message: "PayShield AI connected", timestamp: new Date().toISOString() }));
  ws.on("close", () => {
    clients.delete(ws);
    websocketMetricsSync();
    logger.info({ clients: clients.size }, "websocket_disconnected");
  });
  ws.on("error", (error) => {
    clients.delete(ws);
    websocketMetricsSync();
    logger.warn({ error: error.message }, "websocket_error");
  });
});

function broadcastToClients(data) {
  const span = tracer.startSpan("websocket_broadcast");
  const payload = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch (error) {
        logger.warn({ error: error.message }, "websocket_broadcast_failed");
        clients.delete(client);
      }
    }
  }
  websocketMetricsSync();
  span.end();
}

module.exports.broadcastToClients = broadcastToClients;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: "*" }));
app.use(rateLimit({ windowMs: 60_000, max: 1000, standardHeaders: true }));
app.use("/api/webhooks", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "10mb" }));

app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.route?.path || req.path || "unknown";
    telemetry.httpRequestDurationSeconds.labels(req.method, route, String(res.statusCode)).observe(durationSeconds);
    logger.info({ method: req.method, route, status: res.statusCode, duration_ms: Math.round(durationSeconds * 1000) }, "http_request_completed");
  });
  next();
});

app.use("/api/transactions", require("./routes/transactions"));
app.use("/api/fraud", require("./routes/fraud"));
app.use("/api/blockchain", require("./routes/blockchain"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/federated", require("./routes/federated"));
app.use("/api/alerts", require("./routes/alerts"));
app.use("/api/sms", require("./routes/sms"));
app.use("/api/email", require("./routes/email"));

app.get("/", (_req, res) => {
  res.json({
    service: "payshield-backend",
    status: "ok",
    health: "/health",
    metrics: "/metrics",
    routes: [
      "/api/transactions/submit",
      "/api/system/status",
      "/api/fallback/enable",
      "/api/fallback/disable",
    ],
  });
});

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", telemetry.register.contentType);
  res.end(await telemetry.register.metrics());
});

app.get("/health", (_req, res) => {
  const cacheStatus = redisCache.status();
  res.json({
    status: "ok",
    service: "payshield-backend",
    timestamp: new Date().toISOString(),
    clients: clients.size,
    fraudScoringMode: runtimeState.state.fraudScoringMode,
    cacheMode: cacheStatus.mode,
  });
});

app.post("/api/fallback/enable", async (req, res) => {
  runtimeState.setFraudScoringMode("fallback");
  const reason = req.body?.reason || "Fallback mode active - ML engine recovering";
  const txHash = await observabilityLedger.logFallbackActivated(reason);
  logger.warn({ reason, txHash }, "fallback_mode_enabled");
  broadcastToClients({ type: "FALLBACK_MODE_CHANGED", mode: "fallback", reason, txHash, timestamp: new Date().toISOString() });
  res.json({ status: "ok", fraudScoringMode: "fallback", txHash });
});

app.post("/api/fallback/disable", async (_req, res) => {
  const durationMs = runtimeState.clearFallback();
  const txHash = await observabilityLedger.logFallbackDeactivated(durationMs);
  logger.info({ durationMs, txHash }, "fallback_mode_disabled");
  broadcastToClients({ type: "FALLBACK_MODE_CHANGED", mode: "full_ensemble", durationMs, txHash, timestamp: new Date().toISOString() });
  res.json({ status: "ok", fraudScoringMode: "full_ensemble", durationMs, txHash });
});

app.get("/api/system/status", async (_req, res) => {
  const cacheStatus = redisCache.status();
  const [mlEngineHealthy, blockchainHealthy, observabilityBrainHealthy] = await Promise.all([
    axios.get(`${process.env.ML_SERVICE_URL || "http://localhost:8000"}/health`, { timeout: 3000 }).then(() => true).catch(() => false),
    fetch(process.env.BLOCKCHAIN_RPC_URL || "http://localhost:8545", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
    }).then((response) => response.ok).catch(() => false),
    axios.get(`${process.env.OBSERVABILITY_BRAIN_URL || "http://localhost:9000"}/health`, { timeout: 3000 }).then(() => true).catch(() => false),
  ]);

  res.json({
    fraudScoringMode: runtimeState.state.fraudScoringMode,
    fallbackActive: runtimeState.isFallbackActive(),
    fallbackDurationMs: runtimeState.isFallbackActive() ? runtimeState.getFallbackDurationMs() : 0,
    mlEngineHealthy,
    blockchainHealthy,
    redisHealthy: cacheStatus.redisAvailable,
    cacheMode: cacheStatus.mode,
    lastRemediationTimestamp: runtimeState.state.lastRemediationTimestamp,
    observabilityBrainHealthy,
  });
});

app.post("/api/system/remediation-mark", (req, res) => {
  const timestamp = req.body?.timestamp || new Date().toISOString();
  runtimeState.markRemediation(timestamp);
  logger.info({ timestamp }, "remediation_timestamp_marked");
  res.json({ status: "ok", timestamp });
});

app.post("/debug/error-burst", (req, res) => {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEBUG_ENDPOINTS !== "true") {
    return res.status(403).json({ error: "debug endpoints disabled" });
  }
  const durationMs = Number(req.body?.durationMs || 30000);
  runtimeState.triggerBackendErrorBurst(durationMs);
  logger.warn({ durationMs }, "backend_error_burst_enabled");
  return res.json({ status: "ok", durationMs });
});

app.post("/debug/cache-fallback", (req, res) => {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEBUG_ENDPOINTS !== "true") {
    return res.status(403).json({ error: "debug endpoints disabled" });
  }
  const durationMs = Number(req.body?.durationMs || 20000);
  redisCache.degrade(durationMs);
  refreshRuntimeMetrics();
  logger.warn({ durationMs }, "cache_fallback_forced");
  return res.json({ status: "ok", durationMs, cacheMode: redisCache.status().mode });
});

const gmailMonitor = require("./services/gmailMonitor");
gmailMonitor.setBroadcast(broadcastToClients);
gmailMonitor.startGmailMonitor();
setInterval(refreshRuntimeMetrics, 2000);
refreshRuntimeMetrics();

const PORT = Number(process.env.PORT || 3001);
server.listen(PORT, () => {
  logger.info({
    port: PORT,
    api: `http://localhost:${PORT}`,
    dashboard: "http://localhost:5173",
    observability: "http://localhost:9000",
    blockchain: process.env.BLOCKCHAIN_RPC_URL,
  }, "payshield_backend_started");
});
