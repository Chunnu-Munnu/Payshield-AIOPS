import React from "react";

export default function ThemeProvider({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--color-ps-bg)", color: "var(--color-ps-text)", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--color-ps-bg); }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: var(--color-ps-surface); }
        ::-webkit-scrollbar-thumb { background: var(--color-ps-greenlt); border-radius: 2px; }
        @keyframes ping { 0% { transform: scale(1); opacity: 0.4; } 100% { transform: scale(2.2); opacity: 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fraudPulse { 0%,100% { opacity: 0.3; } 50% { opacity: 0.7; } }
        @keyframes drain { from { width: 100%; } to { width: 0%; } }
        @keyframes slide { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
        input, select { outline: none; font-family: 'DM Sans', sans-serif; }
        button { font-family: 'DM Sans', sans-serif; }
      `}</style>
      {children}
    </div>
  );
}
