import type { Metadata } from "next";
import { Young_Serif, Atkinson_Hyperlegible, Courier_Prime } from "next/font/google";
import "./globals.css";

const display = Young_Serif({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });
const body = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-body", display: "swap" });
const card = Courier_Prime({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-card", display: "swap" });

export const metadata: Metadata = {
  title: "Sidekick: a support chatbot that only answers from your FAQ",
  description:
    "A demo help desk assistant for a fictional shop. It answers only from the shop's own help file, shows the card it used, says so when something is not on file, and saves the question for the owner. Sample data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${card.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
