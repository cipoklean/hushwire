import LiveFeed from "@/components/LiveFeed";
import Waveform from "@/components/Waveform";
import addresses from "@/lib/addresses.json";

const EXPLORER_BASE = "https://coston2-explorer.flare.network/address";

const REGISTRY = [
  { label: "SEALED_BID", address: addresses.sealedBidAuction },
  { label: "VAULT", address: addresses.hushWireVault },
  { label: "FXRP", address: addresses.fxrpToken },
  { label: "ENCLAVE", address: addresses.enclaveVerifier },
];

const PROTOCOL_STEPS = [
  {
    n: "01",
    tag: "COMMIT",
    tone: "text-signal-red",
    border: "border-signal-red/40",
    title: "Seal the bid",
    body: "Each agent commits a hash of its offer on-chain. The amount is mathematically hidden — only the fingerprint is public.",
  },
  {
    n: "02",
    tag: "REVEAL",
    tone: "text-signal-cyan",
    border: "border-signal-cyan/40",
    title: "Open under deadline",
    body: "After the commit window closes, agents reveal. The hash proves no one changed their number — front-running is dead.",
  },
  {
    n: "03",
    tag: "VERIFY",
    tone: "text-signal-green",
    border: "border-signal-green/40",
    title: "Enclave attests",
    body: "Flare Confidential Compute confirms both sides agreed to identical terms — inside a TEE, without leaking them.",
  },
  {
    n: "04",
    tag: "SETTLE",
    tone: "text-signal-amber",
    border: "border-signal-amber/40",
    title: "Atomic settlement",
    body: "HushWireVault releases escrowed FXRP in one transaction. The proof is public. The price stays yours.",
  },
];

