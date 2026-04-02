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
          bg: "#0c1117",
          card: "#151c24",
          border: "#243041",
          accent: "#3b82f6",
          muted: "#94a3b8",
        },
      },
    },
  },
  plugins: [],
};
export default config;
