"use client";

import { useEffect, useRef, useState } from "react";

interface FeedEvent {
  t: string;      // timestamp label
  src: string;    // source agent
  tag: string;    // action tag
  msg: string;    // message
  tone: "amber" | "green" | "red" | "cyan" | "dim";
}

const TONE: Record<FeedEvent["tone"], string> = {
  amber: "text-signal-amber",
  green: "text-signal-green",
  red: "text-signal-red",
  cyan: "text-signal-cyan",
  dim: "text-ink-lo",
};

const SCRIPT: FeedEvent[] = [
  { t: "00:00:01", src: "AGENT-A", tag: "OPEN", msg: "sealed round #0x7F3A · reserve 500 FXRP", tone: "amber" },
  { t: "00:00:04", src: "AGENT-B", tag: "COMMIT", msg: "hash 0x05dc…c21e ▓▓ amount sealed", tone: "red" },
  { t: "00:00:07", src: "AGENT-C", tag: "COMMIT", msg: "hash 0xcc33…f44d ▓▓ amount sealed", tone: "red" },
  { t: "00:00:31", src: "AGENT-B", tag: "REVEAL", msg: "bid 950 FXRP · signature verified", tone: "cyan" },
  { t: "00:00:34", src: "AGENT-C", tag: "REVEAL", msg: "bid 1020 FXRP · signature verified", tone: "cyan" },
  { t: "00:00:36", src: "ENCLAVE", tag: "VERIFY", msg: "mutual agreement attested · terms undisclosed", tone: "green" },
  { t: "00:00:38", src: "VAULT", tag: "SETTLE", msg: "1020 FXRP released → AGENT-C · proof on-chain", tone: "green" },
  { t: "00:00:39", src: "CHAIN", tag: "FINAL", msg: "block #33180546 · settlement immutable ✓", tone: "amber" },
];

/**
 * Live intercept feed — streams a sealed negotiation one line at a time,
 * then loops. The centerpiece of the landing page.
 */
export default function LiveFeed() {
  const [lines, setLines] = useState<FeedEvent[]>([]);
  const [cursor, setCursor] = useState(true);
  const idx = useRef(0);

  useEffect(() => {
    const tick = () => {
      setLines((prev) => {
        const next = [...prev, SCRIPT[idx.current % SCRIPT.length]];
        idx.current += 1;
        // Keep the window tight
        return next.slice(-9);
      });
    };
    tick();
    const id = setInterval(tick, 1600);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setCursor((c) => !c), 530);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="panel panel-corner overflow-hidden">
      {/* Feed header */}
      <div className="flex items-center justify-between border-b border-line bg-base-2/70 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="dot dot-live" />
          <span className="font-mono text-[10px] tracking-widest2 text-signal-green">
            LIVE INTERCEPT
          </span>
        </div>
        <span className="font-mono text-[10px] tracking-widest2 text-ink-lo">
          CH-114 // ENCRYPTED
        </span>
      </div>

      {/* Feed body */}
      <div className="min-h-[290px] px-4 py-3">
        {lines.map((l, i) => (
          <div
            key={`${l.t}-${i}`}
            className="feed-line flex gap-3 animate-fade-up"
            style={{ animationDuration: "0.4s" }}
          >
            <span className="shrink-0 text-ink-lo">{l.t}</span>
            <span className={`w-16 shrink-0 font-semibold ${TONE[l.tone]}`}>{l.src}</span>
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
      </div>

      {/* Feed footer */}
      <div className="border-t border-line bg-base-2/50 px-4 py-2">
        <span className="font-mono text-[10px] tracking-widest2 text-ink-lo">
          ▓▓ = VALUE SEALED BY COMMITMENT SCHEME
        </span>
      </div>
    </div>
  );
}
