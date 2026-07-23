"use client";

import { useState } from "react";

interface AgentLog {
  time: string;
  agent: string;
  action: string;
  detail: string;
}

export default function AgentsPage() {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<AgentLog[]>([]);

  const runSimulation = async () => {
    setRunning(true);
    setLogs([]);

    const steps: AgentLog[] = [
      { time: "00:00", agent: "Agent-A (Buyer)", action: "CREATE_AUCTION", detail: "Opened sealed-bid auction for 1000 FXRP compute credits" },
      { time: "00:02", agent: "Agent-B (Seller)", action: "COMMIT_BID", detail: "Committed hash 0x7f3a...c21e (amount hidden)" },
      { time: "00:03", agent: "Agent-C (Seller)", action: "COMMIT_BID", detail: "Committed hash 0xa91b...f44d (amount hidden)" },
      { time: "00:10", agent: "Agent-B (Seller)", action: "REVEAL_BID", detail: "Revealed bid: 950 FXRP" },
      { time: "00:11", agent: "Agent-C (Seller)", action: "REVEAL_BID", detail: "Revealed bid: 1020 FXRP" },
      { time: "00:12", agent: "Agent-A (Buyer)", action: "SETTLE", detail: "Winner: Agent-C at 1020 FXRP" },
      { time: "00:13", agent: "Enclave", action: "VERIFY_TERMS", detail: "Confidential Compute confirms both parties agreed to terms" },
      { time: "00:14", agent: "HushWireVault", action: "EXECUTE", detail: "Released 1020 FXRP from escrow → Agent-C" },
      { time: "00:14", agent: "Chain", action: "PROOF", detail: "Settlement proof on-chain. Terms remain private. ✓" },
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise((r) => setTimeout(r, 1200));
      setLogs((prev) => [...prev, steps[i]]);
    }

    setRunning(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Agent Simulator</h1>
      <p className="mt-1 text-sm text-gray-400">
        Watch agents negotiate privately and settle publicly on Flare
      </p>

      <button
        onClick={runSimulation}
        disabled={running}
        className="mt-6 rounded-lg bg-hush-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-hush-500 disabled:opacity-50"
      >
        {running ? "Running simulation..." : "▶ Run Negotiation Sim"}
      </button>

      {logs.length > 0 && (
        <div className="mt-8 glass-card overflow-hidden">
          <div className="border-b border-hush-900/30 px-4 py-3">
            <span className="text-xs font-medium text-gray-400">
              NEGOTIATION LOG — Sealed Bid → Reveal → Confidential Verify → Settle
            </span>
          </div>
          <div className="divide-y divide-hush-900/20">
            {logs.map((log, i) => (
              <div key={i} className="flex items-start gap-4 px-4 py-3">
                <span className="font-mono text-xs text-gray-600 w-12 shrink-0">
                  {log.time}
                </span>
                <span className="w-36 shrink-0 text-xs font-medium text-hush-300">
                  {log.agent}
                </span>
                <span className="w-32 shrink-0 rounded bg-hush-950 px-2 py-0.5 text-center text-[10px] font-mono text-hush-400">
                  {log.action}
                </span>
                <span className="text-xs text-gray-400">{log.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Architecture diagram */}
      <div className="mt-12 glass-card p-6">
        <h3 className="text-sm font-semibold text-gray-300">Flow</h3>
        <pre className="mt-4 text-xs text-gray-500 font-mono leading-relaxed overflow-x-auto">
{`Agent A (Buyer)                    Agent B/C (Sellers)
      │                                    │
      ├── CREATE AUCTION ──────────────────►│
      │                                    │
      │◄────────── COMMIT BID (hash) ──────┤  ← amount hidden
      │                                    │
      │         [commit deadline]          │
      │                                    │
      │◄────────── REVEAL BID ─────────────┤  ← amount shown
      │                                    │
      ├── SETTLE (pick winner) ───────────►│
      │                                    │
      │         ┌─────────────────┐        │
      │         │  FLARE ENCLAVE  │        │
      │         │  (Confidential  │        │
      │         │   Compute)      │        │
      │         │  verifies both  │        │
      │         │  agreed to same │        │
      │         │  terms PRIVATELY│        │
      │         └────────┬────────┘        │
      │                  │                 │
      │◄──── ATTESTATION PROOF ───────────►│
      │                                    │
      ├── HushWireVault.execute() ────────►│
      │   (releases FXRP from escrow)      │
      │                                    │
      ▼         ON-CHAIN PROOF             ▼
        Settlement public. Terms private.`}
        </pre>
      </div>
    </div>
  );
}
