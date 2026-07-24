import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Deep charcoal-teal base (signal console)
        base: {
          0: "#0b0f0e",
          1: "#101614",
          2: "#161f1c",
          3: "#1d2825",
        },
        line: "#26332e",
        // Signal colors — used semantically
        signal: {
          amber: "#ffb020",
          amberHi: "#ffc247",
          green: "#35d07f",
          cyan: "#4fd1c5",
          red: "#ff5c5c",
        },
        ink: {
          hi: "#eef2ef",
          mid: "#9aa8a2",
          lo: "#5c6b65",
        },
      },
      fontFamily: {
        display: ["var(--font-chakra)", "sans-serif"],
        mono: ["var(--font-plex-mono)", "monospace"],
        sans: ["var(--font-plex-sans)", "sans-serif"],
      },
      letterSpacing: {
        widest2: "0.28em",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        blink: "blink 1.1s step-end infinite",
        sweep: "sweep 4s linear infinite",
        "fade-up": "fadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
        flicker: "flicker 5s linear infinite",
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        sweep: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "92%": { opacity: "1" },
          "93%": { opacity: "0.6" },
          "94%": { opacity: "1" },
          "96%": { opacity: "0.8" },
          "97%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
