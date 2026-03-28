// FILE: runtimeState.js
// ROLE: Shared runtime flags for fallback, debug injection, and remediation state
// INSPIRED BY: Lightweight control plane state in service runtimes
// PERFORMANCE TARGET: In-memory state reads under 1 microsecond

const state = {
  fraudScoringMode: "full_ensemble",
  fallbackActivatedAt: null,
  lastRemediationTimestamp: null,
  backendErrorBurstUntil: 0,
};

function setFraudScoringMode(mode) {
  state.fraudScoringMode = mode;
  if (mode === "fallback") state.fallbackActivatedAt = Date.now();
}

function getFallbackDurationMs() {
  return state.fallbackActivatedAt ? Date.now() - state.fallbackActivatedAt : 0;
}

function clearFallback() {
  state.fraudScoringMode = "full_ensemble";
  const duration = getFallbackDurationMs();
  state.fallbackActivatedAt = null;
  return duration;
}

function triggerBackendErrorBurst(durationMs = 30000) {
  state.backendErrorBurstUntil = Date.now() + durationMs;
}

function shouldInjectBackendError() {
  return Date.now() < state.backendErrorBurstUntil && Math.random() < 0.3;
}

function isFallbackActive() {
  return state.fraudScoringMode === "fallback";
}

function markRemediation(timestamp = new Date().toISOString()) {
  state.lastRemediationTimestamp = timestamp;
}

module.exports = {
  state,
  setFraudScoringMode,
  clearFallback,
  getFallbackDurationMs,
  triggerBackendErrorBurst,
  shouldInjectBackendError,
  isFallbackActive,
  markRemediation,
};
