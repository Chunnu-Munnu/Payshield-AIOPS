import { useEffect } from "react";
import useFraudStore from "../store/fraudStore";

export default function useWebSocket() {
  const addTransaction = useFraudStore((state) => state.addTransaction);
  const updateTransaction = useFraudStore((state) => state.updateTransaction);
  const pushToast = useFraudStore((state) => state.pushToast);
  const addEmailFeedItem = useFraudStore((state) => state.addEmailFeedItem);
  const mergeEmailFeedItem = useFraudStore((state) => state.mergeEmailFeedItem);
  const addSmsFeedItem = useFraudStore((state) => state.addSmsFeedItem);
  const setGmailConnected = useFraudStore((state) => state.setGmailConnected);
  const setWsConnected = useFraudStore((state) => state.setWsConnected);

  useEffect(() => {
    const socket = new WebSocket(import.meta.env.VITE_WS_URL || "ws://localhost:3001");
    socket.onopen = () => setWsConnected(true);
    socket.onclose = () => setWsConnected(false);
    socket.onerror = () => setWsConnected(false);
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      switch (payload.type) {
        case "CONNECTED":
          setWsConnected(true);
          break;
        case "NEW_TRANSACTION":
          if (["MANUAL", "RESILIENCE", "LIVE_WEBHOOK"].includes(payload.data?.source)) {
            addTransaction(payload.data);
          }
          if ((payload.data?.fraudScore || 0) >= 70 && ["MANUAL", "RESILIENCE", "LIVE_WEBHOOK"].includes(payload.data?.source)) {
            pushToast({
              toastId: payload.data.txId,
              kind: "transaction",
              title: "Suspicious transaction flagged",
              txId: payload.data.txId,
              amount: payload.data.amount,
              currency: payload.data.currency,
              merchant: payload.data.merchant,
              fraudScore: payload.data.fraudScore,
              explanation: payload.data.explanation,
            });
          }
          break;
        case "GMAIL_MONITOR_STATUS":
          setGmailConnected(payload.status === "CONNECTED");
          break;
        case "GMAIL_EMAIL_RECEIVED":
          addEmailFeedItem({ ...payload, status: "SCANNING" });
          break;
        case "GMAIL_EMAIL_SCORED":
          mergeEmailFeedItem(payload.subject, payload.from, payload);
          if ((payload.fraudScore || 0) >= 70) {
            pushToast({
              toastId: `${payload.subject}-${payload.timestamp}`,
              kind: "email",
              title: "BEC email detected",
              txId: payload.subject,
              amount: 0,
              currency: "INR",
              merchant: payload.from,
              fraudScore: payload.fraudScore,
              explanation: { topFeatures: (payload.flaggedPhrases || []).map((item) => ({ humanReadable: item })) },
            });
          }
          break;
        case "LIVE_SMS_RECEIVED":
          addSmsFeedItem(payload);
          break;
        case "LIVE_SMS_SCORED":
          addSmsFeedItem(payload);
          break;
        case "BLOCKCHAIN_LOGGED":
          updateTransaction(payload.txId, { blockchainTxHash: payload.hash });
          break;
        default:
          break;
      }
    };
    return () => socket.close();
  }, [addEmailFeedItem, addSmsFeedItem, addTransaction, mergeEmailFeedItem, pushToast, setGmailConnected, setWsConnected, updateTransaction]);
}
