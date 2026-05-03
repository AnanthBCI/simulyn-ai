"use client";

import Link from "next/link";
import { AlertTriangle, TrendingUp, Lightbulb } from "lucide-react";
import type { InsightItem } from "@/lib/api";

const ICON_BY_RISK = {
  High: {
    icon: AlertTriangle,
    accent: "text-red-400",
    bg: "bg-red-500/10",
    ring: "ring-red-500/30",
  },
  Medium: {
    icon: TrendingUp,
    accent: "text-amber-400",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/30",
  },
  Low: {
    icon: Lightbulb,
    accent: "text-emerald-400",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/30",
  },
} as const;

/**
 * Surface the top AI insights across the whole org. Each card shows the
 * AI-generated short summary plus a deep-link to the affected project. Backed
 * by GET /api/dashboard/insights.
 */
export function AiInsights({
  insights,
  loading,
}: {
  insights: InsightItem[];
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-site-border bg-site-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">AI insights</h3>
        <span className="text-xs text-site-muted">Highest-priority first</span>
      </div>

      {loading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex animate-pulse gap-3">
              <div className="h-8 w-8 rounded-full bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-2/3 rounded bg-white/10" />
                <div className="h-2 w-full rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      ) : insights.length === 0 ? (
        <div className="mt-4 grid h-[180px] place-items-center text-sm text-site-muted">
          <div className="text-center">
            <p>No AI insights yet.</p>
            <p className="mt-1 text-xs">
              Run predictions on a project to populate this widget.
            </p>
          </div>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {insights.map((it) => {
            const tone =
              ICON_BY_RISK[it.riskLevel as keyof typeof ICON_BY_RISK] ?? ICON_BY_RISK.Low;
            const Icon = tone.icon;
            const headline = (it.summary ?? "AI prediction").trim();
            const body = (it.recommendation ?? "")
              .split("\n")
              .slice(0, 2)
              .join(" ")
              .trim();
            return (
              <li
                key={it.taskId}
                className="flex gap-3 rounded-lg border border-site-border bg-site-bg/50 p-3 transition hover:border-site-accent/40 hover:bg-white/5"
              >
                <div
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${tone.bg} ring-1 ${tone.ring}`}
                >
                  <Icon className={`h-4 w-4 ${tone.accent}`} aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-white">{headline}</p>
                  {body && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-400">{body}</p>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-site-muted">
                    <span className={tone.accent}>{it.riskLevel}</span>
                    <span>·</span>
                    <Link
                      href={`/projects/${it.projectId}`}
                      className="truncate text-site-accent hover:underline"
                    >
                      {it.projectName} → {it.taskName}
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
