import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HushWire — Private Agent Settlement on Flare",
  description:
    "Confidential agent-to-agent negotiation and FAsset settlement. Built on Flare Confidential Compute.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-hush-900/30 px-6 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-hush-600 flex items-center justify-center text-sm font-bold">
                HW
              </div>
              <span className="text-lg font-semibold tracking-tight">
                Hush<span className="text-hush-400">Wire</span>
              </span>
            </div>
            <nav className="flex items-center gap-6 text-sm text-gray-400">
              <a href="/dashboard" className="hover:text-hush-300 transition">
                Dashboard
              </a>
              <a href="/agents" className="hover:text-hush-300 transition">
                Agents
              </a>
              <a
                href="https://coston2-explorer.flare.network"
                target="_blank"
                rel="noopener"
                className="hover:text-hush-300 transition"
              >
                Explorer ↗
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
