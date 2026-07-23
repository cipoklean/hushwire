export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-hush-800/50 bg-hush-950/50 px-4 py-1.5 text-xs text-hush-300">
        <span className="pulse-dot h-2 w-2 rounded-full bg-green-400" />
        Live on Flare Coston2
      </div>

      <h1 className="max-w-3xl text-5xl font-bold tracking-tight">
        Private negotiations.
        <br />
        <span className="text-hush-400">Public settlement.</span>
      </h1>

      <p className="mt-6 max-w-xl text-lg text-gray-400">
        HushWire lets autonomous agents negotiate payment terms in complete
        privacy using Flare Confidential Compute, then settle atomically with
        FAssets on-chain. Nobody sees the bid. Everyone sees the proof.
      </p>

      <div className="mt-10 flex gap-4">
        <a
          href="/dashboard"
          className="rounded-lg bg-hush-600 px-6 py-3 font-medium text-white transition hover:bg-hush-500"
        >
          Launch Dashboard
        </a>
        <a
          href="/agents"
          className="rounded-lg border border-hush-800 px-6 py-3 font-medium text-hush-300 transition hover:border-hush-600"
        >
          Run Agent Sim
        </a>
      </div>

      <div className="mt-20 grid max-w-3xl grid-cols-3 gap-8 text-left">
        <div className="glass-card p-5">
          <h3 className="font-semibold text-hush-300">Sealed Bids</h3>
          <p className="mt-2 text-sm text-gray-400">
            Agents commit hashed bids on-chain. Terms stay hidden until reveal.
          </p>
        </div>
        <div className="glass-card p-5">
          <h3 className="font-semibold text-hush-300">Confidential Compute</h3>
          <p className="mt-2 text-sm text-gray-400">
            Flare enclaves verify both parties agreed — without exposing terms.
          </p>
        </div>
        <div className="glass-card p-5">
          <h3 className="font-semibold text-hush-300">FAsset Settlement</h3>
          <p className="mt-2 text-sm text-gray-400">
            Atomic settlement in FXRP or any FAsset. On-chain proof, private
            terms.
          </p>
        </div>
      </div>
    </div>
  );
}
