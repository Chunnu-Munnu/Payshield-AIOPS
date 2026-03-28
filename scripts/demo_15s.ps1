$ErrorActionPreference = "Stop"

$StartTs = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
Write-Host "Injecting cascade failure..."

$BaselineAnomalies = @()
$BaselineHistory = @()
try {
  $BaselineAnomalies = Invoke-RestMethod -Method Get -Uri "http://localhost:9000/api/anomalies" -ErrorAction SilentlyContinue
} catch {
  $BaselineAnomalies = @()
}
try {
  $BaselineHistory = Invoke-RestMethod -Method Get -Uri "http://localhost:9000/api/remediation/history" -ErrorAction SilentlyContinue
} catch {
  $BaselineHistory = @()
}

$BaselineAnomalyIds = @{}
foreach ($item in @($BaselineAnomalies)) {
  if ($item.rootCause.anomaly_id) {
    $BaselineAnomalyIds[$item.rootCause.anomaly_id] = $true
  }
}

$BaselineRemediationIds = @{}
foreach ($item in @($BaselineHistory)) {
  if ($item.remediation_id) {
    $BaselineRemediationIds[$item.remediation_id] = $true
  }
}

Invoke-RestMethod -Method Post -Uri "http://localhost:9000/api/inject-failure" -ContentType "application/json" -Body '{"type":"cascade_failure"}' | Out-Null

$AnomalyTs = $null
$RootCauseTs = $null
$RemediationTs = $null
$RecoveryTs = $null
$BaselineRemediationTimestamp = $null
$BaselineSystemStatus = $null
$LastSeenMode = "full_ensemble"
$FallbackSeen = $false
$Deadline = $StartTs + 30

try {
  $BaselineSystemStatus = Invoke-RestMethod -Method Get -Uri "http://localhost:3001/api/system/status" -ErrorAction SilentlyContinue
  $BaselineRemediationTimestamp = $BaselineSystemStatus.lastRemediationTimestamp
  $LastSeenMode = $BaselineSystemStatus.fraudScoringMode
} catch {
  $BaselineSystemStatus = $null
}

while ([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() -lt $Deadline) {
  $anomalies = Invoke-RestMethod -Method Get -Uri "http://localhost:9000/api/anomalies" -ErrorAction SilentlyContinue
  $latestRoot = Invoke-RestMethod -Method Get -Uri "http://localhost:9000/api/root-cause/latest" -ErrorAction SilentlyContinue
  $history = Invoke-RestMethod -Method Get -Uri "http://localhost:9000/api/remediation/history" -ErrorAction SilentlyContinue
  $newAnomaly = $null
  $newRemediation = $null

  foreach ($item in @($anomalies)) {
    $candidateId = $item.rootCause.anomaly_id
    if ($candidateId -and -not $BaselineAnomalyIds.ContainsKey($candidateId)) {
      $newAnomaly = $item
      break
    }
  }

  foreach ($item in @($history)) {
    $candidateId = $item.remediation_id
    if ($candidateId -and -not $BaselineRemediationIds.ContainsKey($candidateId)) {
      $newRemediation = $item
      break
    }
  }

  if (-not $AnomalyTs -and $newAnomaly) {
    $AnomalyTs = (Get-Date).ToString("o")
    Write-Host "Anomaly detected: $AnomalyTs"
  }

  if (-not $RootCauseTs -and $newAnomaly.rootCause.root_cause_service) {
    $RootCauseTs = (Get-Date).ToString("o")
    Write-Host "Root cause attributed: $RootCauseTs"
  }

  if (-not $RemediationTs -and $newRemediation) {
    $RemediationTs = (Get-Date).ToString("o")
    Write-Host "Remediation triggered: $RemediationTs"
  }

  $status = Invoke-RestMethod -Method Get -Uri "http://localhost:3001/api/system/status" -ErrorAction SilentlyContinue
  if ($status.fraudScoringMode -eq "fallback") {
    $FallbackSeen = $true
  }
  if (-not $RemediationTs -and $status.lastRemediationTimestamp -and $status.lastRemediationTimestamp -ne $BaselineRemediationTimestamp) {
    $RemediationTs = (Get-Date).ToString("o")
    Write-Host "Remediation triggered: $RemediationTs"
  }

  if ($RemediationTs -and $FallbackSeen) {
    if ($status.mlEngineHealthy -eq $true -and $status.fraudScoringMode -eq "full_ensemble") {
      $RecoveryTs = (Get-Date).ToString("o")
      Write-Host "Recovery confirmed: $RecoveryTs"
      break
    }
  }

  Start-Sleep -Seconds 1
}

$EndTs = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$Elapsed = $EndTs - $StartTs
Write-Host "Total elapsed time: ${Elapsed}s"

if ($Elapsed -lt 15) {
  exit 0
}

exit 1
