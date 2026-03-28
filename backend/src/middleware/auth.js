// FILE: auth.js
// ROLE: Lightweight analyst authentication middleware
// INSPIRED BY: Internal fraud-ops API gateways
// PERFORMANCE TARGET: Auth check under 1ms
module.exports = function auth(req, _res, next) {
  req.user = {
    id: req.headers["x-user-id"] || "analyst-demo",
    role: req.headers["x-user-role"] || "analyst",
  };
  next();
};
