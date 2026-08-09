"use client";

import LiveFeed from "@/components/LiveFeed";
import Waveform from "@/components/Waveform";
import addresses from "@/lib/addresses.json";
import { useLiveEvents } from "@/lib/useLiveEvents";
import { EXPLORER_BASE } from "@/lib/explorer";

const PHASES = [
  {
    n: "01",
    name: "COMMIT",
    color: "#ffb020",
    title: "Sealed bids. Zero leakage.",
    body: "Sellers commit keccak256(amount, salt) on-chain. Amounts and strategy stay hidden until the reveal window — no price front-running, no bid-sniping.",
    code: "commit(keccak256(amount, salt))",
  },
  {
    n: "02",
    name: "REVEAL",
    color: "#4fd1c5",
    title: "Attested, then revealed.",
    body: "After the window, bids open on-chain. The winning terms are matched off-chain and attested with a real EIP-191 signature over the exact settlement terms — operator-signed today, with Flare Confidential Compute as the production path.",
    code: "verify(terms) → EIP-191 attestation",
  },
  {
    n: "03",
    name: "SETTLE",
    color: "#35d07f",
    title: "Atomic FAsset release.",
    body: "HushWireVault releases escrowed FXRP atomically the moment a valid attestation lands. Gated by the verifier — no privileged party can force a release. No partial fills.",
    code: "vault.execute(settlementId, attestation)",
  },
];

const PILLARS = [
  {
    kicker: "SEALED INTENT",
    accent: "#ffb020",
    title: "Commit. Don't disclose.",
    body: "Bids commit to the chain as salted hashes. The winning strategy never touches the public mempool until the reveal window opens.",
    specs: [
      { label: "commit", value: "keccak256(amount, salt)", tone: "amber" },
      { label: "input visibility", value: "⌀ HIDDEN", tone: "red" },
      { label: "reveal value", value: "on decode", tone: "cyan" },
      { label: "anti-front-run", value: "✓ YES", tone: "green" },
    ],
  },
  {
    kicker: "ATTESTATION GATE",
    accent: "#4fd1c5",
    title: "Verified, then released.",
    body: "Terms are matched off-chain and attested with a real EIP-191 signature over the exact settlement terms — operator-signed today, with Flare Confidential Compute as the production path. The verifier interface already matches the FCC shielded-transfer pattern.",
    specs: [
      { label: "terms enter", value: "⌀ OFF-CHAIN", tone: "amber" },
      { label: "attested by (today)", value: "OPERATOR · EIP-191", tone: "cyan" },
      { label: "production path", value: "FLARE CONFIDENTIAL COMPUTE", tone: "green" },
      { label: "replay protection", value: "VAULT+CHAIN+ID BOUND", tone: "green" },
    ],
  },
  {
    kicker: "FASSET SETTLEMENT",
    accent: "#35d07f",
    title: "Finality with assets.",
    body: "Settlement executes atomically in FXRP. If the attestation isn't valid, nothing moves. Public proof of settlement; private terms of agreement.",
    specs: [
      { label: "escrow asset", value: "FXRP", tone: "amber" },
      { label: "release mode", value: "ATOMIC", tone: "green" },
      { label: "gated by", value: "VERIFIER", tone: "cyan" },
      { label: "failure mode", value: "REVERT ⌀", tone: "red" },
    ],
  },
];

// What is private vs public — stated exactly (matches docs/ARCHITECTURE.md).
const SEALED_ITEMS = [
  "Bid amounts during the commit phase — only hashes hit the chain",
  "The bid salt — never on-chain, required to reveal",
  "Negotiation strategy / bidding patterns",
  "The attestation comparison itself (off-chain)",
];

const PUBLIC_ITEMS = [
  "Commit hashes (every bidder, every round)",
  "Revealed bid amounts — after the reveal window opens",
  "Auction winner + winning amount",
  "Settlement payer, payee and amount (escrow + execution)",
  "The settlement proof hash on-chain",
];

const METRICS = [
  { v: "keccak256", l: "SEALED COMMIT SCHEME" },
  { v: "EIP-191", l: "ATTESTATION · OPERATOR-SIGNED" },
  { v: "atomic", l: "FASSET SETTLEMENT" },
  { v: "Coston2", l: "TESTNET · CHAIN 114" },
];

