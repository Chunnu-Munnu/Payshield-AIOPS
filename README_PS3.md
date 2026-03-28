# PayShield PS3

PayShield PS3 turns the existing PayShield fraud platform into a real-time AI observability and self-healing system. The fraud stack remains the live distributed workload. The new observability layer ingests logs, metrics, and traces from the running services, performs explainable root cause analysis with multiple ML models, and triggers automated remediation under a 15-second operational SLA target.

## Why PayShield is the custom stack

PayShield already behaves like a realistic distributed financial system:

- `payshield-frontend` renders the live payment and analyst experience.
- `payshield-backend` orchestrates transactions, alerts, WebSockets, Gmail, and SMS ingestion.
- `payshield-ml-engine` performs ensemble fraud scoring.
- `payshield-blockchain` provides immutable audit logging.
- `payshield-simulator` generates continuous k6 load.
- Redis and the observability stack complete the runtime dependencies.

That makes PayShield the patient. The Observability Brain is the doctor.

## What was built

- Docker Compose stack with Prometheus, Loki, Promtail, Jaeger, Grafana, and a new `observability-brain` service.
- Structured JSON logging for backend and ML engine with trace correlation metadata.
- Prometheus instrumentation for backend, ML engine, and observability-brain.
- OpenTelemetry tracing for backend and ML engine, exported to Jaeger.
- AI ensemble in the observability-brain:
  - DistilBERT log anomaly detector
  - BiLSTM metric degradation detector
  - correlation engine combining metric, log, and trace evidence
- Automated remediation engine using Docker SDK and fallback-mode controls.
- Blockchain evidence logging for anomalies, remediations, and fallback activation/deactivation.
- Frontend `/observability` dashboard with RCA panels, SLA meter, and failure injection controls.
- k6 load generator and Grafana dashboard provisioning.
- Additional self-healing cases for Redis cache degradation, frontend outage, and simulator/load-generator stoppage.

## 15-Second SLA

Target timing budget:

- Prometheus poll: 2s
- Loki poll: 2s
- Jaeger poll: 3s
- LSTM inference: under 50ms
- DistilBERT batch inference: under 200ms
- Correlation: under 50ms
- Remediation API + Docker restart trigger: under 500ms for initiation
- Health verification and recovery: under 8s target

The orchestrator emits `last_cycle_duration_ms`. A warning is logged above 12 seconds to preserve headroom before the 15-second deadline.

## Architecture

```text
                              +----------------------+
                              |   Observability UI   |
                              |  React /observability|
                              +----------+-----------+
                                         |
                                         v
+----------------+      +----------------+----------------+      +-------------------+
| payshield-k6   | ---> |        payshield-backend        | ---> | payshield-blockchain |
| real load      |      | tx intake, alerts, WebSocket    |      | audit & evidence   |
+----------------+      +----------------+----------------+      +-------------------+
                                         |
                                         v
                              +----------+-----------+
                              |  payshield-ml-engine |
                              |  fraud ensemble      |
                              +----------+-----------+
                                         |
                +------------------------+------------------------+
                |                        |                        |
                v                        v                        v
          +-----------+           +-------------+           +-------------+
          | Prometheus|           |    Loki     |           |   Jaeger    |
          | metrics   |           | structured  |           | traces      |
          +-----+-----+           | logs        |           +------+------+ 
                \                 +------+------+                  /
                 \                       |                        /
                  \                      v                       /
                   +-------------------------------------------+
                   |         observability-brain               |
                   | LSTM + DistilBERT + RCA + remediation     |
                   +-------------------------------------------+
```

## AI models

### Metric degradation detector

- Architecture: 2-layer BiLSTM, hidden size 64, dropout 0.2
- Input window: 30 timesteps, 12 Prometheus-derived features
- Output: anomaly probability across six services
- Training data: synthetic sequences with injected latency spikes, error bursts, confidence drops, and cascade patterns

### Log anomaly detector

- Base model: `distilbert-base-uncased`
- Task: binary sequence classification for normal vs anomalous logs
- Training data: synthetic structured PayShield logs and realistic failure logs
- Output: anomaly probability per log line

### Root cause engine

- Fuses LSTM metric signals, DistilBERT log anomalies, and Jaeger trace anomalies
- Uses weighted evidence and service-level aggregation
- Produces:
  - root cause service
  - failure type
  - confidence
  - metric evidence
  - log evidence
  - trace evidence
  - business impact
  - top contributing features

## Blockchain evidence trail

Observability events are written to `ObservabilityLedger.sol`:

- anomaly detection events
- remediation executions
- fallback activation
- fallback deactivation

This creates a tamper-evident trail for incident response and compliance review.

## Running the stack

On macOS/Linux:

```bash
bash scripts/start_full_stack.sh
```

On Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start_full_stack.ps1
```

Main URLs:

- Frontend: `http://localhost:5173`
- Observability route in the same app: `http://localhost:5173/observability`
- Observability Brain: `http://localhost:9000`
- Grafana: `http://localhost:3000`
- Jaeger: `http://localhost:16686`
- Prometheus: `http://localhost:9090`

You do not run PayShield separately and then another stack separately. The single Docker Compose stack runs:

- the PayShield application
- the observability stack
- the observability brain
- the k6 live load generator

For PS3, this is acceptable because the requirement allows:

- `Loki` or `OpenSearch` for logs
- `k6` or `Locust` for load generation

This implementation uses `Loki + Promtail` and `k6`.

## Running the demo

On macOS/Linux:

```bash
bash scripts/demo_15s.sh
```

On Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\demo_15s.ps1
```

The demo injects a cascade failure, watches the observability pipeline detect and attribute the root cause, triggers remediation, confirms recovery, and exits with success if the total elapsed time stays under 15 seconds.
