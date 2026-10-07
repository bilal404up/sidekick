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
        paper: { DEFAULT: "#EDF1EE", raised: "#FFFFFF", sunk: "#E1E8E3" },
        ink: { DEFAULT: "#10231C", muted: "#3F5249", subtle: "#566A60" },
        line: { DEFAULT: "#C3D0C9", strong: "#10231C" },
        pine: { DEFAULT: "#0F6B4F", dark: "#0A4D38", 50: "#E3F1EA", 100: "#C9E5D8" },
        pink: { DEFAULT: "#FF8FB1", 50: "#FFE3EC" },
        warning: "#8A5A00",
        error: "#B42318",
      },
      borderRadius: { xs: "4px", sm: "6px", md: "10px", lg: "14px" },
      boxShadow: { pop: "0 8px 24px rgba(16, 35, 28, 0.14)" },
    },
  },
  plugins: [],
};

export default config;
