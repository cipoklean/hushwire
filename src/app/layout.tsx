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
    "Confidential agent-to-agent negotiation and FAsset settlement on Flare. Sealed bids, enclave verification, atomic settlement.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${chakra.variable} ${plexMono.variable} ${plexSans.variable}`}>
      <body className="min-h-screen scanlines">
        <div className="console-bg" aria-hidden />

        {/* ── Console status bar ── */}
        <div className="border-b border-line bg-base-1/80 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2">
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-widest2 text-ink-lo">
              <span className="dot dot-live" />
              <span className="text-signal-green">COSTON2 · CHAIN 114</span>
              <span className="hidden sm:inline text-ink-lo">/</span>
              <span className="hidden sm:inline">BLOCK LIVE</span>
            </div>
            <div className="flex items-center gap-4 font-mono text-[10px] tracking-widest2 text-ink-lo">
              <span className="hidden md:inline">ENCLAVE: <span className="text-signal-cyan">READY</span></span>
              <span>FASSET: <span className="text-signal-amber">FXRP</span></span>
            </div>
          </div>
        </div>

        {/* ── Header ── */}
        <header className="sticky top-0 z-40 border-b border-line bg-base-0/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <a href="/" className="group flex items-center gap-3">
              <div className="relative flex h-9 w-9 items-center justify-center border border-signal-amber/60 bg-base-2 transition-colors group-hover:bg-signal-amber/10">
                <span className="font-display text-sm font-bold text-signal-amber">HW</span>
                <span className="absolute -right-1 -top-1 dot dot-amber" />
              </div>
              <div className="leading-tight">
                <span className="font-display text-lg font-bold tracking-wide text-ink-hi">
                  HUSH<span className="text-signal-amber">WIRE</span>
                </span>
                <span className="block font-mono text-[9px] tracking-widest2 text-ink-lo">
                  SIGNAL // SETTLE
                </span>
              </div>
            </a>

            <nav className="flex items-center gap-1 font-mono text-xs tracking-wider">
              <a
                href="/dashboard"
                className="border border-transparent px-3 py-2 text-ink-mid transition-all hover:border-line hover:bg-base-2 hover:text-signal-amber"
              >
                [ CONSOLE ]
              </a>
              <a
                href="/agents"
                className="border border-transparent px-3 py-2 text-ink-mid transition-all hover:border-line hover:bg-base-2 hover:text-signal-amber"
              >
                [ INTERCEPT ]
              </a>
              <a
                href={`https://coston2-explorer.flare.network/address/${addresses.sealedBidAuction}`}
                target="_blank"
                rel="noopener"
                className="hidden sm:inline-block border border-signal-amber/40 bg-signal-amber/5 px-3 py-2 text-signal-amber transition-all hover:bg-signal-amber hover:text-base-0"
              >
                EXPLORER ↗
              </a>
            </nav>
          </div>
        </header>

        <main>{children}</main>

        {/* ── Footer ── */}
        <footer className="border-t border-line bg-base-1/60">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="font-mono text-[10px] tracking-widest2 text-ink-lo">
              HUSHWIRE // FLARE SUMMER SIGNAL 2026
            </div>
            <div className="flex items-center gap-4 font-mono text-[10px] tracking-widest2 text-ink-lo">
              <span className="flex items-center gap-1.5">
                <span className="dot dot-live" /> SETTLEMENTS PUBLIC
              </span>
              <span className="flex items-center gap-1.5">
                <span className="dot dot-sealed" /> TERMS SEALED
              </span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
