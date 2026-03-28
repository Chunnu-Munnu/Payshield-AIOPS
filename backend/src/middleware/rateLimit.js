// FILE: rateLimit.js
// ROLE: Shared API rate limiter configuration
// INSPIRED BY: High-throughput payment security APIs
// PERFORMANCE TARGET: Sustain 1000 req/min/IP
const rateLimit = require("express-rate-limit");

module.exports = rateLimit({
  windowMs: 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
