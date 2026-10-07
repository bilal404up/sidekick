import type { Metadata } from "next";
import { Familjen_Grotesk, Public_Sans } from "next/font/google";
import "./globals.css";

const display = Familjen_Grotesk({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-display", display: "swap" });
const body = Public_Sans({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "Sidekick: a support chatbot that only answers from your FAQ",
  description:
    "A demo support chatbot for a fictional shop. It answers from the shop's own help pages, says so when it does not know, and saves unanswered questions for the owner. Sample data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
