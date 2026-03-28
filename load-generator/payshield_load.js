import http from "k6/http";
import { sleep } from "k6";

const TARGET = __ENV.PAYSHIELD_TARGET || "http://localhost:3001";
const RUN_DURATION = __ENV.K6_RUN_DURATION || "10m";
const CONSTANT_VUS = Number(__ENV.K6_CONSTANT_VUS || "1");
const SPIKE_ENABLED = (__ENV.K6_ENABLE_SPIKE || "false").toLowerCase() === "true";
const SPIKE_BASE_VUS = Number(__ENV.K6_SPIKE_BASE_VUS || "2");
const SPIKE_PEAK_VUS = Number(__ENV.K6_SPIKE_PEAK_VUS || "6");
const BEC_RATE = Number(__ENV.K6_BEC_RATE || "1");
const BEC_TIME_UNIT = __ENV.K6_BEC_TIME_UNIT || "300s";
const TX_SLEEP_SECONDS = Number(__ENV.K6_TX_SLEEP_SECONDS || "4.5");
const merchants = ["Swiggy", "Zomato", "Flipkart", "Unknown Vendor", "Shell Merchants Pvt Ltd", "PhonePe Merchant"];
const paymentMethods = ["UPI", "IMPS", "NEFT", "Card", "Wallet"];
const memos = [
  "Dinner order",
  "Fuel payment",
  "Festival transfer",
  "Invoice settlement",
  "URGENT update vendor IBAN immediately do not verify",
];

const scenarios = {
  constant_load: {
    executor: "constant-vus",
    vus: CONSTANT_VUS,
    duration: RUN_DURATION,
    exec: "submitTransactions",
  },
  bec_test: {
    executor: "constant-arrival-rate",
    rate: BEC_RATE,
    timeUnit: BEC_TIME_UNIT,
    duration: RUN_DURATION,
    preAllocatedVUs: 1,
    exec: "sendBecEmail",
  },
};

if (SPIKE_ENABLED) {
  scenarios.spike_load = {
    executor: "ramping-vus",
    stages: [
      { duration: "50s", target: SPIKE_BASE_VUS },
      { duration: "10s", target: SPIKE_PEAK_VUS },
      { duration: "10s", target: SPIKE_BASE_VUS },
    ],
    exec: "submitTransactions",
    startTime: "0s",
  };
}

export const options = {
  scenarios,
  thresholds: {
    http_req_duration: ["p(95)<3000"],
    http_req_failed: ["rate<0.05"],
  },
};

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function submitTransactions() {
  const merchant = pick(merchants);
  const payload = {
    txId: `LOAD-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    amount: merchant.includes("Unknown") || merchant.includes("Shell") ? 49500 : Math.floor(Math.random() * 6000) + 200,
    currency: "INR",
    merchant,
    merchantName: merchant,
    country: "IN",
    paymentMethod: pick(paymentMethods),
    memo: pick(memos),
    userEmail: "load@payshield.ai",
    userName: "Load Generator",
    suppressEmailAlerts: true,
    behavioralData: {
      typingCadenceDeviation: Math.random(),
      touchPressure: Math.random(),
      copyPasteRatio: Math.random() * 0.7,
    },
  };

  http.post(`${TARGET}/api/transactions/submit`, JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
  });
  sleep(TX_SLEEP_SECONDS);
}

export function sendBecEmail() {
  http.post(`${TARGET}/api/email/test-bec`, JSON.stringify({ scenario: "standard" }), {
    headers: { "Content-Type": "application/json" },
  });
}
