"use client";

import { useEffect, useRef, useState } from "react";
import type { ChainEvent } from "@/types";
import { EXPLORER_BASE } from "@/lib/explorer";

const TONE: Record<string, string> = {
  amber: "text-signal-amber",
  green: "text-signal-green",
  red: "text-signal-red",
  cyan: "text-signal-cyan",
  dim: "text-ink-lo",
};

function timeAgo(unix: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - unix);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── Scripted walkthrough — shown ONLY as the clearly-labeled empty state ──
interface SimLine {
  t: string;
  src: string;
  tag: string;
  msg: string;
  tone: "amber" | "green" | "red" | "cyan" | "dim";
}

const SCRIPT: SimLine[] = [
  { t: "00:00:01", src: "AGENT-A", tag: "OPEN", msg: "sealed round opened · reserve 500 FXRP", tone: "amber" },
  { t: "00:00:04", src: "AGENT-B", tag: "COMMIT", msg: "hash committed ▓▓ amount sealed", tone: "red" },
  { t: "00:00:07", src: "AGENT-C", tag: "COMMIT", msg: "hash committed ▓▓ amount sealed", tone: "red" },
  { t: "00:00:31", src: "AGENT-B", tag: "REVEAL", msg: "bid 950 FXRP revealed · hash match ✓", tone: "cyan" },
  { t: "00:00:34", src: "AGENT-C", tag: "REVEAL", msg: "bid 1020 FXRP revealed · hash match ✓", tone: "cyan" },
  { t: "00:00:36", src: "AUTHORITY", tag: "ATTEST", msg: "EIP-191 signature over exact terms (operator-signed today)", tone: "green" },
  { t: "00:00:38", src: "VAULT", tag: "SETTLE", msg: "1020 FXRP released from escrow → AGENT-C", tone: "green" },
  { t: "00:00:39", src: "CHAIN", tag: "FINAL", msg: "settlement proof on-chain · terms remain private", tone: "amber" },
];

export default function LiveFeed({
  events,
  windowed,
}: {
  events: ChainEvent[] | null; // null = not loaded yet
  windowed: boolean;
}) {
  const [lines, setLines] = useState<SimLine[]>([]);
  const [cursor, setCursor] = useState(true);
  const idx = useRef(0);

  // Simulation only runs in the empty state (no real events yet).
  useEffect(() => {
    if (events && events.length > 0) {
      setLines([]);
      return;
    }
    const tick = () => {
      setLines((prev) => {
        const next = [...prev, SCRIPT[idx.current % SCRIPT.length]];
        idx.current += 1;
        return next.slice(-9);
      });
    };
    tick();
    const id = setInterval(tick, 1600);
    return () => clearInterval(id);
  }, [events]);

  useEffect(() => {
    const id = setInterval(() => setCursor((c) => !c), 530);
    return () => clearInterval(id);
  }, []);

  const live = events && events.length > 0;

  return (
    <div className="panel panel-corner overflow-hidden">
      {/* Feed header */}
      <div className="flex items-center justify-between border-b border-line bg-base-2/70 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`dot ${live ? "dot-live" : "dot-amber"}`} />
          <span className={`font-mono text-[10px] tracking-widest2 ${live ? "text-signal-green" : "text-signal-amber"}`}>
            {live ? "LIVE INTERCEPT" : "HOW IT WORKS (SIMULATION)"}
          </span>
        </div>
        <span className="font-mono text-[10px] tracking-widest2 text-ink-lo">
          {live ? "COSTON2 · CHAIN 114" : "NO LIVE EVENTS IN WINDOW YET"}
        </span>
      </div>

      {/* Feed body */}
      <div className="min-h-[290px] px-4 py-3">
        {live ? (
          events!.map((e) => (
            <div key={e.id} className="feed-line flex gap-2 animate-fade-up" style={{ animationDuration: "0.4s" }}>
              <a
                href={`${EXPLORER_BASE}/block/${e.block}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 font-mono text-[10px] text-ink-lo underline decoration-dotted underline-offset-2 hover:text-signal-cyan"
                title={`Block ${e.block} on the Coston2 explorer`}
              >
                #{e.block}
              </a>
              <span className={`w-28 shrink-0 font-mono text-[10px] font-semibold ${TONE[e.tone]}`}>[{e.label}]</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-mid" title={e.summary}>
                {e.summary}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-ink-lo/70">{timeAgo(e.blockTime)}</span>
              <a
                href={`${EXPLORER_BASE}/tx/${e.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 font-mono text-[10px] text-signal-cyan hover:underline"
                title={`Transaction ${e.txHash}`}
              >
                TX ↗
              </a>
            </div>
          ))
        ) : (
          <>
            {lines.map((l, i) => (
              <div key={`${l.t}-${i}`} className="feed-line flex gap-3 animate-fade-up" style={{ animationDuration: "0.4s" }}>
                <span className="shrink-0 text-ink-lo">{l.t}</span>
                <span className={`w-20 shrink-0 font-semibold ${TONE[l.tone]}`}>{l.src}</span>
                <span className="shrink-0 text-ink-lo">
                  <span className={TONE[l.tone]}>[{l.tag}]</span>
                </span>
                <span className="text-ink-mid">{l.msg}</span>
              </div>
            ))}
            <div className="feed-line mt-1 flex gap-3">
              <span className="text-ink-lo">▸</span>
              <span className={`inline-block h-4 w-2 bg-signal-amber ${cursor ? "opacity-100" : "opacity-0"}`} />
            </div>
          </>
        )}
      </div>

      {/* Feed footer */}
      <div className="border-t border-line bg-base-2/50 px-4 py-2">
        <span className="font-mono text-[10px] tracking-widest2 text-ink-lo">
          {live
            ? windowed
              ? "REAL EVENTS · RECENT WINDOW ONLY"
              : "REAL ON-CHAIN EVENTS · TX LINKS OPEN THE EXPLORER"
            : "▓▓ = VALUE SEALED BY COMMITMENT SCHEME · SCRIPTED WALKTHROUGH"}
        </span>
      </div>
    </div>
  );
}
