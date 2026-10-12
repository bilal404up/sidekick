import type { Metadata } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

const sans = Schibsted_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "Sidekick: a support chatbot that only answers from your FAQ",
  description:
    "A demo support assistant for a fictional shop. Every answer links to the FAQ entry it came from, and questions the FAQ does not cover go to the owner instead of being made up. Sample data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
