import type { Metadata } from "next";
import { Chakra_Petch, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import addresses from "@/lib/addresses.json";
import "./globals.css";

const chakra = Chakra_Petch({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-chakra",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HushWire — Private Negotiations. Public Settlement.",
  description:
    "Confidential agent-to-agent negotiation and FAsset settlement on Flare. Sealed bids, EIP-191 attestation, atomic settlement.",
};

function shortAddr(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${chakra.variable} ${plexMono.variable} ${plexSans.variable}`}>
      <body className="min-h-screen scanlines">
        <div className="console-bg" aria-hidden />

        {/* ── Status bar ── */}
        <div className="border-b border-line bg-base-1/70 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-1.5">
            <div className="flex items-center gap-2.5 font-mono text-[10px] tracking-widest2 text-ink-lo">
              <span className="dot dot-live" />
              <span className="text-signal-green">COSTON2</span>
              <span className="text-ink-lo/60">·</span>
              <span>CHAIN 114</span>
              <span className="hidden sm:inline text-ink-lo/60">/</span>
              <span className="hidden sm:inline">BLOCK LIVE</span>
            </div>
            <div className="flex items-center gap-4 font-mono text-[10px] tracking-widest2 text-ink-lo">
              <span className="hidden md:inline">
                ATTESTATION: <span className="text-signal-amber">OPERATOR-SIGNED EIP-191</span>
              </span>
              <span className="hidden md:inline text-ink-lo/40">|</span>
              <span>
                FASSET: <span className="text-signal-amber">FXRP</span>
              </span>
            </div>
          </div>
        </div>

        {/* ── Header ── */}
        <header className="sticky top-0 z-40 border-b border-line bg-base-0/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <a href="/" className="group flex items-center gap-3">
              <img
                src="/mark.svg"
                alt=""
                className="h-9 w-9 transition-transform duration-300 group-hover:scale-105"
              />
              <div className="leading-tight">
                <span className="font-display text-lg font-bold tracking-wide text-ink-hi transition-colors group-hover:text-signal-amber">
                  HUSH<span className="text-signal-amber transition-colors group-hover:text-ink-hi">WIRE</span>
                </span>
                <span className="block font-mono text-[9px] tracking-widest2 text-ink-lo">
                  PRIVATE NEGOTIATION // PUBLIC SETTLEMENT
                </span>
              </div>
            </a>

            <nav className="flex items-center gap-1 font-mono text-xs tracking-wider">
              <a
                href="/dashboard"
                className="btn-ghost"
              >
                [ CONSOLE ]
              </a>
              <a
                href="/agents"
                className="btn-ghost"
              >
                [ INTERCEPT ]
              </a>
              <a
                href={`https://coston2-explorer.flare.network/address/${addresses.sealedBidAuction}`}
                target="_blank"
                rel="noopener"
                className="hidden sm:inline-block border border-signal-amber/40 bg-signal-amber/5 px-3 py-2 text-signal-amber transition-all duration-200 hover:border-signal-amber hover:bg-signal-amber hover:text-base-0"
              >
                EXPLORER&nbsp;↗
              </a>
            </nav>
          </div>
        </header>

        <main className="relative">{children}</main>

        {/* ── Footer ── */}
        <footer className="border-t border-line bg-base-1/50">
          <div className="mx-auto max-w-7xl px-6 py-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              {/* Left: brand + mission line */}
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <img src="/mark.svg" alt="" className="h-6 w-6 opacity-80" />
                  <span className="font-display text-sm font-bold tracking-wide text-ink-hi">
                    HUSH<span className="text-signal-amber">WIRE</span>
                  </span>
                </div>
                <p className="font-mono text-[10px] tracking-widest2 text-ink-lo">
                  FLARE SUMMER SIGNAL 2026 · CONFIDENTIAL AGENT PAYMENT PROTOCOL
                </p>
                <div className="flex items-center gap-4 font-mono text-[10px] tracking-widest2 pt-1">
                  <span className="flex items-center gap-1.5 text-signal-green">
                    <span className="dot dot-live" /> SETTLEMENTS PUBLIC
                  </span>
                  <span className="flex items-center gap-1.5 text-signal-red">
                    <span className="dot dot-sealed" /> TERMS SEALED
                  </span>
                </div>
              </div>

              {/* Right: on-chain contracts */}
              <div className="space-y-2">
                <div className="label">Live contracts · Coston2</div>
                <div className="space-y-1.5 font-mono text-[11px]">
                  {([
                    ["AUCTION", addresses.sealedBidAuction],
                    ["VAULT", addresses.hushWireVault],
                    ["FXRP", addresses.fxrpToken],
                    ["VERIFIER", addresses.signatureVerifier],
                  ] as const).map(([labelAttr, addr]) => (
                    <a
                      key={labelAttr}
                      href={`https://coston2-explorer.flare.network/address/${addr}`}
                      target="_blank"
                      rel="noopener"
                      className="group flex items-center justify-between gap-6 text-ink-mid transition-colors hover:text-signal-amber"
                    >
                      <span className="text-ink-lo">{labelAttr}</span>
                      <span className="tnum">{shortAddr(addr)} ↗</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}