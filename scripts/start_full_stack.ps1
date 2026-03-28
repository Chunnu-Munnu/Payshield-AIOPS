$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

function Invoke-Compose {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
  )

  if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    & docker-compose @Args
    return
  }

  & docker compose @Args
}

function Wait-ForHealth {
  param(
    [string]$Service,
    [int]$TimeoutSeconds = 180
  )

  $startedAt = Get-Date
  while ($true) {
    $health = ""
    try {
      $health = (& docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $Service 2>$null).Trim()
    } catch {
      $health = ""
    }

    if ($health -eq "healthy" -or $health -eq "running") {
      Write-Host "[PS3] $Service is ready"
      return
    }

    if (((Get-Date) - $startedAt).TotalSeconds -gt $TimeoutSeconds) {
      throw "[PS3] Timeout waiting for $Service"
    }

    Start-Sleep -Seconds 3
  }
}

Write-Host "[PS3] Starting core PayShield stack..."
Invoke-Compose up -d payshield-blockchain redis payshield-ml-engine payshield-backend loki promtail jaeger prometheus grafana

Wait-ForHealth payshield-backend 180
Wait-ForHealth payshield-ml-engine 240
Wait-ForHealth payshield-blockchain 180
Wait-ForHealth prometheus 180
Wait-ForHealth loki 180
Wait-ForHealth jaeger 180
Wait-ForHealth grafana 180

Write-Host "[PS3] Deploying blockchain contracts..."
Push-Location "$RootDir\Blockchain"
try {
  & npx hardhat run scripts/deploy.js --network localhost
} catch {
}
& npx hardhat run scripts/deploy_observability.js --network localhost
Pop-Location

Write-Host "[PS3] Ensuring observability models are prepared in container volumes..."
Invoke-Compose run --rm observability-brain sh -lc '[ -f /app/runtime_models/lstm_weights.pt ] || python models/lstm_detector.py'
Invoke-Compose run --rm observability-brain sh -lc '[ -d /app/runtime_models/log_anomaly_model ] || python models/log_anomaly_detector.py'

Write-Host "[PS3] Starting application-facing services..."
Invoke-Compose up -d observability-brain payshield-frontend payshield-simulator
Wait-ForHealth observability-brain 600
Wait-ForHealth payshield-frontend 180

Write-Host ""
Write-Host "Frontend:             http://localhost:5173"
Write-Host "Grafana:              http://localhost:3000"
Write-Host "Jaeger UI:            http://localhost:16686"
Write-Host "Observability Brain:  http://localhost:9000"
Write-Host "Prometheus:           http://localhost:9090"
Write-Host "Loki:                 http://localhost:3100"
