const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FraudAuditLedger", function () {
  it("stores fraud events and appeals", async function () {
    const [, oracle, analyst] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("FraudAuditLedger");
    const contract = await Factory.deploy();
    await contract.waitForDeployment();

    await contract.setOracle(oracle.address, true);
    await contract.setDisputeParty(analyst.address, true);

    const txHash = ethers.keccak256(ethers.toUtf8Bytes("tx-1"));
    await contract.connect(oracle).storeFraudEvent(txHash, 88, "1.0.0", "block", 123456, "A-77");
    const stored = await contract.getFraudEvent(txHash);
    expect(stored.fraudScore).to.equal(88n);

    await contract.connect(analyst).appealFraudDecision(txHash, "Customer dispute");
    await contract.finalizeAppeal(txHash, 0, "released");
    const appeals = await contract.getAppeals(txHash);
    expect(appeals[0].resolved).to.equal(true);
  });
});
