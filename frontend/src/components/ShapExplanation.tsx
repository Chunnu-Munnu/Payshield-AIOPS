// FILE: components/ShapExplanation.tsx
// ROLE: Visual rendering of SHAP values for model explainability
// DESIGN: Obsidian Ledger (Clean White & Black)

export default function ShapExplanation({ explanation }: { explanation: any }) {
  if (!explanation) return <div className="text-[10px] font-bold text-neutral-300 italic tracking-widest uppercase py-10">Diagnostic Data Unavailable.</div>;

  return (
    <div className="flex flex-col gap-8">
      <div className="bg-white/50 p-6 rounded-2xl border border-black/5 shadow-sm">
        <div className="text-[9px] font-black text-neutral-400 tracking-[0.2em] mb-3 uppercase">Analyst Synthesis</div>
        <div className="text-sm text-black font-medium leading-relaxed tracking-tight">
          {explanation.naturalLanguageExplanation}
        </div>
      </div>

      <div>
        <div className="text-[9px] font-black text-neutral-400 tracking-[0.2em] mb-4 uppercase">Risk Vectors (SHAP)</div>
        <div className="space-y-4">
          {explanation.topFeatures?.map((f: any, i: number) => {
            const isRisk = f.shap_value > 0;
            const barWidth = Math.min(100, Math.abs(f.shap_value) * 100);
            return (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex justify-between items-end text-[10px] font-bold">
                  <span className="text-neutral-500 uppercase tracking-tight">{f.humanReadable}</span>
                  <span className={`tabular-nums ${isRisk ? 'text-black' : 'text-neutral-300'}`}>
                    {isRisk ? '+' : ''}{f.shap_value.toFixed(2)}
                  </span>
                </div>
                <div className="h-1 w-full bg-neutral-50 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${isRisk ? 'bg-black' : 'bg-neutral-200'}`}
                    style={{
                      width: `${barWidth}%`,
                    }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
