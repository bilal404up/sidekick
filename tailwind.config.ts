import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "Helvetica Neue", "Arial", "sans-serif"],
        sans: ["var(--font-body)", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      colors: {
        canvas: "#FAFAF7",
        surface: "#FFFFFF",
        ink: { DEFAULT: "#15181B", muted: "#5B6168", subtle: "#6B7178" },
        rule: { DEFAULT: "#E4E4DF", strong: "#8A9096" },
        found: { DEFAULT: "#117A4A", dark: "#0C5C37", soft: "#E7F3EC", mark: "#CDE9D8" },
        asked: { DEFAULT: "#B45309", dark: "#8A3F06", soft: "#FDF0E1" },
        // Legacy names, kept so any older file still compiles.
        paper: { DEFAULT: "#FAFAF7", raised: "#FFFFFF", sunk: "#F1F1EC" },
        line: { DEFAULT: "#E4E4DF", strong: "#15181B" },
        pine: { DEFAULT: "#117A4A", dark: "#0C5C37", 50: "#E7F3EC", 100: "#CDE9D8" },
        pink: { DEFAULT: "#F6C9A0", 50: "#FDF0E1" },
        warning: "#8A5A00",
        error: "#B42318",
      },
      borderRadius: { xs: "4px", sm: "6px", md: "10px", lg: "14px", xl: "20px" },
      boxShadow: {
        pop: "0 1px 2px rgba(21,24,27,.06), 0 8px 24px rgba(21,24,27,.08)",
        panel: "0 1px 0 rgba(21,24,27,.04), 0 12px 32px -12px rgba(21,24,27,.18)",
      },
    },
  },
  plugins: [],
};

export default config;
