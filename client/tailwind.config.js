/** @type {import("tailwindcss").Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        gravity: {
          bg: "#0a0d14",
          surface: "#101522",
          card: "#141a2b",
          cardHover: "#192238",
          border: "#1d273f",
          borderLight: "#2c3b5d",
          accent: "#6366f1",
          accentHover: "#4f46e5",
          accentLight: "#818cf8",
          purple: "#a855f7",
          cyan: "#06b6d4",
          terminal: "#060911"
        }
      },
      fontFamily: {
        mono: ["JetBrains Mono", "SF Mono", "Fira Code", "Courier New", "monospace"],
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 20px -5px rgba(99, 102, 241, 0.35)",
        cardGlow: "0 4px 24px -2px rgba(10, 13, 20, 0.6), 0 0 16px -4px rgba(99, 102, 241, 0.15)",
      }
    },
  },
  plugins: [],
}
