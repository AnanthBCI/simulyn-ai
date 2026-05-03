import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";
import { CookieBanner } from "@/components/CookieBanner";

export const metadata: Metadata = {
  title: "Simulyn AI — Predict. Explain. Act.",
  description:
    "The construction risk co-pilot. Deterministic risk scores, AI project health briefs and weekly recaps, and five scenario types of what-if simulation — side by side.",
  keywords: [
    "construction AI",
    "schedule risk",
    "delay prediction",
    "what-if simulation",
    "AI project health",
    "weekly look-ahead",
    "construction project management",
    "AI scheduling",
  ],
  openGraph: {
    title: "Simulyn AI — Predict. Explain. Act.",
    description:
      "The construction risk co-pilot. AI project briefs, weekly recaps, and five scenario types of what-if simulation — side by side.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
        <CookieBanner />
      </body>
    </html>
  );
}
