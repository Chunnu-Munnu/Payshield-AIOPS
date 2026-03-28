const hre = require("hardhat");
const deployed = require("../deployed.json");

async function main() {
  const [owner, oracle, institution, analyst] = await hre.ethers.getSigners();
  const fraudAuditLedger = await hre.ethers.getContractAt("FraudAuditLedger", deployed.contracts.FraudAuditLedger, oracle);
  const transactionRegistry = await hre.ethers.getContractAt("TransactionRegistry", deployed.contracts.TransactionRegistry, oracle);
  const federatedModelRegistry = await hre.ethers.getContractAt("FederatedModelRegistry", deployed.contracts.FederatedModelRegistry, institution);
  const alertEscrow = await hre.ethers.getContractAt("AlertEscrow", deployed.contracts.AlertEscrow, analyst);
  const txHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("demo-seed-transaction"));

  await owner.sendTransaction({ to: deployed.contracts.AlertEscrow, value: hre.ethers.parseEther("5") });
  await (await transactionRegistry.registerTransaction(txHash)).wait();
  await (await fraudAuditLedger.storeFraudEvent(txHash, 92, "1.0.0", "block", Math.floor(Date.now() / 1000), "analyst-demo")).wait();
  await (await federatedModelRegistry.registerModelUpdate("Institution-A", hre.ethers.keccak256(hre.ethers.toUtf8Bytes("model-v1")), 9412, Math.floor(Date.now() / 1000))).wait();
  await (await alertEscrow.createAlert(txHash, hre.ethers.parseEther("0.25"), { value: hre.ethers.parseEther("0.25") })).wait();
  console.log(`Seeded transaction ${txHash}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