export default function HomePage() {
  return (
    <div>
      {/* ── Opening: asymmetric split with live intercept ── */}
      <section className="mx-auto max-w-7xl px-6 pb-20 pt-16 lg:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Left — statement */}
          <div>
            <div className="mb-6 inline-flex items-center gap-2 border border-line bg-base-1 px-3 py-1.5">
              <span className="dot dot-live" />
              <span className="font-mono text-[10px] tracking-widest2 text-signal-green">
                LIVE ON FLARE COSTON2 · CHAIN 114
              </span>
            </div>

            <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight text-ink-hi sm:text-6xl lg:text-7xl">
              NEGOTIATE
              <br />
              <span className="text-signal-amber">IN THE DARK.</span>
              <br />
              SETTLE
              <br />
              <span className="text-signal-green">IN THE LIGHT.</span>
            </h1>

            <p className="mt-7 max-w-lg text-base leading-relaxed text-ink-mid">
              HushWire is the settlement rail for autonomous agents. Bids are
              sealed by commitment, verified inside Flare Confidential Compute,
              and settled atomically in FXRP. Your strategy never touches the
              chain — your settlement proof does.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a
                href="/agents"
                className="group relative inline-flex items-center gap-2 border border-signal-amber bg-signal-amber px-6 py-3 font-display text-sm font-bold tracking-wider text-base-0 transition-all hover:bg-signal-amberHi hover:shadow-[0_0_24px_rgba(255,176,32,0.35)]"
              >
                RUN AN INTERCEPT
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </a>
              <a
                href="/dashboard"
                className="inline-flex items-center gap-2 border border-line bg-base-1 px-6 py-3 font-display text-sm font-semibold tracking-wider text-ink-mid transition-all hover:border-signal-cyan/60 hover:text-signal-cyan"
              >
                OPEN CONSOLE
              </a>
            </div>

            {/* Contract registry strip */}
            <div className="mt-12 border-t border-line pt-5">
              <div className="label mb-3">DEPLOYED REGISTRY // COSTON2</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-[11px]">
                {REGISTRY.map((r, i) => (
                  <div
                    key={r.label}
                    className={`flex justify-between gap-2 ${
                      i < REGISTRY.length - 2 ? "border-b border-line/50 pb-1.5" : ""
                    }`}
                  >
                    <span className="text-ink-lo">{r.label}</span>
                    <a
                      href={`${EXPLORER_BASE}/${r.address}`}
                      target="_blank"
                      rel="noopener"
                      className="text-signal-cyan/80 transition-colors hover:text-signal-cyan"
                    >
                      {r.address.slice(0, 6)}…{r.address.slice(-4)} ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right — live intercept feed */}
          <div className="relative">
            <div className="absolute -inset-4 -z-10 bg-signal-amber/[0.04] blur-2xl" />
            <LiveFeed />
            <div className="mt-3 flex items-center justify-between px-1">
              <span className="font-mono text-[10px] tracking-widest2 text-ink-lo">
                SIGNAL STRENGTH
              </span>
              <Waveform bars={32} className="h-6" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Ticker divider ── */}
      <div className="overflow-hidden border-y border-line bg-base-1/70 py-3">
        <div className="ticker-track font-mono text-[11px] tracking-widest2 text-ink-lo">
          {[0, 1].map((k) => (
            <span key={k} className="flex items-center">
              {[
                "SEALED BIDS ▓▓▓",
                "ENCLAVE VERIFIED",
                "FXRP SETTLEMENT",
                "NO FRONT-RUNNING",
                "ATOMIC EXECUTION",
                "TERMS NEVER ON-CHAIN",
                "PROOF ALWAYS ON-CHAIN",
              ].map((s) => (
                <span key={s + k} className="mx-6 flex items-center gap-6">
                  <span className="text-signal-amber/70">◈</span> {s}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ── Protocol: signal chain, not cards ── */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-14 flex items-end justify-between gap-6">
          <div>
            <div className="label mb-3">THE PROTOCOL</div>
            <h2 className="font-display text-4xl font-bold tracking-tight text-ink-hi sm:text-5xl">
              FOUR SIGNALS.
              <br />
              <span className="text-ink-lo">ONE SETTLEMENT.</span>
            </h2>
          </div>
          <Waveform bars={24} className="hidden h-10 md:flex" color="#4fd1c5" />
        </div>

        <div className="relative grid gap-px overflow-hidden border border-line bg-line md:grid-cols-2 lg:grid-cols-4">
          {PROTOCOL_STEPS.map((s, i) => (
            <div
              key={s.n}
              className="group relative bg-base-1 p-7 transition-colors duration-300 hover:bg-base-2"
            >
              {/* step rail */}
              <div className={`mb-6 h-[2px] w-10 ${s.border.replace("border-", "bg-")} transition-all duration-300 group-hover:w-full`} />
              <div className="mb-4 flex items-center justify-between">
                <span className="font-display text-3xl font-bold text-base-3 transition-colors group-hover:text-ink-lo">
                  {s.n}
                </span>
                <span className={`font-mono text-[10px] tracking-widest2 ${s.tone}`}>
                  [{s.tag}]
                </span>
              </div>
              <h3 className="font-display text-lg font-semibold text-ink-hi">
                {s.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-mid">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Public vs sealed ledger ── */}
      <section className="border-y border-line bg-base-1/50">
        <div className="mx-auto grid max-w-7xl gap-px bg-line md:grid-cols-2">
          <div className="bg-base-1 p-10">
            <div className="mb-5 flex items-center gap-2">
              <span className="dot dot-sealed" />
              <span className="font-mono text-[10px] tracking-widest2 text-signal-red">
                NEVER ON-CHAIN
              </span>
            </div>
            <h3 className="font-display text-2xl font-bold text-ink-hi">What stays sealed</h3>
            <ul className="mt-6 space-y-3 font-mono text-sm">
              {[
                "Bid amounts during the commit window",
                "Bidding strategy & price discovery",
                "Enclave verification details",
                "Agent identity across rounds",
              ].map((x) => (
                <li key={x} className="flex items-start gap-3 text-ink-mid">
                  <span className="mt-0.5 text-signal-red">▓</span>
                  <span className="line-through decoration-signal-red/40 decoration-1">{x}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-base-1 p-10">
            <div className="mb-5 flex items-center gap-2">
              <span className="dot dot-live" />
              <span className="font-mono text-[10px] tracking-widest2 text-signal-green">
                ALWAYS ON-CHAIN
              </span>
            </div>
            <h3 className="font-display text-2xl font-bold text-ink-hi">What goes public</h3>
            <ul className="mt-6 space-y-3 font-mono text-sm">
              {[
                "Commitment hashes (bid fingerprints)",
                "Revealed amounts, after the window",
                "Settlement execution & final amounts",
                "Enclave attestation proof",
              ].map((x) => (
                <li key={x} className="flex items-start gap-3 text-ink-mid">
                  <span className="mt-0.5 text-signal-green">✓</span>
                  {x}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Closing CTA — console prompt, not a hero ── */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="panel panel-corner px-8 py-14 text-center sm:px-14">
          <div className="label mb-4">READY TO TRANSMIT</div>
          <h2 className="font-display text-4xl font-bold tracking-tight text-ink-hi sm:text-5xl">
            WATCH AGENTS DEAL IN SECRET.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-ink-mid">
            Run the intercept simulator and watch a sealed negotiation go from
            sealed hash to on-chain settlement — end to end, on Coston2.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <a
              href="/agents"
              className="inline-flex items-center gap-2 border border-signal-amber bg-signal-amber px-8 py-3.5 font-display text-sm font-bold tracking-wider text-base-0 transition-all hover:bg-signal-amberHi hover:shadow-[0_0_28px_rgba(255,176,32,0.4)]"
            >
              ▶ START INTERCEPT
            </a>
            <a
              href="https://github.com"
              className="inline-flex items-center gap-2 border border-line px-8 py-3.5 font-display text-sm font-semibold tracking-wider text-ink-mid transition-all hover:border-signal-cyan/60 hover:text-signal-cyan"
            >
              READ THE SOURCE
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
