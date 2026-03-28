// FILE: App.tsx
// ROLE: Root React component
// DESIGN: Obsidian Ledger (Clean White & Black)

import { useState, useEffect } from 'react';
import LiveDashboard from './components/LiveDashboard';

function App() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Attempt health check
    fetch('http://localhost:3002/health')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'ok') setConnected(true);
      })
      .catch(() => setConnected(false));
  }, []);

  return (
    <div className="min-h-screen bg-white text-black font-sans flex flex-col items-center">
      {/* Top Navigation / Header - Glassmorph Effect */}
      <header className="w-full glass-nav border-b border-black/5 sticky top-0 z-[100]">
        <div className="max-w-[1600px] w-full mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-black tracking-tighter text-black">
              PAYSHIELD<span className="font-light text-neutral-400">AI</span>
            </h1>
            <div className="h-6 w-[1px] bg-black/10"></div>
            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-[0.3em]">
              AUTONOMOUS FORENSIC INTELLIGENCE
            </span>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold tracking-widest text-neutral-400">ML STATUS</span>
              <div className="h-2 w-2 rounded-full bg-black"></div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold tracking-widest text-neutral-400">CHAIN LINK</span>
              <div className="h-2 w-2 rounded-full bg-neutral-200"></div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold tracking-widest text-neutral-400">NETWORK</span>
              <div className={`h-2 w-2 rounded-full animate-pulse ${connected ? 'bg-black' : 'bg-neutral-300'}`}></div>
            </div>
            <div className="h-6 w-[1px] bg-black/10"></div>
            <div className="text-[10px] font-bold text-neutral-500 tracking-tight">
              FOR JP MORGAN • {new Date().toISOString().split('T')[0]}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-[1600px] mx-auto p-8 flex-1 flex flex-col gap-8">
        <LiveDashboard />
      </main>
    </div>
  );
}

export default App;
