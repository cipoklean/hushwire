"use client";

/**
 * Animated oscilloscope waveform — a row of bars that pulse like a live signal.
 * Pure CSS animation, staggered per bar.
 */
export default function Waveform({
  bars = 48,
  className = "",
  color = "#ffb020",
}: {
  bars?: number;
  className?: string;
  color?: string;
}) {
  return (
    <div
      className={`flex h-12 items-end gap-[3px] ${className}`}
      aria-hidden
    >
      {Array.from({ length: bars }).map((_, i) => {
        // Deterministic pseudo-random height pattern
        const h = 20 + Math.abs(Math.sin(i * 1.7) * 70) + Math.abs(Math.cos(i * 0.9) * 10);
        return (
          <span
            key={i}
            className="w-[3px] origin-bottom rounded-sm"
            style={{
              height: `${Math.min(h, 100)}%`,
              background: color,
              opacity: 0.35 + Math.abs(Math.sin(i * 0.8)) * 0.65,
              animation: `wave ${1.1 + (i % 5) * 0.18}s ease-in-out ${i * 0.06}s infinite`,
            }}
          />
        );
      })}
    </div>
  );
}
