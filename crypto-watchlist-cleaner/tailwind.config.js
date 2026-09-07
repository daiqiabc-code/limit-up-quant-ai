/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: "#070b12",
          panel: "#0d1420",
          panel2: "#111a29",
          border: "#1b2536",
          border2: "#243044",
          fg: "#cbd5e1",
          muted: "#64748b",
          bright: "#f1f5f9",
        },
        grade: {
          s: "#7c3aed",
          a: "#2563eb",
          b: "#0891b2",
          c: "#64748b",
        },
      },
      fontFamily: {
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      boxShadow: {
        panel: "0 0 0 1px rgba(36,48,68,0.6)",
      },
    },
  },
  plugins: [],
};