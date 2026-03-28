#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Injecting cascade failure..."
START_TS="$(date +%s)"
curl -s -X POST "http://localhost:9000/api/inject-failure" \
  -H "Content-Type: application/json" \
  -d '{"type":"cascade_failure"}' >/dev/null

ANOMALY_TS=""
ROOT_CAUSE_TS=""
REMEDIATION_TS=""
RECOVERY_TS=""

deadline=$((START_TS + 30))
while (( "$(date +%s)" < deadline )); do
  anomalies="$(curl -s http://localhost:9000/api/anomalies || true)"
  latest_root="$(curl -s http://localhost:9000/api/root-cause/latest || true)"
  history="$(curl -s http://localhost:9000/api/remediation/history || true)"

  if [[ -z "$ANOMALY_TS" ]] && echo "$anomalies" | grep -q "ANOMALY_DETECTED"; then
    ANOMALY_TS="$(date -Iseconds)"
    echo "Anomaly detected: $ANOMALY_TS"
  fi

  if [[ -z "$ROOT_CAUSE_TS" ]] && echo "$latest_root" | grep -q "root_cause_service"; then
    ROOT_CAUSE_TS="$(date -Iseconds)"
    echo "Root cause attributed: $ROOT_CAUSE_TS"
  fi

  if [[ -z "$REMEDIATION_TS" ]] && echo "$history" | grep -q "remediation_id"; then
    REMEDIATION_TS="$(date -Iseconds)"
    echo "Remediation triggered: $REMEDIATION_TS"
  fi

  if [[ -n "$REMEDIATION_TS" ]] && curl -s http://localhost:3001/api/system/status | grep -q '"mlEngineHealthy":true'; then
    RECOVERY_TS="$(date -Iseconds)"
    echo "Recovery confirmed: $RECOVERY_TS"
    break
  fi

  sleep 1
done

END_TS="$(date +%s)"
ELAPSED="$((END_TS - START_TS))"
echo "Total elapsed time: ${ELAPSED}s"

if (( ELAPSED < 15 )); then
  exit 0
fi

exit 1
