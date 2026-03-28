// FILE: observabilityLedger.js
// ROLE: Write fallback and observability events to the observability ledger contract
// INSPIRED BY: Tamper-evident SRE action ledgers for regulated systems
// PERFORMANCE TARGET: Non-blocking graceful writes under 2 seconds

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { logger } = require("./logger");

const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL || "http://localhost:8545");
const wallet = process.env.PRIVATE_KEY ? new ethers.Wallet(process.env.PRIVATE_KEY, provider) : null;
const deploymentCandidates = [
  process.env.OBSERVABILITY_LEDGER_ADDRESS_PATH,
  path.join(process.cwd(), "blockchain", "deployments", "observability_address.json"),
  path.join(process.cwd(), "..", "Blockchain", "deployments", "observability_address.json"),
  path.join(__dirname, "..", "..", "..", "Blockchain", "deployments", "observability_address.json"),
  "/app/blockchain/deployments/observability_address.json",
  "/Blockchain/deployments/observability_address.json",
].filter(Boolean);

const abi = [
  "function logAnomaly(bytes32 anomalyId,string rootCauseService,string failureType,uint256 confidence) external returns (bool)",
  "function logRemediation(bytes32 remediationId,bytes32 anomalyId,string actionsJson,uint256 recoveryTimeMs,bool success) external returns (bool)",
  "function logFallbackActivated(string reason) external returns (bool)",
  "function logFallbackDeactivated(uint256 durationMs) external returns (bool)",
];

function loadAddress() {
  if (process.env.OBSERVABILITY_LEDGER_CONTRACT) return process.env.OBSERVABILITY_LEDGER_CONTRACT;
  for (const filePath of deploymentCandidates) {
    if (!fs.existsSync(filePath)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (parsed.address) return parsed.address;
    } catch (_error) {
    }
  }
  return null;
}

function contract() {
  const address = loadAddress();
  if (!address || !wallet) return null;
  return new ethers.Contract(address, abi, wallet);
}

async function safeSend(send) {
  try {
    const instance = contract();
    if (!instance) return null;
    const tx = await send(instance);
    const receipt = await tx.wait(1);
    return receipt.hash;
  } catch (error) {
    logger.warn({ error: error.message }, "observability_ledger_write_failed");
    return null;
  }
}

async function logFallbackActivated(reason) {
  return safeSend((instance) => instance.logFallbackActivated(reason));
}

async function logFallbackDeactivated(durationMs) {
  return safeSend((instance) => instance.logFallbackDeactivated(durationMs));
}

module.exports = {
  logFallbackActivated,
  logFallbackDeactivated,
};
