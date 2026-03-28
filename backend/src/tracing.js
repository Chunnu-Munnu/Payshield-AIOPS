// FILE: tracing.js
// ROLE: Initialize OpenTelemetry tracing for the backend before app bootstrap
// INSPIRED BY: Production Node.js distributed tracing in service meshes
// PERFORMANCE TARGET: Tracer setup under 250ms without blocking boot

const { NodeSDK } = require("@opentelemetry/sdk-node");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-grpc");
const { Resource } = require("@opentelemetry/resources");
const { SemanticResourceAttributes } = require("@opentelemetry/semantic-conventions");

if (!global.__PAYSHIELD_BACKEND_TRACING__) {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4317";
  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: endpoint }),
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: "payshield-backend",
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  try {
    const startResult = sdk.start();
    if (startResult && typeof startResult.catch === "function") {
      startResult.catch((error) => {
        process.stderr.write(`[tracing] failed to start backend tracer: ${error.message}\n`);
      });
    }
  } catch (error) {
    process.stderr.write(`[tracing] failed to start backend tracer: ${error.message}\n`);
  }

  const shutdown = async () => {
    try {
      await sdk.shutdown();
    } catch (_error) {
    }
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  global.__PAYSHIELD_BACKEND_TRACING__ = sdk;
}
