"use client";

import { useState, useEffect, useCallback } from "react";
import Waveform from "@/components/Waveform";
import type { ChainSnapshot, AuctionPhase, SettlementStatus } from "@/types";

const EXPLORER = "https://coston2-explorer.flare.network";
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const fmtTime = (t: number) => new Date(t).toLocaleTimeString([], { hour12: false });

const PHASE_STYLE: Record<AuctionPhase, string> = {
  COMMIT: "text-signal-red border-signal-red/40 bg-signal-redDim",
  REVEAL: "text-signal-cyan border-signal-cyan/40 bg-signal-cyanDim",
  SETTLED: "text-signal-green border-signal-green/40 bg-signal-greenDim",
  ENDED: "text-ink-lo border-line bg-base-2/40",
};

const STATUS_STYLE: Record<SettlementStatus, { dot: string; text: string }> = {
  EXECUTED: { dot: "dot-live", text: "text-signal-green" },
  ESCROWED: { dot: "dot-amber", text: "text-signal-amber" },
  REFUNDED: { dot: "dot-sealed", text: "text-signal-red" },
  EXPIRED: { dot: "dot-sealed", text: "text-ink-lo" },
};

export default function DashboardPage() {
  const [snap, setSnap] = useState<ChainSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/chain", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ChainSnapshot = await res.json();
      setSnap(data);
      setError(null);
      setLastUpdated(Date.now());
    } catch (e) {
      // Keep last-good snapshot; surface the error as a stale/full-error state.
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await load();
      if (mounted) setLoading(false);
    })();
    const id = setInterval(load, 20000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [load]);

  const manualRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const stale = error !== null && snap !== null;
  const fullError = error !== null && snap === null;
  const empty = snap !== null && snap.auctions.length === 0 && snap.settlements.length === 0;

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      {/* Console header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <div className="label mb-2">HUSHWIRE // SETTLEMENT CONSOLE</div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-ink-hi">
            NETWORK MONITOR
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-widest2">
            {fullError ? (
              <>
                <span className="dot dot-sealed" />
                <span className="text-signal-red">CHAIN UNREACHABLE</span>
              </>
            ) : stale ? (
              <>
                <span className="dot dot-amber" />
                <span className="text-signal-amber">STALE · RETRYING</span>
              </>
            ) : (
              <>
                <span className="dot dot-live" />
                <span className="text-signal-green">LIVE · COSTON2</span>
              </>
            )}
          </div>
          <button
            onClick={manualRefresh}
            disabled={refreshing || loading}
            className="border border-line bg-base-1 px-3 py-1.5 font-mono text-[10px] tracking-widest2 text-ink-mid transition-all hover:border-signal-amber/60 hover:text-signal-amber disabled:opacity-50"
          >
            {refreshing ? "↻ SYNCING" : "↻ REFRESH"}
          </button>
        </div>
      </div>

      {/* Full error — no data yet */}
      {fullError && !loading && (
        <div className="panel panel-corner px-8 py-16 text-center">
          <div className="label mb-3 text-signal-red">CONNECTION FAILED</div>
          <p className="font-mono text-sm text-ink-mid">
            Could not reach Flare Coston2. The RPC may be rate-limited or briefly down.
          </p>
          <button
            onClick={manualRefresh}
            className="mt-6 btn-primary"
          >
            RETRY CONNECTION
          </button>
        </div>
      )}

      {/* Initial loading */}
      {loading && !snap && (
        <div className="flex flex-col items-center justify-center gap-4 py-32">
          <Waveform bars={28} className="h-8 opacity-50" />
          <span className="font-mono text-xs tracking-widest2 text-ink-lo">
            READING CHAIN STATE…
          </span>
        </div>
      )}

      {/* Data view */}
      {snap && (
        <>
          {stale && (
            <div className="mb-6 border border-signal-amber/40 bg-signal-amberDim px-4 py-2.5 font-mono text-[11px] tracking-wider text-signal-amber">
              ⚠ SHOWING LAST KNOWN STATE — live sync interrupted ({error}). Retrying…
            </div>
          )}

          {/* Stat readouts */}
          <div className="grid grid-cols-2 gap-px overflow-hidden border border-line bg-line lg:grid-cols-4">
            {[
              { label: "ROUNDS", value: snap.stats.rounds.toString(), tone: "text-signal-amber" },
              { label: "SETTLEMENTS", value: snap.stats.settlements.toString(), tone: "text-signal-green" },
              { label: "VOLUME · RECENT", value: `${snap.stats.volumeRecent.toLocaleString()} FXRP`, tone: "text-signal-cyan" },
              { label: "BIDDERS · RECENT", value: snap.stats.biddersRecent.toString(), tone: "text-ink-hi" },
            ].map((s) => (
              <div key={s.label} className="group bg-base-1 p-6 panel-elevated">
                <div className="label mb-3">{s.label}</div>
                <div className={`font-display text-3xl font-bold tabular-nums ${s.tone}`}>{s.value}</div>
                <div className="mt-3 h-[2px] w-8 bg-line transition-all duration-500 group-hover:w-full group-hover:bg-signal-amber" />
              </div>
            ))}
          </div>
          <p className="mt-2 font-mono text-[10px] tracking-widest2 text-ink-lo">
            VOLUME & BIDDERS SAMPLED FROM THE MOST RECENT ON-CHAIN ACTIVITY · TOTALS ARE EXACT
          </p>

          {/* Empty state */}
          {empty && (
            <div className="panel panel-corner mt-8 px-8 py-16 text-center">
              <div className="label mb-3">NO ON-CHAIN ACTIVITY YET</div>
              <p className="mx-auto max-w-md font-mono text-sm text-ink-mid">
                The contracts are deployed but idle. Run the intercept simulator to
                create real sealed rounds and settlements — they will appear here.
              </p>
              <a
                href="/agents"
                className="mt-6 inline-block btn-primary"
              >
                ▶ RUN INTERCEPT
              </a>
            </div>
          )}

          {!empty && (
            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
              {/* Active rounds */}
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-display text-lg font-semibold text-ink-hi">RECENT ROUNDS</h2>
                  <Waveform bars={14} className="h-5" color="#ff5c5c" />
                </div>
                <div className="space-y-3">
                  {snap.auctions.map((a) => (
                    <div key={a.id} className="panel p-4 panel-elevated data-row">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm text-ink-hi">
                          ROUND <span className="text-signal-amber">#{a.id}</span>
                        </span>
                        <span className={`border px-2 py-0.5 font-mono text-[10px] tracking-widest2 ${PHASE_STYLE[a.phase]}`}>
                          {a.phase}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-ink-lo">
                        <a
                          href={`${EXPLORER}/address/${a.creator}`}
                          target="_blank"
                          rel="noopener"
                          className="transition-colors hover:text-signal-cyan"
                        >
                          BY {short(a.creator)} ↗
                        </a>
                        <span>RESERVE {a.reserve} FXRP</span>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="label">BIDDERS</span>
                        <div className="flex gap-1">
                          {Array.from({ length: a.bidders }).map((_, i) => (
                            <span key={i} className="dot dot-sealed" />
                          ))}
                        </div>
                        <span className="ml-auto font-mono text-[11px] text-ink-mid">{a.bidders} sealed</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Settlement ledger */}
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-display text-lg font-semibold text-ink-hi">SETTLEMENT LEDGER</h2>
                  <Waveform bars={14} className="h-5" color="#35d07f" />
                </div>
                <div className="panel panel-elevated overflow-hidden">
                  <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 border-b border-line bg-base-2/60 px-4 py-2.5 font-mono text-[10px] tracking-widest2 text-ink-lo">
                    <span>TX</span>
                    <span>ROUTE</span>
                    <span className="text-right">VALUE</span>
                    <span className="text-right">STATE</span>
                  </div>
                  {snap.settlements.map((s) => {
                    const st = STATUS_STYLE[s.status];
                    return (
                      <div
                        key={s.id}
                        className="data-row grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b border-line/50 px-4 py-3.5 transition-colors last:border-0"
                      >
                        <span className="font-mono text-[11px] text-ink-lo">#{s.id}</span>
                        <div className="min-w-0 font-mono text-xs text-ink-mid">
                          <a href={`${EXPLORER}/address/${s.payer}`} target="_blank" rel="noopener" className="hover:text-signal-cyan">
                            {short(s.payer)}
                          </a>
                          <span className="text-signal-amber"> → </span>
                          <a href={`${EXPLORER}/address/${s.payee}`} target="_blank" rel="noopener" className="hover:text-signal-cyan">
                            {short(s.payee)}
                          </a>
                        </div>
                        <span className="text-right font-mono text-sm font-semibold tabular-nums text-ink-hi">
                          {s.amount}
                        </span>
                        <span className="flex items-center justify-end gap-1.5">
                          <span className={`dot ${st.dot}`} />
                          <span className={`font-mono text-[10px] tracking-wider ${st.text}`}>{s.status}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 font-mono text-[10px] tracking-widest2 text-ink-lo">
                  ▓ PRE-REVEAL BID AMOUNTS REMAIN SEALED · SETTLED VALUES ARE PUBLIC
                </p>
              </div>
            </div>
          )}

          {/* Footer meta */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 font-mono text-[10px] tracking-widest2 text-ink-lo">
            <span>
              CHAIN {snap.chainId} · {snap.network.toUpperCase()}
            </span>
            <span>
              LAST SYNC {lastUpdated ? fmtTime(lastUpdated) : "—"} · AUTO-REFRESH 20S
            </span>
          </div>
        </>
      )}
    </div>
  );
}