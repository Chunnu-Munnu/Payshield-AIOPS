import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => (i === 0 ? "12a" : i < 12 ? `${i}a` : i === 12 ? "12p" : `${i - 12}p`));

function buildDemoTx() {
  const now = Date.now();
  const out = [];
  for (let i = 0; i < 200; i += 1) {
    const d = new Date(now - (i % 7) * 86400000);
    const day = i % 7;
    let hour = (i * 7) % 24;
    let fraudScore = 20 + (i % 20);

    const isWeekendPeak = (day === 5 || day === 6) && (hour >= 22 || hour <= 2);
    const isMondayPeak = day === 1 && hour >= 9 && hour <= 11;
    if (isWeekendPeak) {
      hour = [22, 23, 0, 1, 2][i % 5];
      fraudScore = 70 + (i % 30);
    } else if (isMondayPeak) {
      hour = [9, 10, 11][i % 3];
      fraudScore = 55 + (i % 25);
    }

    d.setHours(hour, (i * 13) % 60, 0, 0);
    out.push({ timestamp: d.toISOString(), fraudScore });
  }
  return out;
}

export default function RiskHeatmap({ transactions = [] }) {
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [mode, setMode] = useState("rate");
  const inputTx = transactions.length === 0 ? buildDemoTx() : transactions;

  const grid = useMemo(() => {
    return Array.from({ length: 7 }, (_, day) =>
      Array.from({ length: 24 }, (_, hour) => {
        const matches = inputTx.filter((tx) => {
          const d = new Date(tx.timestamp);
          return d.getDay() === day && d.getHours() === hour;
        });
        const total = matches.length;
        const fraudCount = matches.filter((tx) => (tx.fraudScore || 0) >= 70).length;
        return {
          total,
          fraudCount,
          rate: total > 0 ? fraudCount / total : 0,
          value: mode === "rate" ? (total > 0 ? fraudCount / total : 0) : Math.min(1, total / 10),
        };
      }),
    );
  }, [inputTx, mode]);

  return (
    <div style={{ background: "linear-gradient(135deg, #0d1117 0%, #0a0f1a 100%)", borderRadius: 20, padding: 20, border: "1px solid rgba(255,255,255,0.06)", fontFamily: "'JetBrains Mono', monospace", display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, letterSpacing: "0.12em", color: "#475569", textTransform: "uppercase" }}>Risk Heatmap</span>
        <div style={{ display: "flex", gap: 6 }}>
          {["rate", "volume"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                background: mode === m ? "#38bdf8" : "transparent",
                border: `1px solid ${mode === m ? "#38bdf8" : "rgba(255,255,255,0.08)"}`,
                color: mode === m ? "#020c14" : "#64748b",
                borderRadius: 999,
                padding: "4px 10px",
                fontSize: 10,
                cursor: "pointer",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "28px repeat(24, 1fr)", gap: 3, alignItems: "center" }}>
        <div />
        {HOURS.map((h, i) => (i % 3 === 0 ? <div key={h} style={{ fontSize: 8, color: "#475569", textAlign: "center", letterSpacing: "0.05em" }}>{h}</div> : <div key={h} />))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {grid.map((row, day) => (
          <div key={day} style={{ display: "grid", gridTemplateColumns: "28px repeat(24, 1fr)", gap: 3, alignItems: "center" }}>
            <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.05em", textAlign: "right", paddingRight: 4 }}>{DAYS[day]}</div>
            {row.map((cell, hour) => (
              <div
                key={hour}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setActiveTooltip({ day, hour, ...cell, left: rect.left, top: rect.top });
                }}
                onMouseLeave={() => setActiveTooltip(null)}
                style={{
                  height: 16,
                  borderRadius: 3,
                  background: cell.value > 0 ? `rgba(239, 68, 68, ${0.08 + cell.value * 0.82})` : "rgba(255,255,255,0.03)",
                  border: activeTooltip?.day === day && activeTooltip?.hour === hour ? "1px solid rgba(56,189,248,0.6)" : "1px solid transparent",
                  cursor: "crosshair",
                  transition: "background 0.15s",
                }}
              />
            ))}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {activeTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            style={{ position: "fixed", left: activeTooltip.left - 40, top: activeTooltip.top - 65, background: "#101827", color: "#e2e8f0", borderRadius: 8, padding: "8px 14px", fontSize: 11, pointerEvents: "none", zIndex: 100, whiteSpace: "nowrap", border: "1px solid rgba(56,189,248,0.2)", boxShadow: "0 10px 25px rgba(0,0,0,0.3)" }}
          >
            <div style={{ display: "flex", gap: 12 }}>
              <span style={{ fontWeight: 800, color: "#38bdf8" }}>{DAYS[activeTooltip.day]} {HOURS[activeTooltip.hour]}</span>
              <span>Tx: {activeTooltip.total}</span>
              <span>Fraud: {activeTooltip.fraudCount}</span>
              <span>Rate: {(activeTooltip.rate * 100).toFixed(0)}%</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 9, color: "#475569", letterSpacing: "0.08em" }}>LOW</span>
        <div style={{ display: "flex", gap: 2, flex: 1 }}>
          {[0.08, 0.22, 0.38, 0.54, 0.7, 0.86, 0.9].map((op, i) => <div key={i} style={{ flex: 1, height: 6, borderRadius: 2, background: `rgba(239,68,68,${op})` }} />)}
        </div>
        <span style={{ fontSize: 9, color: "#475569", letterSpacing: "0.08em" }}>HIGH</span>
      </div>
      <div style={{ fontSize: 10, color: "#64748b" }}>Forensic insight: peak risk density frequently manifests Fri/Sat 22:00-02:00</div>
    </div>
  );
}
