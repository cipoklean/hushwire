"use client";

import { useState, useRef, useEffect } from "react";
import Waveform from "@/components/Waveform";

interface LogLine {
  time: string;
  src: string;
  tag: string;
  msg: string;
  tone: "amber" | "green" | "red" | "cyan" | "dim";
}

const TONE: Record<LogLine["tone"], string> = {
  amber: "text-signal-amber",
  green: "text-signal-green",
  red: "text-signal-red",
  cyan: "text-signal-cyan",
  dim: "text-ink-lo",
};

const SCRIPT: Omit<LogLine, "time">[] = [
  { src: "SYSTEM", tag: "INIT", msg: "spinning up 3 agents on Coston2 · chain 114", tone: "dim" },
  { src: "AGENT-A", tag: "OPEN", msg: "sealed round created · reserve 500 FXRP · window 120s", tone: "amber" },
  { src: "AGENT-B", tag: "COMMIT", msg: "hash 0x05dc…c21e committed ▓▓ amount sealed", tone: "red" },
  { src: "AGENT-C", tag: "COMMIT", msg: "hash 0xcc33…f44d committed ▓▓ amount sealed", tone: "red" },
  { src: "SYSTEM", tag: "LOCK", msg: "commit window closed · no further bids accepted", tone: "dim" },
  { src: "AGENT-B", tag: "REVEAL", msg: "bid 950 FXRP revealed · hash match verified ✓", tone: "cyan" },
  { src: "AGENT-C", tag: "REVEAL", msg: "bid 1020 FXRP revealed · hash match verified ✓", tone: "cyan" },
  { src: "AGENT-A", tag: "AWARD", msg: "winner selected → AGENT-C (1020 FXRP)", tone: "amber" },
  { src: "ENCLAVE", tag: "VERIFY", msg: "Confidential Compute attests mutual agreement · terms undisclosed", tone: "green" },
  { src: "VAULT", tag: "SETTLE", msg: "1020 FXRP released from escrow → AGENT-C", tone: "green" },
  { src: "CHAIN", tag: "FINAL", msg: "settlement proof immutable · negotiation terms remain private ✓", tone: "green" },
];

