// FILE: components/TransactionCard.tsx
// ROLE: High-density forensic data node
// DESIGN: Obsidian Ledger (Clean White & Black)

import { useState } from 'react';
import ShapExplanation from './ShapExplanation';

export default function TransactionCard({ tx }: { tx: any }) {
  const [expanded, setExpanded] = useState(['block', 'quarantine'].includes(tx.decision));

  const isBlock = tx.decision === 'block';
  const isQuar = tx.decision === 'quarantine';
  const decisionLabel = tx.decision.toUpperCase();
  const severityWeight = isBlock ? 'font-black' : isQuar ? 'font-bold' : 'font-medium';

  return (
    <div className="brutalist-card rounded-2xl overflow-hidden bg-white">
      {/* Primary Node Header */}
      <div
        className="px-8 py-6 cursor-pointer flex items-center justify-between transition-colors hover:bg-neutral-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-12">
          <div className="w-[140px]">
            <div className="text-[9px] font-black tracking-[0.2em] text-neutral-300 mb-2 uppercase">Decision</div>
            <div className={`text-[11px] tracking-tight uppercase ${severityWeight} text-black`}>
              {decisionLabel}
            </div>
          </div>
          <div className="w-[120px]">
            <div className="text-[9px] font-black tracking-[0.2em] text-neutral-300 mb-2 uppercase">Risk Score</div>
            <div className={`text-2xl font-black tracking-tighter tabular-nums text-black ${tx.fraudScore > 70 ? 'underline decoration-4 underline-offset-4' : ''}`}>
              {tx.fraudScore}<span className="text-neutral-200 text-sm font-light ml-0.5">.00</span>
            </div>
          </div>
          <div className="w-[160px]">
             <div className="text-[9px] font-black tracking-[0.2em] text-neutral-300 mb-2 uppercase">Value (INR)</div>
             <div className="text-lg font-bold text-black tabular-nums">
               {tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
             </div>
          </div>
          <div className="w-[200px]">
             <div className="text-[9px] font-black tracking-[0.2em] text-neutral-300 mb-2 uppercase">Merchant Node</div>
             <div className="text-xs font-bold text-black truncate tracking-tight">
               {tx.merchant.toUpperCase()}
             </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 text-right">
          <div className="text-[10px] font-bold text-neutral-400 tabular-nums uppercase">
             {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
          </div>
          <div className="text-[9px] font-medium text-neutral-300 tracking-[0.1em] font-mono lowercase">
             REF_ID: {tx.txId}
          </div>
          {tx.blockchainTxHash && (
            <div className="flex items-center gap-2 mt-1">
               <div className="w-1 h-1 rounded-full bg-black"></div>
               <div className="text-[8px] font-black tracking-[0.3em] text-black uppercase">ledger_synced</div>
            </div>
          )}
        </div>
      </div>

      {/* Forensic Deep Dive Expansion */}
      {expanded && (
        <div className="border-t border-black/5 p-8 bg-neutral-50/50 backdrop-blur-3xl">
          <div className="grid grid-cols-[1fr_300px] gap-12">
            <div>
               <div className="text-[10px] font-black tracking-[0.2em] text-neutral-400 mb-6 uppercase">Pattern Diagnostics</div>
               <ShapExplanation explanation={tx.explanation} />
            </div>

            <div className="flex flex-col gap-6 border-l border-black/5 pl-10">
              <div className="text-[10px] font-black tracking-[0.2em] text-black uppercase">Model Synthesis</div>
              <div className="space-y-4">
                {tx.modelScores && Object.entries(tx.modelScores).map(([model, score]: [string, any]) => (
                  <div key={model} className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-end">
                       <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">{model}</span>
                       <span className="text-[10px] font-black text-black tabular-nums">{(score * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-0.5 w-full bg-neutral-100 overflow-hidden">
                       <div className="h-full bg-black" style={{ width: `${score * 100}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>

              {tx.blockchainTxHash && (
                <div className="mt-4">
                  <div className="text-[9px] font-black tracking-[0.2em] text-neutral-400 mb-2 uppercase">Ledger Address</div>
                  <div className="text-[9px] font-mono text-black break-all bg-white p-3 rounded-xl border border-black/5 shadow-sm leading-relaxed">
                    {tx.blockchainTxHash}
                  </div>
                </div>
              )}

              <div className="mt-4 flex justify-between items-center text-[9px] font-bold text-neutral-300 tracking-[0.1em]">
                 <span>INFERENCE: {tx.responseTimeMs}MS</span>
                 <span>PROT: {tx.isFallback ? 'L1_FALLBACK' : 'L2_ENSEMBLE'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
