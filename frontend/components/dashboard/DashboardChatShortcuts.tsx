"use client";

import { MessageSquareText, Sparkles } from "lucide-react";
import { openAskSimulyn } from "@/lib/chat-bridge";

const PROMPTS = [
  "What's at risk this week?",
  "Show me high-risk tasks across the org",
  "Give me a portfolio summary",
];

export function DashboardChatShortcuts() {
  return (
    <div className="rounded-xl border border-site-accent/25 bg-gradient-to-b from-site-accent/10 to-[#0f172a]/60 p-5 shadow-card backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-site-accent/20 text-site-accent">
          <Sparkles className="h-4 w-4" aria-hidden />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Ask Simulyn AI</h3>
          <p className="text-[11px] text-site-muted">Jump in with a suggested question</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {PROMPTS.map((q) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => openAskSimulyn(q)}
              className="flex w-full items-start gap-2 rounded-lg border border-site-border bg-site-bg/40 px-3 py-2.5 text-left text-xs leading-relaxed text-slate-300 transition hover:border-site-accent/45 hover:bg-site-accent/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
            >
              <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-site-accent" aria-hidden />
              {q}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => openAskSimulyn()}
        className="mt-3 w-full rounded-lg bg-site-accent py-2.5 text-sm font-semibold text-white transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
      >
        Open chat
      </button>
    </div>
  );
}
