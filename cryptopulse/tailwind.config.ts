import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#06080C",
          canvas: "#080B11",
          panel: "#0C1119",
          elevated: "#111824",
          hover: "#161F2E",
        },
        line: {
          DEFAULT: "#1A2332",
          soft: "rgba(148,163,184,0.10)",
          strong: "#283448",
        },
        ink: {
          DEFAULT: "#E8EEF6",
          high: "#F5F8FC",
          mid: "#9AA7BC",
          low: "#5C6A80",
          faint: "#3D485C",
        },
        signal: {
          DEFAULT: "#16E6C8",
          dim: "#0C9C86",
          glow: "#16E6C8",
        },
        bull: {
          DEFAULT: "#2EE6A6",
          dim: "#16785A",
        },
        bear: {
          DEFAULT: "#FF5C7A",
          dim: "#8C2738",
        },
        warn: {
          DEFAULT: "#FFB020",
          dim: "#8C6010",
        },
        info: {
          DEFAULT: "#5B9DFF",
          dim: "#2A518C",
        },
        violet: {
          DEFAULT: "#A78BFA",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      borderRadius: {
        xs: "4px",
        xl: "14px",
        "2xl": "18px",
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 0 0 1px rgba(148,163,184,0.08)",
        glow: "0 0 0 1px rgba(22,230,200,0.25), 0 0 24px -4px rgba(22,230,200,0.35)",
        "glow-bull": "0 0 0 1px rgba(46,230,166,0.25), 0 0 24px -4px rgba(46,230,166,0.35)",
        "glow-bear": "0 0 0 1px rgba(255,92,122,0.25), 0 0 24px -4px rgba(255,92,122,0.35)",
        float: "0 18px 40px -12px rgba(0,0,0,0.6)",
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(to right, rgba(148,163,184,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.045) 1px, transparent 1px)",
        "radial-fade":
          "radial-gradient(60% 60% at 50% 0%, rgba(22,230,200,0.08) 0%, transparent 70%)",
        "noise":
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E\")",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(0.85)" },
        },
        "ticker-scroll": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
        "pulse-dot": "pulse-dot 1.8s ease-in-out infinite",
        "ticker-scroll": "ticker-scroll 60s linear infinite",
        shimmer: "shimmer 2.5s linear infinite",
        "spin-slow": "spin-slow 12s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
