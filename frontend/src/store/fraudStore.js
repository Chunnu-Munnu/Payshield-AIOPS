import { create } from "zustand";

const initialMetrics = {
  transactionsPerSecond: 0,
  fraudRate: 0,
  falsePositiveRate: 0,
  avgResponseMs: 0,
  modelsActive: "6/6",
  blockchain: "SYNCED",
  federatedRound: "#001",
};

const cap = (list, max = 100) => list.slice(0, max);

const useFraudStore = create((set, get) => ({
  transactions: [],
  alerts: [],
  toasts: [],
  selectedTransaction: null,
  emailFeed: [],
  smsFeed: [],
  gmailConnected: false,
  wsConnected: false,
  compliance: null,
  metrics: initialMetrics,
  demoRunning: false,
  setTransactions: (transactions) => set({ transactions: cap(transactions, 100), selectedTransaction: transactions[0] || get().selectedTransaction }),
  addTransaction: (transaction) => {
    const merged = [transaction, ...get().transactions].filter((item, index, list) => list.findIndex((candidate) => candidate.txId === item.txId) === index);
    const transactions = cap(merged, 100);
    const flagged = transactions.filter((item) => (item.fraudScore || 0) >= 70).length;
    set({
      transactions,
      selectedTransaction: transaction.fraudScore >= 70 ? transaction : (get().selectedTransaction || transaction),
      alerts: transaction.fraudScore >= 70 ? cap([{ alertId: transaction.alertId || transaction.txId, txId: transaction.txId, severity: transaction.riskLevel || "HIGH", decision: transaction.decision, fraudScore: (transaction.fraudScore || 0) / 100, amlScore: transaction.amlScore || 0, detectedPattern: transaction.detectedPattern, blockchainTxHash: transaction.blockchainTxHash }, ...get().alerts], 20) : get().alerts,
      metrics: {
        ...get().metrics,
        transactionsPerSecond: 0,
        fraudRate: transactions.length ? (flagged / Math.min(transactions.length, 100)) * 100 : 0,
        avgResponseMs: transactions.slice(0, 20).reduce((sum, item) => sum + (item.responseTimeMs || 0), 0) / Math.max(1, Math.min(transactions.length, 20)),
      },
    });
  },
  updateTransaction: (txId, patch) => set({
    transactions: get().transactions.map((item) => item.txId === txId ? { ...item, ...patch } : item),
    selectedTransaction: get().selectedTransaction?.txId === txId ? { ...get().selectedTransaction, ...patch } : get().selectedTransaction,
  }),
  setAlerts: (alerts) => set({ alerts: cap(alerts, 20) }),
  addAlert: (alert) => set({ alerts: cap([alert, ...get().alerts], 20) }),
  pushToast: (toast) => set({ toasts: cap([toast, ...get().toasts], 5) }),
  removeToast: (id) => set({ toasts: get().toasts.filter((item) => (item.toastId || item.txId || item.timestamp) !== id) }),
  setSelectedTransaction: (selectedTransaction) => set({ selectedTransaction }),
  setMetrics: (metrics) => set({ metrics: { ...get().metrics, ...metrics } }),
  setCompliance: (compliance) => set({ compliance }),
  setDemoRunning: (demoRunning) => set({ demoRunning }),
  setGmailConnected: (gmailConnected) => set({ gmailConnected }),
  setWsConnected: (wsConnected) => set({ wsConnected }),
  addEmailFeedItem: (item) => set({ emailFeed: cap([item, ...get().emailFeed], 8) }),
  mergeEmailFeedItem: (subject, from, patch) => {
    const next = [...get().emailFeed];
    const index = next.findIndex((item) => item.subject === subject && item.from === from);
    if (index >= 0) next[index] = { ...next[index], ...patch };
    else next.unshift({ subject, from, ...patch });
    set({ emailFeed: cap(next, 8) });
  },
  addSmsFeedItem: (item) => set({ smsFeed: cap([item, ...get().smsFeed], 8) }),
}));

export default useFraudStore;
