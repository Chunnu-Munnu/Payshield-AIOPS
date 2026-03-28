// FILE: telemetry.js
// ROLE: Prometheus metrics registry and helper utilities for backend observability
// INSPIRED BY: SRE-grade service instrumentation for latency, throughput, and failure modes
// PERFORMANCE TARGET: Metric updates under 1ms per call

const client = require("prom-client");

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: "payshield_backend_" });

const payshieldTransactionsTotal = new client.Counter({
  name: "payshield_transactions_total",
  help: "Total transactions processed by the backend",
  labelNames: ["status", "model_used"],
  registers: [register],
});

const payshieldFraudScoreHistogram = new client.Histogram({
  name: "payshield_fraud_score_histogram",
  help: "Normalized fraud score distribution from 0.0 to 1.0",
  buckets: Array.from({ length: 11 }, (_, index) => index / 10),
  registers: [register],
});

const payshieldMlEngineLatencySeconds = new client.Histogram({
  name: "payshield_ml_engine_latency_seconds",
  help: "Latency for calls made from backend to ML engine",
  labelNames: ["endpoint"],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  registers: [register],
});

const payshieldBlockchainWriteLatencySeconds = new client.Histogram({
  name: "payshield_blockchain_write_latency_seconds",
  help: "Latency of blockchain write operations",
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [register],
});

const payshieldWebsocketConnectionsActive = new client.Gauge({
  name: "payshield_websocket_connections_active",
  help: "Active WebSocket connections",
  registers: [register],
});

const payshieldEmailBecDetectionsTotal = new client.Counter({
  name: "payshield_email_bec_detections_total",
  help: "Total Gmail-driven BEC detections",
  registers: [register],
});

const payshieldSmsParsedTotal = new client.Counter({
  name: "payshield_sms_parsed_total",
  help: "Total SMS alerts parsed by bank",
  labelNames: ["bank"],
  registers: [register],
});

const payshieldRuntimeFallbackActive = new client.Gauge({
  name: "payshield_runtime_fallback_active",
  help: "Whether PayShield runtime fallback mode is currently active",
  registers: [register],
});

const payshieldCacheFallbackActive = new client.Gauge({
  name: "payshield_cache_fallback_active",
  help: "Whether backend cache operations are currently using in-memory fallback instead of Redis",
  registers: [register],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration",
  labelNames: ["method", "route", "status"],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10],
  registers: [register],
});

module.exports = {
  register,
  payshieldTransactionsTotal,
  payshieldFraudScoreHistogram,
  payshieldMlEngineLatencySeconds,
  payshieldBlockchainWriteLatencySeconds,
  payshieldWebsocketConnectionsActive,
  payshieldEmailBecDetectionsTotal,
  payshieldSmsParsedTotal,
  payshieldRuntimeFallbackActive,
  payshieldCacheFallbackActive,
  httpRequestDurationSeconds,
};
