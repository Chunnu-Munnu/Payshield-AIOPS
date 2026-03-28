const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TransactionRegistry", function () {
  it("registers and links transactions", async function () {
    const [, registrar] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("TransactionRegistry");
    const contract = await Factory.deploy();
    await contract.waitForDeployment();

    await contract.setRegistrar(registrar.address, true);
    const txHash = ethers.keccak256(ethers.toUtf8Bytes("tx-2"));
    const alertId = ethers.keccak256(ethers.toUtf8Bytes("alert-2"));

    await contract.connect(registrar).registerTransaction(txHash);
    expect(await contract.verifyTransaction(txHash)).to.equal(true);

    await contract.connect(registrar).linkToFraudAlert(txHash, alertId);
    const record = await contract.getTransaction(txHash);
    expect(record.fraudAlertId).to.equal(alertId);
  });
});
