// FILE: Transaction.js
// ROLE: In-memory transaction persistence with PostgreSQL-friendly shape
// INSPIRED BY: Real-time payment ledger storage patterns
// PERFORMANCE TARGET: Read/write in under 2ms for demo workloads

class TransactionModel {
  static rows = [];

  static create(payload) {
    const record = {
      status: "received",
      createdAt: new Date().toISOString(),
      ...payload,
    };
    this.rows.unshift(record);
    this.rows = this.rows.slice(0, 500);
    return record;
  }

  static update(txId, patch) {
    const row = this.findById(txId);
    if (row) Object.assign(row, patch, { updatedAt: new Date().toISOString() });
    return row;
  }

  static findById(txId) {
    return this.rows.find((item) => item.txId === txId) || null;
  }

  static history({ userId, limit = 100 } = {}) {
    return this.rows.filter((item) => !userId || item.userId === userId).slice(0, limit);
  }
}

module.exports = TransactionModel;