export default function Home() {
  const { events, windowed } = useLiveEvents();

  // Ticker: real events when available, clearly-marked simulation otherwise.
  const tickerItems = events && events.length > 0
    ? events.slice(0, 6).map((e) => ({
        label: e.label,
        hash: `#${e.block}`,
        sim: false,
        tx: e.txHash,
      }))
    : [
        { label: "SIM · ROUND OPEN", hash: "0x▓▓", sim: true, tx: "" },
        { label: "SIM · BID COMMIT", hash: "0x▓▓", sim: true, tx: "" },
        { label: "SIM · BID REVEAL", hash: "0x▓▓", sim: true, tx: "" },
        { label: "SIM · ATTEST", hash: "EIP-191", sim: true, tx: "" },
        { label: "SIM · SETTLEMENT EXEC", hash: "0x▓▓", sim: true, tx: "" },
      ];

  return (
    <>
      {/* ── HERO ── */}
      <section className="border-b border-line relative">
        {/* Subtle accent sweep behind hero */}
        <div className="absolute inset-0 bg-gradient-to-r from-signal-amber/5 via-transparent to-signal-cyan/5 pointer-events-none" />

        <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1fr_440px] lg:items-center lg:gap-16">
          <div className="reveal space-y-6">
            <p className="inline-flex items-center gap-2 border border-line bg-base-2 px-3 py-1.5 font-mono text-[10px] tracking-widest2 text-signal-amber w-fit">
              <span className="dot dot-amber" />
              FLARE SUMMER SIGNAL 2026 · BOUNTY 1+2
            </p>
            <h1 className="font-display text-[2.75rem] font-bold leading-[1.04] tracking-tight text-ink-hi sm:text-6xl">
              Private negotiations.
              <br />
              <span className="text-signal-amber">Public</span> settlement.
            </h1>
            <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-mid">
              Autonomous agents negotiate payment terms in complete secrecy — bids stay
              sealed until reveal. Settlement is attested, then releases FXRP
              atomically on-chain.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a href="/agents" className="group btn-primary">
                → INITIATE SIMULATION
              </a>
              <a href="/dashboard" className="btn-secondary">
                OPEN CONSOLE
              </a>
            </div>

            {/* Contract addresses — grounding detail, not clutter */}
            <div className="mt-10 pt-6 border-t border-line space-y-2 font-mono text-[10px] leading-relaxed tracking-wider text-ink-lo">
              <div className="flex gap-3">
                <span className="w-24 shrink-0 text-signal-amber">VAULT</span>
                <a
                  href={`${EXPLORER_BASE}/address/${addresses.hushWireVault}`}
                  target="_blank"
                  rel="noopener"
                  className="truncate transition-colors hover:text-signal-cyan"
                >
                  {addresses.hushWireVault} ↗
                </a>
              </div>
              <div className="flex gap-3">
                <span className="w-24 shrink-0 text-signal-amber">AUCTION</span>
                <a
                  href={`${EXPLORER_BASE}/address/${addresses.sealedBidAuction}`}
                  target="_blank"
                  rel="noopener"
                  className="truncate transition-colors hover:text-signal-cyan"
                >
                  {addresses.sealedBidAuction} ↗
                </a>
              </div>
            </div>
          </div>

          <div className="reveal space-y-5" style={{ animationDelay: "0.15s" }}>
            <LiveFeed events={events} windowed={windowed} />
            {/* Waveform reads as the live channel pulsing */}
            <div className="flex items-center gap-4 border border-line bg-base-1/80 px-4 py-3 panel-elevated">
              <span className="shrink-0 font-mono text-[10px] tracking-widest2 text-ink-lo">
                CH-114
              </span>
              <Waveform bars={56} className="h-9 flex-1" />
            </div>
          </div>
        </div>

        {/* Ticker strip — real events when available */}
        <div className="border-t border-line bg-base-1/70 py-2.5">
          <div className="overflow-hidden">
            <div className="ticker-track">
              {[0, 1].map((copy) => (
                <div key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
                  {tickerItems.map((item, i) => (
                    <span
                      key={`${copy}-${i}`}
                      className="mx-8 flex items-center gap-2.5 font-mono text-[10px] tracking-widest3 text-ink-lo"
                    >
                      <span className="text-signal-green">▸</span>
                      {item.label}
                      <span className="text-ink-hi">{item.hash}</span>
                      {item.sim ? (
                        <span className="text-signal-amber">· SIMULATION</span>
                      ) : (
                        <a
                          href={`${EXPLORER_BASE}/tx/${item.tx}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-signal-cyan hover:underline"
                        >
                          TX ↗
                        </a>
                      )}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PROBLEM / CLAIM ── */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-end">
          <div className="reveal space-y-4">
            <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-ink-hi sm:text-4xl">
              On-chain negotiation has
              <br />
              <span className="text-signal-red">an information problem.</span>
            </h2>
            <p className="text-base leading-relaxed text-ink-mid">
              Today, every term, counter-offer, and sizing decision is broadcast to the
              entire chain. Competitors front-run bids. Negotiation strategy leaks before
              settlement lands. HushWire moves the negotiation off the transparent
              mempool — sealed until the reveal window — without sacrificing settlement
              finality.
            </p>
          </div>
        </div>

        {/* The three pillar cards */}
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {PILLARS.map((c, i) => (
            <div
              key={c.kicker}
              className="panel panel-corner p-5 card-sweep reveal transition-transform hover:-translate-y-0.5"
              style={{ animationDelay: `${i * 0.12}s`, borderTop: `2px solid ${c.accent}` }}
            >
              <div className="label" style={{ color: c.accent }}>
                {c.kicker}
              </div>
              <h3 className="mt-2.5 font-display text-lg font-semibold text-ink-hi">{c.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-ink-mid">{c.body}</p>
              <div className="mt-4 space-y-2">
                {c.specs.map((s, si) => (
                  <div
                    key={s.label}
                    className="flex items-baseline justify-between border-t border-line/60 pt-1.5 font-mono text-[11px] leading-relaxed"
                  >
                    <span className="text-ink-lo">{s.label}</span>
                    <span className={`text-signal-${s.tone}`}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── WHAT STAYS SEALED / WHAT GOES PUBLIC ── */}
      <section className="border-y border-line bg-base-1/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <p className="label reveal mb-2.5">PRIVACY MODEL — EXACTLY WHAT IS SEALED</p>
          <h2 className="reveal font-display text-3xl font-bold tracking-tight text-ink-hi sm:text-4xl">
            Sealed until reveal. Public by design.
          </h2>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="panel p-6 panel-elevated">
              <div className="flex items-center gap-2">
                <span className="dot dot-sealed" />
                <span className="font-mono text-[10px] tracking-widest2 text-signal-red">
                  STAYS SEALED · NEVER PUBLIC
                </span>
              </div>
              <ul className="mt-4 space-y-2.5">
                {SEALED_ITEMS.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-ink-mid">
                    <span className="text-signal-red">▓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel p-6 panel-elevated">
              <div className="flex items-center gap-2">
                <span className="dot dot-live" />
                <span className="font-mono text-[10px] tracking-widest2 text-signal-green">
                  PUBLIC BY DESIGN · ON-CHAIN
                </span>
              </div>
              <ul className="mt-4 space-y-2.5">
                {PUBLIC_ITEMS.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-ink-mid">
                    <span className="text-signal-green">▸</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROTOCOL PHASES ── */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <p className="label reveal mb-2.5">NEGOTIATION PIPELINE</p>
        <h2 className="reveal font-display text-3xl font-bold tracking-tight text-ink-hi sm:text-4xl">
          Three phases. One trustless settlement.
        </h2>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {PHASES.map((p, i) => (
            <div key={p.n} className="reveal relative" style={{ animationDelay: `${i * 0.14}s` }}>
              <div className="panel p-6 panel-elevated">
                <div className="flex items-start justify-between">
                  <span
                    className="font-display text-4xl font-bold leading-none"
                    style={{ color: `${p.color}30` }}
                  >
                    {p.n}
                  </span>
                  <span
                    className="border px-2.5 py-1 font-mono text-[10px] tracking-widest2"
                    style={{ color: p.color, borderColor: `${p.color}45`, background: `${p.color}0d` }}
                  >
                    {p.name}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold text-ink-hi">{p.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-ink-mid">{p.body}</p>
                <div className="mt-5 rounded border border-line/70 bg-base-0/60 px-3 py-2 font-mono text-[11px] text-signal-green/90">
                  {p.code}
                </div>
              </div>
              {i < PHASES.length - 1 && (
                <div className="absolute -right-4 top-1/2 hidden h-px w-8 bg-line lg:block">
                  <span className="absolute -right-1 -top-[3.5px] text-[8px] text-ink-lo">▶</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Attestation status — honest label */}
        <div className="mt-10 border border-line bg-base-1/50 px-5 py-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[11px] leading-relaxed">
            <span className="shrink-0 tracking-widest2 text-signal-amber">ATTESTATION STATUS ·</span>
            <span className="text-ink-mid">
              Today: operator-signed (EIP-191). Production path: Flare Confidential Compute — the
              verifier interface already matches the FCC shielded-transfer pattern (
              <a
                href="/docs/FCC_INTEGRATION.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-signal-cyan underline decoration-dotted underline-offset-2 hover:text-ink-hi"
              >
                docs linked
              </a>
              ).
            </span>
          </div>
        </div>
      </section>

      {/* ── PUNCHLINE + STATS ── */}
      <section className="mx-auto max-w-7xl px-6 pb-24 text-center">
        <p className="label reveal mb-6">THE PUNCHLINE</p>
        <h2 className="reveal mx-auto font-display text-4xl font-bold leading-[1.05] tracking-tight text-ink-hi sm:text-6xl" style={{ animationDelay: "0.05s" }}>
          Settlement <span className="text-signal-green">public</span>.
          <br />
          Strategy <span className="text-signal-red">sealed</span>.
        </h2>
        <p className="reveal mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink-mid" style={{ animationDelay: "0.1s" }}>
          The winning bid writes to the chain. The negotiation that produced it stays private —
          sealed until reveal, and never published beyond the attested outcome.
        </p>
        <div className="reveal mt-10" style={{ animationDelay: "0.15s" }}>
          <a href="/agents" className="inline-block btn-primary px-8 py-4">
            RUN THE TWO-AGENT NEGOTIATION →
          </a>
        </div>

        <div className="mx-auto mt-24 grid max-w-4xl grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
          {METRICS.map((s, i) => (
            <div key={s.l} className="reveal bg-base-1 px-4 py-8" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="font-display text-2xl font-bold tracking-tight text-signal-amber">{s.v}</div>
              <div className="label mt-1.5">{s.l}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
