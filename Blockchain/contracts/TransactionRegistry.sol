// SPDX-License-Identifier: MIT
// FILE: TransactionRegistry.sol
// ROLE: Transaction proof-of-existence — cryptographic integrity verification
// INSPIRED BY: Blockchain-based payment integrity by SWIFT GPI
// PERFORMANCE TARGET: Registration < 1s, verification < 100ms

pragma solidity ^0.8.20;
import "@openzeppelin/contracts/access/Ownable.sol";

contract TransactionRegistry is Ownable {
    struct TxRecord {
        bytes32  txHash;
        bytes32  fingerprintHash;  // keccak256(amount+merchant+timestamp+deviceId)
        uint256  registeredAt;
        uint256  blockNum;
        bytes32  fraudAlertId;
        bool     linked;
    }

    mapping(bytes32 => TxRecord) public records;
    mapping(address => bool)     public authorizedRegistrars;

    event TransactionRegistered(bytes32 indexed txHash, bytes32 fingerprintHash, uint256 blockNum);
    event TransactionLinkedToAlert(bytes32 indexed txHash, bytes32 alertId);

    constructor() Ownable(msg.sender) {}

    modifier onlyRegistrar() {
        require(authorizedRegistrars[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    function authorizeRegistrar(address r) external onlyOwner { authorizedRegistrars[r] = true; }

    function registerTransaction(
        bytes32 txHash,
        bytes32 fingerprintHash
    ) external onlyRegistrar {
        require(records[txHash].registeredAt == 0, "Already registered");
        records[txHash] = TxRecord({
            txHash:          txHash,
            fingerprintHash: fingerprintHash,
            registeredAt:    block.timestamp,
            blockNum:        block.number,
            fraudAlertId:    bytes32(0),
            linked:          false
        });
        emit TransactionRegistered(txHash, fingerprintHash, block.number);
    }

    function verifyTransaction(bytes32 txHash, bytes32 fingerprintHash) external view returns (bool) {
        TxRecord memory r = records[txHash];
        return r.registeredAt != 0 && r.fingerprintHash == fingerprintHash;
    }

    function linkToFraudAlert(bytes32 txHash, bytes32 alertId) external onlyRegistrar {
        require(records[txHash].registeredAt != 0, "Not registered");
        records[txHash].fraudAlertId = alertId;
        records[txHash].linked       = true;
        emit TransactionLinkedToAlert(txHash, alertId);
    }

    function getRecord(bytes32 txHash) external view returns (TxRecord memory) {
        return records[txHash];
    }
}
