import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        site: {
          // Premium dark theme — main app surface
          bg: "#0a0f1c", // page background (very dark navy, almost black)
          card: "#111827", // dark card surface (slate-900-ish)
          "card-hover": "#1a2233", // slightly lighter for hover
          border: "#1f2937", // subtle border (slate-800-ish)
          accent: "#3b82f6", // primary blue (CTAs, active states)
          "accent-soft": "#1e3a8a", // muted blue background tint
          muted: "#94a3b8", // secondary text (slate-400)

          // Sidebar — same family as main bg, separated by a hairline border
          sidebar: "#0a0f1c", // matches main bg
          "sidebar-hover": "#1a2233",
          "sidebar-border": "#1f2937",
          "sidebar-muted": "#94a3b8",
        },
      },
      boxShadow: {
        // Subtle elevation for dark cards — barely visible drop + slight glow
        card: "0 1px 2px 0 rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.02)",
        "card-hover":
          "0 4px 12px -2px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(59, 130, 246, 0.2)",
      },
      keyframes: {
        "toast-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "dialog-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "drawer-in": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "toast-in": "toast-in 180ms ease-out",
        "dialog-in": "dialog-in 150ms ease-out",
        "fade-in": "fade-in 150ms ease-out",
        "drawer-in": "drawer-in 220ms ease-out",
        "pulse-dot": "pulse-dot 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
