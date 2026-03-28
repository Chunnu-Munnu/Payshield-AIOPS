import { useMemo, useState, useCallback } from "react";

const NODE_TYPES = {
  account: { color: "#3b82f6", label: "NODE_ACC" },
  merchant: { color: "#8b5cf6", label: "NODE_MERCH" },
  device: { color: "#06b6d4", label: "NODE_DEV" },
  ip: { color: "#10b981", label: "NODE_IP" },
};

const BASE_RING_NODES = [
  { id: "acc-mule-01", type: "account", fraudScore: 94, x: 120, y: 140, connectedToFraud: true, label: "ACC_MULE_01" },
  { id: "acc-mule-02", type: "account", fraudScore: 91, x: 200, y: 80, connectedToFraud: true, label: "ACC_MULE_02" },
  { id: "acc-mule-03", type: "account", fraudScore: 88, x: 280, y: 160, connectedToFraud: true, label: "ACC_MULE_03" },
  { id: "dev-stolen-01", type: "device", fraudScore: 94, x: 200, y: 200, connectedToFraud: true, label: "DEV_STOLEN_01" },
  { id: "merch-shell-01", type: "merchant", fraudScore: 85, x: 360, y: 120, connectedToFraud: true, label: "MERCH_SHELL_01" },
  { id: "ip-foreign-01", type: "ip", fraudScore: 0, x: 90, y: 240, connectedToFraud: true, label: "IP_FOREIGN_01" },
];

const BASE_RING_EDGES = [
  { from: "acc-mule-01", to: "merch-shell-01", score: 94, txId: "ring-1" },
  { from: "acc-mule-02", to: "merch-shell-01", score: 91, txId: "ring-2" },
  { from: "acc-mule-03", to: "merch-shell-01", score: 88, txId: "ring-3" },
  { from: "dev-stolen-01", to: "acc-mule-01", score: 94, txId: "ring-4" },
  { from: "dev-stolen-01", to: "acc-mule-02", score: 91, txId: "ring-5" },
  { from: "dev-stolen-01", to: "acc-mule-03", score: 88, txId: "ring-6" },
  { from: "ip-foreign-01", to: "acc-mule-01", score: 94, txId: "ring-7" },
];

function shortLabel(value, max = 15) {
  const text = String(value || "unknown");
  return text.length > max ? `${text.slice(0, max)}..` : text;
}

function shouldRenderLabel(node, totalNodes, isSelected) {
  if (isSelected) return true;
  if ((node.fraudScore || 0) >= 70) return true;
  if (node.connectedToFraud) return true;
  return totalNodes <= 12;
}

function buildGraph(transactions) {
  const nodes = new Map();
  const edges = [];
  const txList = transactions.slice(0, 40);

  txList.forEach((tx, i) => {
    const uid = tx.userId || `acc-${(tx.txId || `t-${i}`).slice(0, 8)}`;
    const mid = tx.merchant || `merchant-${i}`;
    const did = tx.deviceId || `dev-${(tx.txId || `d-${i}`).slice(0, 6)}`;
    const ipid = tx.ipAddress || `ip-${tx.country || "IN"}-${i % 4}`;
    const suspicious = (tx.fraudScore || 0) >= 70;

    if (!nodes.has(uid)) nodes.set(uid, { id: uid, type: "account", fraudScore: tx.fraudScore || 0, connectedToFraud: false, label: shortLabel(uid) });
    if (!nodes.has(mid)) nodes.set(mid, { id: mid, type: "merchant", fraudScore: suspicious ? (tx.fraudScore || 0) : 0, connectedToFraud: false, label: shortLabel(mid) });
    if (!nodes.has(did)) nodes.set(did, { id: did, type: "device", fraudScore: suspicious ? (tx.fraudScore || 0) : 0, connectedToFraud: false, label: shortLabel(did) });
    if (!nodes.has(ipid)) nodes.set(ipid, { id: ipid, type: "ip", fraudScore: 0, connectedToFraud: false, label: shortLabel(ipid) });

    edges.push({ from: uid, to: mid, score: tx.fraudScore || 0, txId: tx.txId || `edge-${i}` });
    edges.push({ from: did, to: uid, score: tx.fraudScore || 0, txId: `${tx.txId || `edge-${i}`}-d` });
    edges.push({ from: ipid, to: uid, score: tx.fraudScore || 0, txId: `${tx.txId || `edge-${i}`}-i` });

    if (suspicious) {
      nodes.get(uid).fraudScore = Math.max(nodes.get(uid).fraudScore, tx.fraudScore || 0);
      nodes.get(mid).connectedToFraud = true;
      nodes.get(did).connectedToFraud = true;
      nodes.get(ipid).connectedToFraud = true;
    }
  });

  if (nodes.size < 5) {
    BASE_RING_NODES.forEach((node) => nodes.set(node.id, { ...node }));
    BASE_RING_EDGES.forEach((edge) => edges.push({ ...edge }));
  }

  const nodeArr = Array.from(nodes.values());
  nodeArr.forEach((node, i) => {
    if (typeof node.x !== "number" || typeof node.y !== "number") {
      const angle = (i / Math.max(nodeArr.length, 1)) * Math.PI * 2;
      node.x = 240 + 140 * Math.cos(angle);
      node.y = 150 + 95 * Math.sin(angle);
    }
  });

  return { nodes: nodeArr, edges };
}

