import { Link, useLocation } from "react-router-dom";
import useFraudStore from "../../store/fraudStore";

function Dot({ active, color = "#22d3ee" }) {
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: active ? color : "#475569",
        boxShadow: active ? `0 0 10px ${color}` : "none",
        display: "inline-block",
      }}
    />
  );
}

export default function Navbar({
  onStartReviewFlow,
  reviewFlowRunning,
  wsConnected,
  gmailConnected,
  statusText,
  actionLabel,
}) {
  const txCount = useFraudStore((state) => state.transactions.length);
  const location = useLocation();
  const isObservability = location.pathname === "/observability";
  const defaultStatusText = isObservability
    ? "6 services monitored"
    : `${txCount.toLocaleString()} transactions screened`;
  const primaryActionLabel = actionLabel || (isObservability ? "Run RCA Demo" : "Launch Review Flow");

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 20px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        position: "sticky",
        top: 0,
        backdropFilter: "blur(10px)",
        background: "rgba(10,13,20,0.95)",
        zIndex: 20,
      }}
    >
      <style>{`
        @keyframes navbarSlide {
          0%,100% { background-position: 0% 50%; opacity: 0.6; }
          50% { background-position: 100% 50%; opacity: 1; }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ color: "#38bdf8", fontSize: 24, fontWeight: 800, letterSpacing: "0.08em" }}>PAYSHIELD AI</div>
        <div style={{ color: "#64748b", fontSize: 11, letterSpacing: "0.08em" }}>AUTONOMOUS FRAUD INTELLIGENCE NETWORK</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link
            to="/"
            style={{
              color: location.pathname === "/" ? "#38bdf8" : "#94a3b8",
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Fraud Ops
          </Link>
          <Link
            to="/observability"
            style={{
              color: isObservability ? "#38bdf8" : "#94a3b8",
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Observability
          </Link>
          <span style={{ color: "#334155", fontSize: 10 }}>{statusText || defaultStatusText}</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#94a3b8" }}>
          <Dot active={wsConnected} />
          WS {wsConnected ? "CONNECTED" : "DISCONNECTED"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: gmailConnected ? "#22c55e" : "#94a3b8" }}>
          <Dot active={gmailConnected} color="#22c55e" />
          Gmail {gmailConnected ? "CONNECTED" : "DISCONNECTED"}
        </div>
        <button
          onClick={onStartReviewFlow}
          disabled={reviewFlowRunning}
          style={
            reviewFlowRunning
              ? {
                  background: "#1e293b",
                  color: "#94a3b8",
                  cursor: "not-allowed",
                  border: "none",
                  padding: "11px 16px",
                  borderRadius: 12,
                  fontWeight: 800,
                }
              : {
                  background: "#38bdf8",
                  color: "#04131b",
                  padding: "11px 16px",
                  borderRadius: 12,
                  border: "none",
                  fontWeight: 800,
                  cursor: "pointer",
                }
          }
        >
          {reviewFlowRunning ? "Demo Running..." : primaryActionLabel}
        </button>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 1,
          background: "linear-gradient(90deg, transparent, #38bdf8, #22d3ee, transparent)",
          backgroundSize: "200% 100%",
          animation: "navbarSlide 3s ease-in-out infinite",
        }}
      />
    </div>
  );
}
