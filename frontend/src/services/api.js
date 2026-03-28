import axios from "axios";

const api = axios.create({
  baseURL: `${import.meta.env.VITE_BACKEND_URL || "http://localhost:3001"}/api`,
  timeout: 15000,
});

export const fetchFraudStats = async () => (await api.get("/fraud/stats")).data;
export const fetchAlerts = async () => (await api.get("/fraud/alerts")).data;
export const fetchHistory = async (userId) => (await api.get("/transactions/history", { params: { userId, limit: 100 } })).data;
export const fetchCompliance = async () => (await api.get("/reports/compliance")).data;
export const verifyBlockchain = async (txHash) => (await api.get(`/blockchain/verify/${txHash}`)).data;
export const fetchModelVersion = async () => (await api.get("/blockchain/model-version")).data;
export const simulateFraud = async (payload) => (await api.post("/fraud/simulate", payload)).data;
export const verifyOtp = async (payload) => (await api.post("/alerts/verify-otp", payload)).data;
export const submitTransaction = async (payload) => (await api.post("/transactions/submit", payload)).data;
export const testSms = async (payload = {}) => (await api.post("/sms/test", payload)).data;
export const emailStatus = async () => (await api.get("/email/status")).data;
export const sendTestBecEmail = async (scenario) => (await api.post("/email/test-bec", { scenario })).data;
export const fetchSystemStatus = async () => (await api.get("/system/status")).data;
export const fetchObservabilityAnomalies = async () => (await axios.get(`${import.meta.env.VITE_OBSERVABILITY_URL || "http://localhost:9000"}/api/anomalies`)).data;
export const fetchRootCauseLatest = async () => (await axios.get(`${import.meta.env.VITE_OBSERVABILITY_URL || "http://localhost:9000"}/api/root-cause/latest`)).data;
export const fetchRemediationHistory = async () => (await axios.get(`${import.meta.env.VITE_OBSERVABILITY_URL || "http://localhost:9000"}/api/remediation/history`)).data;
export const injectObservabilityFailure = async (type) => (await axios.post(`${import.meta.env.VITE_OBSERVABILITY_URL || "http://localhost:9000"}/api/inject-failure`, { type })).data;
export const fetchObservabilityMetrics = async () => (await axios.get(`${import.meta.env.VITE_OBSERVABILITY_URL || "http://localhost:9000"}/metrics`, { responseType: "text" })).data;

export default api;
