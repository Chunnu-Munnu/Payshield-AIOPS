// FILE: FraudAlert.js
// ROLE: In-memory fraud alert and dispute persistence
// INSPIRED BY: SOC alert-case management queues
// PERFORMANCE TARGET: Query active alerts in under 2ms

const { v4: uuidv4 } = require("uuid");

class FraudAlertModel {
  static rows = [];

  static create(payload) {
    const alert = {
      alertId: payload.alertId || uuidv4(),
      status: "open",
      severity: "medium",
      createdAt: new Date().toISOString(),
      ...payload,
    };
    this.rows.unshift(alert);
    this.rows = this.rows.slice(0, 250);
    return alert;
  }

  static update(alertId, patch) {
    const row = this.rows.find((item) => item.alertId === alertId);
    if (row) Object.assign(row, patch, { updatedAt: new Date().toISOString() });
    return row;
  }

  static list({ status, severity } = {}) {
    return this.rows.filter((item) => (!status || item.status === status) && (!severity || item.severity === severity));
  }

  static findById(alertId) {
    return this.rows.find((item) => item.alertId === alertId) || null;
  }
}

module.exports = FraudAlertModel;
