// SPDX-License-Identifier: MIT
// FILE: AlertEscrow.sol
// ROLE: Stake-based analyst fraud alerting — game-theoretic accuracy incentive
// INSPIRED BY: Prediction market mechanisms applied to fraud ops
// PERFORMANCE TARGET: Alert creation < 1s

pragma solidity ^0.8.20;
import "@openzeppelin/contracts/access/Ownable.sol";

contract AlertEscrow is Ownable {
    struct Alert {
        bytes32  txHash;
        address  analyst;
        uint256  stakeAmount;
        uint256  createdAt;
        bool     confirmed;
        bool     rejected;
        bool     settled;
    }

    mapping(bytes32 => Alert) public alerts;
    uint256 public totalStaked;
    uint256 public rewardPool;

    event AlertStaked(bytes32 indexed txHash, address analyst, uint256 amount);
    event AlertConfirmed(bytes32 indexed txHash, address analyst, uint256 reward);
    event AlertRejected(bytes32 indexed txHash, address analyst, uint256 slashed);

    constructor() Ownable(msg.sender) {}

    function createAlert(bytes32 txHash) external payable {
        require(msg.value > 0, "Must stake ETH");
        require(alerts[txHash].createdAt == 0, "Alert already exists");
        alerts[txHash] = Alert({
            txHash:      txHash,
            analyst:     msg.sender,
            stakeAmount: msg.value,
            createdAt:   block.timestamp,
            confirmed:   false,
            rejected:    false,
            settled:     false
        });
        totalStaked += msg.value;
        emit AlertStaked(txHash, msg.sender, msg.value);
    }

    function confirmAlert(bytes32 txHash) external onlyOwner {
        Alert storage a = alerts[txHash];
        require(!a.settled, "Already settled");
        a.confirmed = true;
        a.settled   = true;
        uint256 reward = (a.stakeAmount * 120) / 100; // 20% reward
        if (address(this).balance >= reward) {
            payable(a.analyst).transfer(reward);
        } else {
            payable(a.analyst).transfer(a.stakeAmount);
        }
        emit AlertConfirmed(txHash, a.analyst, reward);
    }

    function rejectAlert(bytes32 txHash) external onlyOwner {
        Alert storage a = alerts[txHash];
        require(!a.settled, "Already settled");
        a.rejected = true;
        a.settled  = true;
        uint256 slash = a.stakeAmount / 2;
        rewardPool += slash;
        payable(a.analyst).transfer(a.stakeAmount - slash);
        emit AlertRejected(txHash, a.analyst, slash);
    }

    function fundRewardPool() external payable onlyOwner { rewardPool += msg.value; }

    receive() external payable { rewardPool += msg.value; }
}