export default function AgentsPage() {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [cursor, setCursor] = useState(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setCursor((c) => !c), 530);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const run = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setLogs([]);
    setDone(false);
    setRunning(true);

    const start = Date.now();
    SCRIPT.forEach((line, i) => {
      const t = setTimeout(() => {
        const elapsed = ((Date.now() - start) / 1000).toFixed(2).padStart(5, "0");
        setLogs((prev) => [...prev, { time: `T+${elapsed}`, ...line }]);
        if (i === SCRIPT.length - 1) {
          setRunning(false);
          setDone(true);
        }
      }, 900 * (i + 1));
      timers.current.push(t);
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <div className="label mb-2">HUSHWIRE // INTERCEPT SIMULATOR</div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-ink-hi">
            WIRETAP A NEGOTIATION
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink-mid">
            Watch autonomous agents run a full sealed-bid negotiation — commit,
            reveal, enclave verify, atomic settle — streamed as a live intercept.
          </p>
        </div>
        <button
          onClick={run}
          disabled={running}
          className="group inline-flex items-center gap-2 border border-signal-amber bg-signal-amber px-6 py-3 font-display text-sm font-bold tracking-wider text-base-0 transition-all hover:bg-signal-amberHi hover:shadow-[0_0_24px_rgba(255,176,32,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? (
            <>
              <span className="dot dot-sealed" /> INTERCEPTING…
            </>
          ) : (
            <>▶ {done ? "RE-RUN" : "START INTERCEPT"}</>
          )}
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        {/* Intercept feed */}
        <div className="panel panel-corner overflow-hidden">
          <div className="flex items-center justify-between border-b border-line bg-base-2/70 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className={`dot ${running ? "dot-live" : done ? "dot-amber" : "dot-sealed"}`} />
              <span className="font-mono text-[10px] tracking-widest2 text-signal-green">
                {running ? "RECORDING" : done ? "CAPTURE COMPLETE" : "STANDBY"}
              </span>
            </div>
            <span className="font-mono text-[10px] tracking-widest2 text-ink-lo">
              CH-114 // SEALED-REVEAL
            </span>
          </div>

          <div
            ref={feedRef}
            className="h-[440px] overflow-y-auto px-4 py-3"
          >
            {logs.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <Waveform bars={28} className="h-8 opacity-40" />
                <p className="font-mono text-xs tracking-widest2 text-ink-lo">
                  AWAITING SIGNAL · PRESS START INTERCEPT
                </p>
              </div>
            )}
            {logs.map((l, i) => (
              <div
                key={i}
                className="feed-line flex gap-3 animate-fade-up"
                style={{ animationDuration: "0.35s" }}
              >
                <span className="shrink-0 text-ink-lo">{l.time}</span>
                <span className={`w-16 shrink-0 font-semibold ${TONE[l.tone]}`}>{l.src}</span>
                <span className={`shrink-0 ${TONE[l.tone]}`}>[{l.tag}]</span>
                <span className="text-ink-mid">{l.msg}</span>
              </div>
            ))}
            {running && (
              <div className="feed-line mt-1 flex gap-3">
                <span className="text-ink-lo">▸</span>
                <span className={`inline-block h-4 w-2 bg-signal-amber ${cursor ? "opacity-100" : "opacity-0"}`} />
              </div>
            )}
          </div>

          <div className="border-t border-line bg-base-2/50 px-4 py-2">
            <span className="font-mono text-[10px] tracking-widest2 text-ink-lo">
              ▓▓ = VALUE SEALED BY COMMITMENT SCHEME · UNREADABLE UNTIL REVEAL
            </span>
          </div>
        </div>

        {/* Side panel: agents + flow */}
        <div className="space-y-6">
          {/* Agents */}
          <div className="panel p-5">
            <div className="label mb-4">PARTICIPANTS</div>
            <div className="space-y-3">
              {[
                { name: "AGENT-A", role: "BUYER", addr: "0x5d5c…00D2", tone: "text-signal-amber", dot: "dot-amber" },
                { name: "AGENT-B", role: "SELLER", addr: "0x75E0…8969", tone: "text-signal-cyan", dot: "dot-live" },
                { name: "AGENT-C", role: "SELLER", addr: "0x3c52…cF1d", tone: "text-signal-cyan", dot: "dot-live" },
              ].map((a) => (
                <div key={a.name} className="flex items-center gap-3 border border-line bg-base-2/40 px-3 py-2.5">
                  <span className={`dot ${a.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className={`font-mono text-sm font-semibold ${a.tone}`}>{a.name}</div>
                    <div className="font-mono text-[10px] text-ink-lo">{a.addr}</div>
                  </div>
                  <span className="font-mono text-[10px] tracking-widest2 text-ink-lo">{a.role}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Outcome */}
          <div className={`panel p-5 transition-opacity ${done ? "opacity-100" : "opacity-40"}`}>
            <div className="label mb-4">SETTLEMENT OUTCOME</div>
            {done ? (
              <div className="space-y-3 font-mono text-sm">
                <div className="flex justify-between border-b border-line/50 pb-2">
                  <span className="text-ink-lo">WINNER</span>
                  <span className="text-signal-green">AGENT-C</span>
                </div>
                <div className="flex justify-between border-b border-line/50 pb-2">
                  <span className="text-ink-lo">CLEARED</span>
                  <span className="text-signal-amber">1020 FXRP</span>
                </div>
                <div className="flex justify-between border-b border-line/50 pb-2">
                  <span className="text-ink-lo">ENCLAVE</span>
                  <span className="text-signal-cyan">ATTESTED ✓</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-lo">TERMS</span>
                  <span className="text-signal-red">▓▓ SEALED</span>
                </div>
              </div>
            ) : (
              <p className="font-mono text-xs tracking-widest2 text-ink-lo">
                PENDING · RUN INTERCEPT TO POPULATE
              </p>
            )}
          </div>

          {/* Flow diagram */}
          <div className="panel p-5">
            <div className="label mb-4">SIGNAL FLOW</div>
            <div className="space-y-2 font-mono text-[11px]">
              {[
                { s: "COMMIT", d: "hashes on-chain", tone: "text-signal-red" },
                { s: "REVEAL", d: "amounts opened", tone: "text-signal-cyan" },
                { s: "VERIFY", d: "enclave attests", tone: "text-signal-green" },
                { s: "SETTLE", d: "FXRP released", tone: "text-signal-amber" },
              ].map((f, i, arr) => (
                <div key={f.s}>
                  <div className="flex items-center gap-2">
                    <span className={`w-16 font-semibold ${f.tone}`}>{f.s}</span>
                    <span className="text-ink-lo">{f.d}</span>
                  </div>
                  {i < arr.length - 1 && <div className="ml-3 h-3 border-l border-line" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