export default function NetworkGraph({ transactions = [], selectedTransaction }) {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("All");
  const focusTxId = selectedTransaction?.txId;
  const { nodes, edges } = useMemo(() => buildGraph(transactions), [transactions, focusTxId]);

  const filteredNodes = useMemo(() => {
    if (filter === "Fraud") return nodes.filter((n) => (n.fraudScore || 0) >= 70 || n.connectedToFraud);
    return nodes;
  }, [nodes, filter]);
  const filteredIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  const getNodeColor = useCallback((node) => {
    if ((node.fraudScore || 0) >= 70) return "#ef4444";
    if (node.connectedToFraud) return "#f59e0b";
    return NODE_TYPES[node.type]?.color || "#d4d4d4";
  }, []);

  const selectedNode = selected ? nodes.find((n) => n.id === selected) : null;
  const connectedTxs = selectedNode ? transactions.filter((tx) => tx.userId === selectedNode.id || tx.merchant === selectedNode.id || tx.deviceId === selectedNode.id).slice(0, 4) : [];
  const hasFraudNodes = nodes.some((n) => (n.fraudScore || 0) >= 70);
  const activeFocus = selectedTransaction || transactions[0] || null;

  return (
    <div className="ps-card p-8 flex flex-col gap-8 flex-1">
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold" style={{color:'var(--color-ps-muted)'}}>Graph Observability</span>
          <div className="text-xs" style={{color:'var(--color-ps-muted)'}}>Interactive Network Topology</div>
        </div>
        <div className="flex gap-2">
          {["All", "Anomaly"].map((f) => (
            <button 
              key={f} 
              onClick={() => setFilter(f === "Anomaly" ? "Fraud" : "All")} 
              className="px-6 py-2 rounded-full text-xs font-semibold transition-all duration-300"
              style={filter === (f === "Anomaly" ? "Fraud" : "All")
                ? {background:'var(--color-ps-text)',color:'var(--color-ps-accent)'}
                : {background:'var(--color-ps-surface)',color:'var(--color-ps-muted)'}
              }
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div
        className="border rounded-2xl px-4 py-3 flex items-center justify-between gap-4"
        style={{ background: "rgba(255,255,255,0.03)", borderColor: "var(--color-ps-outline)" }}
      >
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black tracking-[0.12em] uppercase" style={{ color: "var(--color-ps-muted)" }}>
            What This Graph Means
          </span>
          <span className="text-[11px]" style={{ color: "var(--color-ps-text)" }}>
            Blue is the account hub. Purple merchants, green IPs, cyan devices. Red/orange nodes mark the suspicious cluster around the currently risky payment.
          </span>
        </div>
        {activeFocus && (
          <div className="text-right">
            <div className="text-[10px] font-black tracking-[0.1em] uppercase" style={{ color: "var(--color-ps-muted)" }}>Current Focus</div>
            <div className="text-[12px] font-bold" style={{ color: "var(--color-ps-text)" }}>
              {activeFocus.merchant || activeFocus.merchantName || "Unknown merchant"} | Score {activeFocus.fraudScore ?? 0}
            </div>
          </div>
        )}
      </div>

      <div className="relative rounded-[24px] overflow-hidden border min-h-[400px]" style={{background:'var(--color-ps-surface)',borderColor:'var(--color-ps-outline)'}}>
        <svg viewBox="0 0 480 300" className="w-full h-full">
          {hasFraudNodes && (
            <text x="24" y="32" className="fill-red-500 font-black text-[10px] tracking-[0.2em] uppercase">
              HIGH_RISK_CLUSTER_DETECTED
            </text>
          )}

          {edges.filter((e) => filteredIds.has(e.from) && filteredIds.has(e.to)).map((edge, i) => {
            const from = nodes.find((n) => n.id === edge.from);
            const to = nodes.find((n) => n.id === edge.to);
            if (!from || !to) return null;
            const isFraud = (edge.score || 0) >= 70;
            return (
              <line
                key={`${edge.txId}-${i}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={isFraud ? "#ef4444" : "var(--color-ps-text)"}
                strokeWidth={isFraud ? 2 : 0.4}
                strokeOpacity={isFraud ? 1 : 0.15}
                strokeDasharray={isFraud ? "none" : "2 2"}
              />
            );
          })}

          {filteredNodes.map((node) => {
            const color = getNodeColor(node);
            const isFraud = (node.fraudScore || 0) >= 70;
            const isSelected = selected === node.id;
            const r = isFraud ? 12 : 8;
            const showLabel = shouldRenderLabel(node, filteredNodes.length, isSelected);
            return (
              <g key={node.id} className="cursor-pointer" onClick={() => setSelected(selected === node.id ? null : node.id)}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isSelected ? r + 3 : r}
                  fill={color}
                  stroke={isSelected ? "var(--color-ps-text)" : "none"}
                  strokeWidth={2}
                  className="transition-all duration-300"
                  style={{ filter: isFraud ? "drop-shadow(0 0 8px rgba(239,68,68,0.4))" : "none" }}
                />
                {showLabel && (
                  <text
                    x={node.x}
                    y={node.y + r + 12}
                    textAnchor="middle"
                    className={`font-bold tracking-tight uppercase ${isFraud ? "fill-red-500" : "fill-neutral-400"}`}
                    style={{ fontSize: isSelected ? 10 : 7, opacity: isSelected ? 1 : 0.82 }}
                  >
                    {shortLabel(node.label, isSelected ? 16 : 10)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {selectedNode && (
        <div className="border rounded-2xl p-6 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2"
             style={{background:'var(--color-ps-card)',borderColor:'var(--color-ps-outline)'}}>
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-black tracking-tight" style={{color:'var(--color-ps-text)'}}>{selectedNode.id}</span>
            <span className="text-[9px] font-black tracking-[0.2em] uppercase px-3 py-1 rounded-full border"
                  style={{background:'var(--color-ps-surface)',color:'var(--color-ps-muted)',borderColor:'var(--color-ps-outline)'}}>
              {selectedNode.type}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {connectedTxs.map((tx) => (
              <div key={tx.txId} className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0"
                   style={{borderColor:'var(--color-ps-outline)'}}>
                <span className="text-[10px] font-medium tabular-nums" style={{color:'var(--color-ps-muted)'}}>
                  ID: {String(tx.txId || "").slice(0, 12)}...
                </span>
                <span className={`text-[10px] font-black tabular-nums ${tx.fraudScore >= 70 ? 'text-red-500' : ''}`}
                      style={tx.fraudScore < 70 ? {color:'var(--color-ps-text)'} : {}}>
                  {tx.fraudScore}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-8 flex-wrap border-t pt-8" style={{borderColor:'var(--color-ps-outline)'}}>
        {Object.entries(NODE_TYPES).map(([type, { color, label }]) => (
          <div key={type} className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full border border-black/10 shadow-sm" style={{ background: color }} />
            <span className="text-[9px] font-black tracking-[0.1em] uppercase" style={{color:'var(--color-ps-muted)'}}>{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-500 shadow-lg shadow-red-500/20" />
          <span className="text-[9px] font-black tracking-[0.1em] uppercase" style={{color:'var(--color-ps-text)'}}>Anomaly node</span>
        </div>
      </div>
    </div>
  );
}
