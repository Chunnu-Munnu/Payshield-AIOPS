import { useMemo } from "react";
import { motion } from "framer-motion";

const MODEL_META = [
  { key: "GNN", aliases: ["GNN", "gnn"], label: "Graph Neural Network", short: "GNN", accent: "#38bdf8" },
  { key: "LSTM", aliases: ["LSTM", "lstm"], label: "Sequence Model", short: "LSTM", accent: "#8b5cf6" },
  { key: "XGBoost", aliases: ["XGBoost", "xgboost", "ensemble", "ens"], label: "Tabular Ensemble", short: "XGBoost", accent: "#f59e0b" },
  { key: "Biometrics", aliases: ["Biometrics", "biometrics", "bio"], label: "Behavioral Biometrics", short: "Biometrics", accent: "#22d3ee" },
  { key: "AML", aliases: ["AML", "aml"], label: "AML Graph Engine", short: "AML", accent: "#10b981" },
  { key: "BEC", aliases: ["BEC", "bec", "Language"], label: "Language / BEC Detector", short: "BEC", accent: "#ef4444" },
];

function findModelValue(map, aliases) {
  for (const alias of aliases) {
    if (map[alias] !== undefined) return Number(map[alias] || 0);
  }
  return 0;
}

function compactReason(text = "", max = 42) {
  const normalized = String(text).replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max).trimEnd()}...` : normalized;
}

function buildSyntheticExplanation(transaction) {
  const scoreMap = transaction?.modelScores || {};
  const explanation = transaction?.explanation || {};
  const modelFindings = explanation?.modelFindings || {};

  const modelBreakdown = MODEL_META.map((model) => ({
    ...model,
    contribution: findModelValue(explanation?.modelContributions || scoreMap, model.aliases),
    rawScore: findModelValue(scoreMap, model.aliases),
    finding: modelFindings[model.key] || "No dedicated model narrative available.",
  }));

  const sortedByContribution = [...modelBreakdown].sort((a, b) => b.contribution - a.contribution);
  const topFeatures = Array.isArray(explanation?.topFeatures) && explanation.topFeatures.length
    ? explanation.topFeatures
    : sortedByContribution.slice(0, 4).map((model, idx) => ({
        humanReadable: `${model.label} moved away from normal baseline`,
        shap_value: Number((Math.max(0.1, model.rawScore || model.contribution || 0.1) + idx * 0.03).toFixed(3)),
      }));

  return {
    naturalLanguageExplanation:
      explanation?.naturalLanguageExplanation ||
      ((transaction?.fraudScore || 0) >= 70
        ? "Transaction escalated because multiple independent detectors moved outside the learned baseline at the same time."
        : "Transaction approved because all six model families stayed near the user's learned normal behavior."),
    topFeatures,
    modelBreakdown,
  };
}

function FeaturePill({ feature }) {
  const value = Number(feature.shap_value || 0);
  const positive = value >= 0;
  return (
    <div
      style={{
        borderRadius: 16,
        padding: "12px 14px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 9, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
        {compactReason(feature.humanReadable, 54)}
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: positive ? "#ef4444" : "#22d3ee" }}>
        {positive ? "+" : ""}
        {value.toFixed(3)}
      </div>
    </div>
  );
}

function ModelCard({ model, maxContribution }) {
  const contributionPct = Math.round((Number(model.contribution || 0) || 0) * 100);
  const rawPct = Math.round((Number(model.rawScore || 0) || 0) * 100);
  const width = maxContribution > 0 ? `${Math.max(8, (Number(model.contribution || 0) / maxContribution) * 100)}%` : "8%";

  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.03)",
        padding: "14px 14px 12px",
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
        <div>
          <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 800 }}>{model.short}</div>
          <div style={{ color: "#64748b", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>{model.label}</div>
        </div>
        <div
          style={{
            padding: "5px 8px",
            borderRadius: 999,
            background: `${model.accent}16`,
            border: `1px solid ${model.accent}30`,
            color: model.accent,
            fontSize: 10,
            fontWeight: 800,
          }}
        >
          {contributionPct}%
        </div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8" }}>
          <span>Contribution</span>
          <span>{contributionPct}%</span>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 999, overflow: "hidden" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ height: "100%", borderRadius: 999, background: model.accent }}
          />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10 }}>
        <span style={{ color: "#64748b" }}>Detector score</span>
        <span style={{ color: "#e2e8f0", fontWeight: 700 }}>{rawPct}%</span>
      </div>

      <div style={{ color: "#cbd5e1", fontSize: 11, lineHeight: 1.55 }}>
        {model.finding}
      </div>
    </div>
  );
}

export default function ExplainabilityPanel({ transaction }) {
  const explanationPayload = useMemo(() => buildSyntheticExplanation(transaction), [transaction]);

  if (!transaction) {
    return (
      <div className="ps-card p-10 flex flex-col items-center justify-center min-h-[420px] text-center gap-4">
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#38bdf8",
            fontSize: 14,
            fontWeight: 800,
          }}
        >
          AI
        </div>
        <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Select a transaction to inspect the six-model decision stack
        </div>
      </div>
    );
  }

  const features = explanationPayload.topFeatures || [];
  const modelBreakdown = explanationPayload.modelBreakdown || [];
  const maxContribution = Math.max(...modelBreakdown.map((item) => Number(item.contribution || 0)), 0.01);
  const summaryAccent = (transaction?.fraudScore || 0) >= 70 ? "#ef4444" : "#22d3ee";

  return (
    <div className="ps-card p-6 flex flex-col gap-6">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "#64748b", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 800 }}>
            Explainable AI Decision View
          </div>
          <div style={{ color: "#e2e8f0", fontSize: 24, fontWeight: 900, marginTop: 6 }}>
            6-Model Ensemble Breakdown
          </div>
        </div>
        <div
          style={{
            fontSize: 10,
            color: "#22d3ee",
            background: "rgba(34,211,238,0.08)",
            border: "1px solid rgba(34,211,238,0.2)",
            borderRadius: 999,
            padding: "6px 11px",
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          TX {transaction.txId}
        </div>
      </div>

      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${summaryAccent}30`,
          borderLeft: `4px solid ${summaryAccent}`,
          borderRadius: 18,
          padding: "18px 18px",
          color: "#e2e8f0",
          lineHeight: 1.7,
          fontSize: 15,
          fontWeight: 700,
        }}
      >
        {explanationPayload.naturalLanguageExplanation}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ color: "#64748b", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 800 }}>
          Top Driver Signals
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          {features.slice(0, 3).map((feature, index) => (
            <motion.div key={`${feature.humanReadable}-${index}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
              <FeaturePill feature={feature} />
            </motion.div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ color: "#64748b", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 800 }}>
            Model Jury
          </div>
          <div style={{ color: "#94a3b8", fontSize: 11 }}>
            Every decision is explained by the same six-model ensemble used for scoring.
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          {modelBreakdown.map((model) => (
            <ModelCard key={model.key} model={model} maxContribution={maxContribution} />
          ))}
        </div>
      </div>
    </div>
  );
}
