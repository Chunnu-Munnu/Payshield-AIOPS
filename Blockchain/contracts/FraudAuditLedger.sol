// SPDX-License-Identifier: MIT
// FILE: FraudAuditLedger.sol
// ROLE: Immutable on-chain fraud event logging with appeal mechanism
// INSPIRED BY: JP Morgan blockchain audit trail for model governance
// PERFORMANCE TARGET: Event logged within 2s of fraud decision

pragma solidity ^0.8.20;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract FraudAuditLedger is Ownable, Pausable {
    struct FraudEvent {
        bytes32  txHash;
        uint16   fraudScore;       // 0-100 scaled * 100 (stored as 0-10000)
        string   modelVersion;
        string   decision;         // "approve" | "block" | "quarantine" | "step_up_auth"
        uint256  timestamp;
        address  analyst;
        bool     appealed;
        bool     appealResolved;
        string   appealOutcome;
    }

    struct Appeal {
        bytes32  txHash;
        string   reason;
        address  appellant;
        uint256  filedAt;
        bool     resolved;
        string   outcome;
    }

    mapping(bytes32 => FraudEvent) public fraudEvents;
    mapping(bytes32 => Appeal)     public appeals;
    mapping(address => bool)       public authorizedOracles;
    bytes32[]                      public eventIndex;

    event FraudLogged(bytes32 indexed txHash, uint16 fraudScore, string decision, string modelVersion);
    event AppealFiled(bytes32 indexed txHash, address appellant, string reason);
    event AppealResolved(bytes32 indexed txHash, string outcome);
    event OracleAuthorized(address oracle);
    event OracleRevoked(address oracle);

    constructor() Ownable(msg.sender) {}

    modifier onlyOracle() {
        require(authorizedOracles[msg.sender] || msg.sender == owner(), "Not authorized oracle");
        _;
    }

    function authorizeOracle(address oracle) external onlyOwner {
        authorizedOracles[oracle] = true;
        emit OracleAuthorized(oracle);
    }

    function revokeOracle(address oracle) external onlyOwner {
        authorizedOracles[oracle] = false;
        emit OracleRevoked(oracle);
    }

    function storeFraudEvent(
        bytes32 txHash,
        uint16  fraudScore,
        string calldata modelVersion,
        string calldata decision,
        uint256 timestamp
    ) external onlyOracle whenNotPaused {
        require(fraudEvents[txHash].timestamp == 0, "Event already logged");
        fraudEvents[txHash] = FraudEvent({
            txHash:          txHash,
            fraudScore:      fraudScore,
            modelVersion:    modelVersion,
            decision:        decision,
            timestamp:       timestamp,
            analyst:         msg.sender,
            appealed:        false,
            appealResolved:  false,
            appealOutcome:   ""
        });
        eventIndex.push(txHash);
        emit FraudLogged(txHash, fraudScore, decision, modelVersion);
    }

    function getFraudEvent(bytes32 txHash) external view returns (FraudEvent memory) {
        return fraudEvents[txHash];
    }

    function getTotalEvents() external view returns (uint256) {
        return eventIndex.length;
    }

    function getRecentEvents(uint256 count) external view returns (bytes32[] memory) {
        uint256 len = eventIndex.length;
        uint256 n = count > len ? len : count;
        bytes32[] memory result = new bytes32[](n);
        for (uint256 i = 0; i < n; i++) {
            result[i] = eventIndex[len - 1 - i];
        }
        return result;
    }

    function appealFraudDecision(bytes32 txHash, string calldata reason) external {
        require(fraudEvents[txHash].timestamp != 0, "Event not found");
        require(!fraudEvents[txHash].appealed, "Already appealed");
        fraudEvents[txHash].appealed = true;
        appeals[txHash] = Appeal({
            txHash:    txHash,
            reason:    reason,
            appellant: msg.sender,
            filedAt:   block.timestamp,
            resolved:  false,
            outcome:   ""
        });
        emit AppealFiled(txHash, msg.sender, reason);
    }

    function finalizeAppeal(bytes32 txHash, string calldata outcome) external onlyOwner {
        require(fraudEvents[txHash].appealed, "Not appealed");
        require(!fraudEvents[txHash].appealResolved, "Already resolved");
        fraudEvents[txHash].appealResolved = true;
        fraudEvents[txHash].appealOutcome  = outcome;
        appeals[txHash].resolved           = true;
        appeals[txHash].outcome            = outcome;
        emit AppealResolved(txHash, outcome);
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
