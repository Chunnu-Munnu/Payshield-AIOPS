import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import useFraudStore from "../../store/fraudStore";

function resolveToastStyle(toast) {
  const decision = String(toast.decision || "").toLowerCase();
  if (toast.kind === "email") return { border: "1px solid rgba(56,189,248,0.4)", accent: "#38bdf8", icon: "✉", source: "GMAIL_LIVE" };
  if (decision === "block") return { border: "1px solid rgba(239,68,68,0.4)", accent: "#ef4444", icon: "✗", source: toast.source || "MANUAL" };
  if (decision === "quarantine") return { border: "1px solid rgba(245,158,11,0.4)", accent: "#f59e0b", icon: "⚠", source: toast.source || "MANUAL" };
  return { border: "1px solid rgba(34,211,238,0.2)", accent: "#22d3ee", icon: "✓", source: toast.source || "MANUAL" };
}

export default function AlertNotificationToast() {
  const toasts = useFraudStore((state) => state.toasts);
  const removeToast = useFraudStore((state) => state.removeToast);
  const setSelectedTransaction = useFraudStore((state) => state.setSelectedTransaction);

  useEffect(() => {
    const timers = toasts.map((toast) => setTimeout(() => removeToast(toast.toastId || toast.txId), 7000));
    return () => timers.forEach(clearTimeout);
  }, [toasts, removeToast]);

  return (
    <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 50, display: "flex", flexDirection: "column", gap: 10 }}>
      <style>{`@keyframes drain { from { width: 100%; } to { width: 0%; } }`}</style>
      <AnimatePresence>
        {toasts.map((toast) => {
          const style = resolveToastStyle(toast);
          return (
            <motion.div key={toast.toastId || toast.txId} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} style={{ width: 340, background: "#ffffff", border: style.border, borderRadius: 16, padding: 14, position: "relative", overflow: "hidden", boxShadow: "0 8px 32px rgba(45,106,79,0.15)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ color: style.accent, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{style.icon}</span>
                  <span style={{ color: "#1a2e1f" }}>{toast.title || "PayShield event"}</span>
                </div>
                <span style={{ fontSize: 9, color: style.accent, border: `1px solid ${style.accent}66`, borderRadius: 999, padding: "2px 7px" }}>{style.source}</span>
              </div>
              <div style={{ marginTop: 6, color: "#6b8f71", fontSize: 12 }}>{toast.merchant || "PayShield"} • ₹{Number(toast.amount || 0).toLocaleString("en-IN")} • {toast.fraudScore || 0}/100</div>
              <div style={{ marginTop: 6, color: "#8aaa8e", fontSize: 11 }}>{toast.explanation?.topFeatures?.[0]?.humanReadable || "Live event received from the PayShield pipeline."}</div>
              {toast.kind === "transaction" && (
                <button onClick={() => setSelectedTransaction(toast)} style={{ marginTop: 10, background: "#1a2e1f", color: "#c8f135", border: "none", borderRadius: 10, padding: "8px 10px", fontWeight: 700, cursor: "pointer" }}>
                  View Details
                </button>
              )}
              <div style={{ position: "absolute", left: 0, bottom: 0, height: 2, width: "100%", background: style.accent, transformOrigin: "left", animation: "drain 7s linear forwards" }} />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
