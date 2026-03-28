#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
elif docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
else
  echo "[PS3] Docker Compose not found"
  exit 1
fi

compose() {
  if [[ "$COMPOSE_CMD" == "docker compose" ]]; then
    docker compose "$@"
  else
    docker-compose "$@"
  fi
}

echo "[PS3] Starting full PayShield stack..."
compose up -d payshield-blockchain redis payshield-ml-engine payshield-backend loki promtail jaeger prometheus grafana

wait_for_health() {
  local service="$1"
  local timeout_seconds="${2:-180}"
  local started_at
  started_at="$(date +%s)"

  while true; do
    local health
    health="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$service" 2>/dev/null || true)"
    if [[ "$health" == "healthy" || "$health" == "running" ]]; then
      echo "[PS3] $service is ready"
      return 0
    fi
    if (( "$(date +%s)" - started_at > timeout_seconds )); then
      echo "[PS3] Timeout waiting for $service"
      return 1
    fi
    sleep 3
  done
}

wait_for_health payshield-backend 180
wait_for_health payshield-ml-engine 240
wait_for_health payshield-blockchain 180
wait_for_health prometheus 180
wait_for_health loki 180
wait_for_health jaeger 180
wait_for_health grafana 180

echo "[PS3] Deploying blockchain contracts..."
(
  cd "$ROOT_DIR/Blockchain"
  npx hardhat run scripts/deploy.js --network localhost || true
  npx hardhat run scripts/deploy_observability.js --network localhost
)

echo "[PS3] Ensuring observability models are prepared in container volumes..."
compose run --rm observability-brain sh -lc '[ -f /app/models/lstm_weights.pt ] || python models/lstm_detector.py'
compose run --rm observability-brain sh -lc '[ -d /app/models/log_anomaly_model ] || python models/log_anomaly_detector.py'

echo "[PS3] Starting application-facing services..."
compose up -d observability-brain payshield-frontend payshield-simulator
wait_for_health observability-brain 600
wait_for_health payshield-frontend 180

echo "[PS3] Load generator already included in Docker Compose as payshield-simulator"

cat <<EOF

Frontend:             http://localhost:5173
Grafana:              http://localhost:3000
Jaeger UI:            http://localhost:16686
Observability Brain:  http://localhost:9000
Prometheus:           http://localhost:9090
Loki:                 http://localhost:3100

EOF
