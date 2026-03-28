// FILE: fraudGuard.js
// ROLE: Request schema normalization and sanity checks
// INSPIRED BY: API gateway fraud prefilters
// PERFORMANCE TARGET: Validation under 1ms
module.exports = function fraudGuard(req, res, next) {
  if (req.method === "POST" && req.path.includes("/transactions/submit")) {
    const { amount, userId, merchantName } = req.body || {};
    if (amount == null || !userId || !merchantName) {
      return res.status(400).json({ error: "Missing required transaction fields" });
    }
  }
  return next();
};
