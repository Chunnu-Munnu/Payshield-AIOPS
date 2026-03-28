// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ObservabilityLedger {
    event AnomalyDetected(bytes32 indexed anomalyId, string rootCauseService, string failureType, uint256 confidence, uint256 timestamp);
    event RemediationExecuted(bytes32 indexed remediationId, bytes32 indexed anomalyId, string actionsJson, uint256 recoveryTimeMs, bool success, uint256 timestamp);
    event FallbackActivated(uint256 timestamp, string reason);
    event FallbackDeactivated(uint256 timestamp, uint256 durationMs);

    uint256 private anomalyCount;
    uint256 private remediationCount;

    function logAnomaly(bytes32 anomalyId, string calldata rootCauseService, string calldata failureType, uint256 confidence) external returns (bool) {
        anomalyCount += 1;
        emit AnomalyDetected(anomalyId, rootCauseService, failureType, confidence, block.timestamp);
        return true;
    }

    function logRemediation(bytes32 remediationId, bytes32 anomalyId, string calldata actionsJson, uint256 recoveryTimeMs, bool success) external returns (bool) {
        remediationCount += 1;
        emit RemediationExecuted(remediationId, anomalyId, actionsJson, recoveryTimeMs, success, block.timestamp);
        return true;
    }

    function logFallbackActivated(string calldata reason) external returns (bool) {
        emit FallbackActivated(block.timestamp, reason);
        return true;
    }

    function logFallbackDeactivated(uint256 durationMs) external returns (bool) {
        emit FallbackDeactivated(block.timestamp, durationMs);
        return true;
    }

    function getAnomalyCount() external view returns (uint256) {
        return anomalyCount;
    }

    function getRemediationCount() external view returns (uint256) {
        return remediationCount;
    }
}
