const hre = require("hardhat");

async function main() {
  console.log("Deploying PayShield AI contracts natively on local Hardhat...");

  const FraudAuditLedger = await hre.ethers.getContractFactory("FraudAuditLedger");
  const fraudLedger = await FraudAuditLedger.deploy();
  await fraudLedger.waitForDeployment();
  console.log("FraudAuditLedger deployed to:", await fraudLedger.getAddress());

  const TransactionRegistry = await hre.ethers.getContractFactory("TransactionRegistry");
  const txRegistry = await TransactionRegistry.deploy();
  await txRegistry.waitForDeployment();
  console.log("TransactionRegistry deployed to:", await txRegistry.getAddress());

  const FederatedModelRegistry = await hre.ethers.getContractFactory("FederatedModelRegistry");
  const modelRegistry = await FederatedModelRegistry.deploy();
  await modelRegistry.waitForDeployment();
  console.log("FederatedModelRegistry deployed to:", await modelRegistry.getAddress());

  const AlertEscrow = await hre.ethers.getContractFactory("AlertEscrow");
  const escrow = await AlertEscrow.deploy();
  await escrow.waitForDeployment();
  console.log("AlertEscrow deployed to:", await escrow.getAddress());

  const IdentityVerifier = await hre.ethers.getContractFactory("IdentityVerifier");
  const identity = await IdentityVerifier.deploy();
  await identity.waitForDeployment();
  console.log("IdentityVerifier deployed to:", await identity.getAddress());

  console.log("\nDeployment complete.");
  console.log("Update BACKEND .env file with these addresses if required.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
