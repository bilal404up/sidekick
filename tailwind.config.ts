import type { Config } from "tailwindcss";

/*
 * "The cited answer" identity. A serif for statements, a precise sans for the interface,
 * mono for citation numbers. Colour carries one idea: moss means sourced, ember means not in the FAQ.
 * Contrast on paper: ink-2 about 7:1, ink-3 about 4.8:1 (13px and up only), moss about 7:1, ember about 6.6:1.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-body)", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      colors: {
        paper: "#F5F3EC",
        sheet: "#FFFFFF",
        ink: { DEFAULT: "#16181B", 2: "#4D5258", 3: "#676C72" },
        rule: { DEFAULT: "#DCD8CC", strong: "#B5AF9F" },
        moss: { DEFAULT: "#1D5A3C", dark: "#154630", tint: "#E2ECE4" },
        marker: "#D6EFB4",
        ember: { DEFAULT: "#B3501A", dark: "#8F3F14", tint: "#F7E7DA" },
        night: { DEFAULT: "#111513", ink: "#E9E6DC", 2: "#A7ACA3", rule: "#2A302C" },
        error: "#B42318",
      },
      borderRadius: { xs: "2px", sm: "4px", md: "4px", lg: "8px", xl: "8px", "2xl": "8px" },
      boxShadow: {
        sheet: "0 1px 0 rgba(22,24,27,.04), 0 30px 60px -30px rgba(22,24,27,.28)",
        lift: "0 1px 2px rgba(22,24,27,.06), 0 12px 32px -12px rgba(22,24,27,.22)",
      },
      transitionTimingFunction: { out: "cubic-bezier(.2,.7,.1,1)" },
      maxWidth: { page: "1240px" },
    },
  },
  plugins: [],
};

export default config;
