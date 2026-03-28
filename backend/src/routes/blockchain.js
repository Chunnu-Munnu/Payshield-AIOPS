// FILE: blockchain.js
// ROLE: Blockchain audit and model provenance endpoints
// INSPIRED BY: Immutable audit-trail APIs for fintech regulators
// PERFORMANCE TARGET: API latency under 20ms excluding chain confirmation

const express = require("express");
const blockchainLogger = require("../services/blockchainLogger");

const router = express.Router();

router.post("/log-fraud", async (req, res) => {
  const result = await blockchainLogger.registerAndLog(req.body.transaction, req.body.inference);
  res.json(result);
});

router.get("/verify/:txHash", async (req, res) => {
  res.json(await blockchainLogger.verify(req.params.txHash));
});

router.get("/model-version", async (_req, res) => {
  res.json(await blockchainLogger.getCurrentModelVersion());
});

router.post("/register-device", async (req, res) => {
  res.json(await blockchainLogger.registerDevice(req.body.deviceId, req.body.signer));
});

module.exports = router;
