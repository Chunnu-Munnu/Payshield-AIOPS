// FILE: logger.js
// ROLE: Structured JSON logging with active trace context propagation
// INSPIRED BY: Production-grade fintech log pipelines for Loki ingestion
// PERFORMANCE TARGET: Log emission under 2ms with trace metadata enrichment

const pino = require("pino");
const { trace } = require("@opentelemetry/api");

function currentSpanContext() {
  const span = trace.getActiveSpan();
  const spanContext = span?.spanContext?.();
  return {
    traceId: spanContext?.traceId || null,
    spanId: spanContext?.spanId || null,
  };
}

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  messageKey: "message",
  timestamp: pino.stdTimeFunctions.isoTime,
  base: null,
  mixin() {
    return {
      service: "payshield-backend",
      ...currentSpanContext(),
    };
  },
});

function toMessage(args) {
  return args.map((value) => {
    if (value instanceof Error) return { error: value.message, stack: value.stack };
    return value;
  });
}

if (!global.__PAYSHIELD_BACKEND_CONSOLE_PATCHED__) {
  const map = {
    log: "info",
    info: "info",
    warn: "warn",
    error: "error",
    debug: "debug",
  };
  Object.entries(map).forEach(([method, level]) => {
    const original = console[method];
    console[method] = (...args) => {
      try {
        logger[level]({ context: toMessage(args) }, typeof args[0] === "string" ? args[0] : method);
      } catch (_error) {
        original.apply(console, args);
      }
    };
  });
  global.__PAYSHIELD_BACKEND_CONSOLE_PATCHED__ = true;
}

module.exports = { logger, currentSpanContext };
