// SPDX-License-Identifier: MIT
// FILE: FederatedModelRegistry.sol
// ROLE: On-chain ML model version provenance — academically novel
// INSPIRED BY: JP Morgan Project AIKYA + model governance requirements
// PERFORMANCE TARGET: Model registration < 2s

pragma solidity ^0.8.20;
import "@openzeppelin/contracts/access/Ownable.sol";

contract FederatedModelRegistry is Ownable {
    struct ModelVersion {
        bytes32  modelHash;
        string   institutionId;
        uint256  accuracy;         // * 10000 (e.g. 9421 = 94.21%)
        uint256  registeredAt;
        uint256  roundNumber;
        bool     active;
    }

    mapping(bytes32 => ModelVersion) public versions;
    mapping(uint256 => bytes32)      public roundToModel; // round → modelHash
    bytes32[]                        public versionIndex;
    uint256                          public currentRound;
    bytes32                          public activeModelHash;

    mapping(address => bool) public authorizedInstitutions;

    event ModelUpdated(bytes32 indexed modelHash, string institutionId, uint256 round, uint256 accuracy);
    event ModelRolledBack(bytes32 indexed modelHash, uint256 round);

    constructor() Ownable(msg.sender) { currentRound = 0; }

    modifier onlyInstitution() {
        require(authorizedInstitutions[msg.sender] || msg.sender == owner(), "Not authorized institution");
        _;
    }

    function authorizeInstitution(address inst) external onlyOwner { authorizedInstitutions[inst] = true; }

    function registerModelUpdate(
        bytes32       modelHash,
        string calldata institutionId,
        uint256       accuracy
    ) external onlyInstitution {
        currentRound++;
        versions[modelHash] = ModelVersion({
            modelHash:      modelHash,
            institutionId:  institutionId,
            accuracy:       accuracy,
            registeredAt:   block.timestamp,
            roundNumber:    currentRound,
            active:         true
        });
        // Deactivate previous
        if (activeModelHash != bytes32(0)) {
            versions[activeModelHash].active = false;
        }
        activeModelHash           = modelHash;
        roundToModel[currentRound] = modelHash;
        versionIndex.push(modelHash);
        emit ModelUpdated(modelHash, institutionId, currentRound, accuracy);
    }

    function getActiveModel() external view returns (ModelVersion memory) {
        return versions[activeModelHash];
    }

    function getModelAtRound(uint256 round) external view returns (ModelVersion memory) {
        return versions[roundToModel[round]];
    }

    function rollbackToVersion(bytes32 modelHash) external onlyOwner {
        require(versions[modelHash].registeredAt != 0, "Version not found");
        versions[activeModelHash].active = false;
        activeModelHash                  = modelHash;
        versions[modelHash].active       = true;
        emit ModelRolledBack(modelHash, versions[modelHash].roundNumber);
    }

    function getTotalRounds() external view returns (uint256) { return currentRound; }
}
