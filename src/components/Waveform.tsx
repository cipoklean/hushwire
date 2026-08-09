"use client";

/**
 * Animated oscilloscope waveform — a row of bars that pulse like a live signal.
 * Pure CSS animation, staggered per bar.
 */
export default function Waveform({
  bars = 48,
  className = "",
  color = "#ffb020",
  height = "100%",
}: {
  bars?: number;
  className?: string;
  color?: string;
  height?: string;
}) {
  return (
    <div
      className={`flex items-end gap-[3px] ${className}`}
      aria-hidden
      style={{ height }}
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
              boxShadow: `0 0 6px ${color}55`,
              opacity: 0.3 + Math.abs(Math.sin(i * 0.8)) * 0.7,
              animation: `wave ${1.1 + (i % 5) * 0.18}s ease-in-out ${i * 0.06}s infinite`,
            }}
          />
        );
      })}
    </div>
  );
}