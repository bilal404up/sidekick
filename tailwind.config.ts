import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-body)", "Helvetica Neue", "Arial", "sans-serif"],
        card: ["var(--font-card)", "Courier New", "monospace"],
        mono: ["var(--font-card)", "ui-monospace", "Menlo", "Consolas", "monospace"],
      },
      colors: {
        cabinet: { DEFAULT: "#3A2819", raised: "#4A3421", line: "#5E4530" },
        card: { DEFAULT: "#FFFDF6", edge: "#D9CBB0", dim: "#D9CBB0" },
        kraft: { DEFAULT: "#E3D3AE", deep: "#D6C294" },
        ink: { DEFAULT: "#1D1B17", muted: "#4A443A", subtle: "#645D51" },
        stamp: { DEFAULT: "#B3261E", soft: "#F6DDD8" },
        file: { DEFAULT: "#2F6B3A", soft: "#E2ECDD" },
        brass: { DEFAULT: "#C9A35B", light: "#D8B46C", dark: "#8C6A2C" },
        rule: "#A9BEDC",
        // Legacy names, remapped so any file that still uses them matches the new look.
        paper: { DEFAULT: "#E3D3AE", raised: "#FFFDF6", sunk: "#D6C294" },
        line: { DEFAULT: "#CDBF9F", strong: "#1D1B17" },
        pine: { DEFAULT: "#2F6B3A", dark: "#234F2B", 50: "#E2ECDD", 100: "#C8D9C2" },
        pink: { DEFAULT: "#F2B8B0", 50: "#F6DDD8" },
        warning: "#8A5A00",
        error: "#B42318",
      },
      borderRadius: { xs: "3px", sm: "5px", md: "8px", lg: "12px" },
      boxShadow: {
        pop: "0 8px 24px rgba(58, 40, 25, 0.18)",
        drawer: "0 1px 0 #5E4530, 0 28px 44px -20px rgba(15, 9, 4, 0.7)",
      },
    },
  },
  plugins: [],
};

export default config;
