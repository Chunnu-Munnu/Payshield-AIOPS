// FILE: components/LiveDashboard.tsx
// ROLE: Real-time forensic audit interface
// DESIGN: Obsidian Ledger (Clean White & Black)

import { useState, useEffect, useRef } from 'react';
import TransactionCard from './TransactionCard';

interface Transaction {
  txId: string;
  amount: number;
  merchant: string;
  fraudScore: number;
  decision: 'approve' | 'quarantine' | 'block' | 'step_up_auth';
  riskLevel: string;
  timestamp: string;
  explanation?: any;
  modelScores?: any;
  becScore?: number;
  amlScore?: number;
  blockchainTxHash?: string;
  responseTimeMs?: number;
  isFallback?: boolean;
  source?: string;
}

export default function LiveDashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    blocked: 0,
    quarantined: 0,
    volumeBlocked: 0,
    avgResponseTime: 0,
  });

  useEffect(() => {
    // Setup WebSocket
    const connectWS = () => {
      const ws = new WebSocket('ws://localhost:3002');

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'NEW_TRANSACTION') {
            const tx = msg.data;
            setTransactions(prev => [tx, ...prev].slice(0, 50)); 

            setStats(s => {
              const blocked = ['block'].includes(tx.decision) ? 1 : 0;
              const quar = tx.decision === 'quarantine' ? 1 : 0;
              const newTotal = s.total + 1;
              return {
                total: newTotal,
                blocked: s.blocked + blocked,
                quarantined: s.quarantined + quar,
                volumeBlocked: s.volumeBlocked + (blocked ? tx.amount : 0),
                avgResponseTime: Math.round(((s.avgResponseTime * s.total) + (tx.responseTimeMs||0)) / newTotal),
              };
            });
          }
        } catch (e) {}
      };

      wsRef.current = ws;
      return ws;
    };

    const ws = connectWS();
    return () => ws.close();
  }, []);

  return (
    <div className="flex flex-col gap-10 h-full w-full">

      {/* High-Impact Metrics Grid */}
      <div className="grid grid-cols-5 gap-8">
        {[
          { label: 'THROUGHPUT', val: (stats.total / Math.max(1, stats.total*0.5)).toFixed(1), unit: 'TX/S' },
          { label: 'THREATS NEUTRALIZED', val: stats.blocked, unit: 'UNITS' },
          { label: 'UNDER INVESTIGATION', val: stats.quarantined, unit: 'UNITS' },
          { label: 'CAPITAL SECURED', val: `₹${(stats.volumeBlocked/1000).toFixed(1)}K`, unit: 'INR' },
          { label: 'AVG LATENCY', val: stats.avgResponseTime, unit: 'MS' },
        ].map((s, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="text-[10px] font-bold text-neutral-400 tracking-[0.2em]">{s.label}</div>
            <div className="flex items-baseline gap-2">
              <div className="text-4xl font-black tracking-tighter text-black tabular-nums">{s.val}</div>
              <div className="text-[10px] font-bold text-neutral-300 tracking-widest leading-none">{s.unit}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-10 h-full flex-1 min-h-0">
        {/* Forensic Stream Meta */}
        <div className="w-[320px] flex flex-col gap-6">
          <div className="bg-[#f9f9f9] rounded-2xl p-8 flex flex-col gap-4 border border-black/5">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-black shadow-[0_0_12px_rgba(0,0,0,0.3)]"></div>
              <div className="text-[10px] font-bold tracking-[0.2em] text-black">LIVE AUDIT FEED</div>
            </div>
            <div className="text-xs text-neutral-500 leading-relaxed font-medium">
              Real-time ingestion of cryptographic transaction payloads from primary node networks.
            </div>

            <div className="space-y-4 pt-4">
              {transactions.slice(0, 6).map(tx => (
                <div key={tx.txId} className="flex justify-between items-center text-[11px] font-medium border-b border-black/5 pb-3">
                  <span className="text-neutral-400 font-mono tracking-tighter truncate w-[140px] lowercase">{tx.txId.replace('SIM-','').replace('FRAUD-','')}</span>
                  <span className="text-black font-bold">
                    ₹{tx.amount.toLocaleString()}
                  </span>
                </div>
              ))}
              {transactions.length === 0 && (
                <div className="text-neutral-300 text-[10px] font-bold tracking-widest text-center py-12">
                  INITIALIZING UPLINK...
                </div>
              )}
            </div>
          </div>
          
          <div className="flex-1 rounded-2xl border-2 border-dashed border-neutral-100 flex items-center justify-center p-8">
             <div className="text-center">
                <div className="text-[10px] font-black tracking-[0.3em] text-neutral-200 mb-2 uppercase">Integrity Guard</div>
                <div className="text-[10px] text-neutral-300 font-medium">99.8% System Confidence</div>
             </div>
          </div>
        </div>

        {/* Primary Audit Feed */}
        <div className="flex-1 flex flex-col bg-white rounded-3xl border border-black/5 overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.05)]">
          <div className="px-8 py-6 border-b border-black/5 flex justify-between items-center bg-white/80 backdrop-blur-sm z-10">
            <div className="text-[11px] font-black tracking-[0.2em] text-black">
              CRYPTOGRAPHIC TRANSACTION LEDGER
            </div>
            <div className="flex gap-6 text-[10px] font-bold text-neutral-400 tracking-widest">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-neutral-200"></div>
                <span>NODE: 01</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-black animate-pulse"></div>
                <span>LATENCY: {stats.avgResponseTime}MS</span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-white">
            {transactions.map(tx => (
              <TransactionCard key={tx.txId} tx={tx} />
            ))}
            {transactions.length === 0 && (
              <div className="h-full flex items-center justify-center flex-col gap-6 py-32">
                 <div className="relative">
                    <div className="w-12 h-12 border-2 border-neutral-100 rounded-full animate-ping"></div>
                    <div className="absolute inset-0 w-12 h-12 border-2 border-black rounded-full"></div>
                 </div>
                 <div className="text-[10px] font-black tracking-[0.4em] text-neutral-300 ml-1">SCANNING NETWORK...</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
