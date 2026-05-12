"use client";

import { CheckCircle2 } from "lucide-react";
import type { AlertItem, InsightItem } from "@/lib/api";

function linesFrom(text: string | null | undefined, max: number): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/\n/)
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, max);
}

/**
 * Pulls concrete action lines from AI insight + alert text for the dashboard rail.
 */
export function DashboardRecommendedActions({
  insights,
  alerts,
  maxItems = 5,
}: {
  insights: InsightItem[];
  alerts: AlertItem[];
  maxItems?: number;
}) {
  const items: string[] = [];
  const seen = new Set<string>();

  function pushUnique(line: string) {
    const k = line.toLowerCase();
    if (seen.has(k) || items.length >= maxItems) return;
    seen.add(k);
    items.push(line);
  }

  for (const a of alerts) {
    for (const line of linesFrom(a.recommendation, 3)) {
      pushUnique(line);
      if (items.length >= maxItems) break;
    }
    if (items.length >= maxItems) break;
  }
  for (const i of insights) {
    for (const line of linesFrom(i.recommendation, 2)) {
      pushUnique(line);
      if (items.length >= maxItems) break;
    }
    if (items.length >= maxItems) break;
  }

  return (
    <div className="rounded-xl border border-site-border bg-site-card/80 p-5 shadow-card backdrop-blur-sm">
      <h3 className="text-base font-semibold text-white">AI recommended actions</h3>
      <p className="mt-1 text-xs text-site-muted">Synthesized from alerts and task insights</p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-site-muted">
          Run predictions on a few tasks — actionable bullets will show up here.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((line) => (
            <li key={line} className="flex gap-2.5 text-sm leading-snug text-slate-200">
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/90"
                aria-hidden
              />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
