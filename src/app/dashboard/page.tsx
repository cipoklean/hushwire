"use client";

import { useState, useEffect } from "react";

interface Settlement {
  id: number;
  payer: string;
  payee: string;
  amount: string;
  asset: string;
  status: "escrowed" | "executed" | "refunded";
  timestamp: string;
}

interface Auction {
  id: number;
  creator: string;
  asset: string;
  reservePrice: string;
  bidders: number;
  phase: "commit" | "reveal" | "settled";
}

export default function DashboardPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In production: fetch from chain via ethers.js
    // For demo: simulated data
    setTimeout(() => {
      setSettlements([
        {
          id: 0,
          payer: "0xAgent...A1f3",
          payee: "0xAgent...9c2E",
          amount: "1,250 FXRP",
          asset: "FXRP",
          status: "executed",
          timestamp: "2 min ago",
        },
        {
          id: 1,
          payer: "0xAgent...7b4D",
          payee: "0xAgent...e8F1",
          amount: "800 FXRP",
          asset: "FXRP",
          status: "escrowed",
          timestamp: "5 min ago",
        },
      ]);
      setAuctions([
        {
          id: 0,
          creator: "0xAgent...A1f3",
          asset: "FXRP",
          reservePrice: "500",
          bidders: 3,
          phase: "reveal",
        },
        {
          id: 1,
          creator: "0xAgent...e8F1",
          asset: "FXRP",
          reservePrice: "1000",
          bidders: 2,
          phase: "commit",
        },
      ]);
      setLoading(false);
    }, 800);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="pulse-dot h-3 w-3 rounded-full bg-hush-400" />
        <span className="ml-3 text-gray-400">Loading chain state...</span>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Settlement Dashboard</h1>
      <p className="mt-1 text-sm text-gray-400">
        Live view of HushWire negotiations and settlements on Coston2
      </p>

      {/* Stats Row */}
      <div className="mt-8 grid grid-cols-4 gap-4">
        {[
          { label: "Total Settlements", value: settlements.length.toString() },
          { label: "Active Auctions", value: auctions.length.toString() },
          { label: "Volume (FXRP)", value: "2,050" },
          { label: "Agents Connected", value: "4" },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-4">
            <p className="text-2xl font-bold text-hush-300">{stat.value}</p>
            <p className="mt-1 text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Active Auctions */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold">Active Negotiations</h2>
        <div className="mt-4 space-y-3">
          {auctions.map((a) => (
            <div
              key={a.id}
              className="glass-card flex items-center justify-between p-4"
            >
              <div>
                <p className="font-mono text-sm">Auction #{a.id}</p>
                <p className="text-xs text-gray-500">
                  by {a.creator} · Reserve: {a.reservePrice} {a.asset}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-400">
                  {a.bidders} bidders
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    a.phase === "commit"
                      ? "bg-yellow-900/30 text-yellow-300"
                      : a.phase === "reveal"
                      ? "bg-blue-900/30 text-blue-300"
                      : "bg-green-900/30 text-green-300"
                  }`}
                >
                  {a.phase}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Settlement History */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold">Settlement History</h2>
        <div className="mt-4 space-y-3">
          {settlements.map((s) => (
            <div
              key={s.id}
              className="glass-card flex items-center justify-between p-4"
            >
              <div>
                <p className="font-mono text-sm">
                  {s.payer} → {s.payee}
                </p>
                <p className="text-xs text-gray-500">
                  {s.amount} · {s.timestamp}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  s.status === "executed"
                    ? "bg-green-900/30 text-green-300"
                    : s.status === "escrowed"
                    ? "bg-yellow-900/30 text-yellow-300"
                    : "bg-red-900/30 text-red-300"
                }`}
              >
                {s.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
