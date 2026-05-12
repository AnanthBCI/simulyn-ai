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
const SEVERITY_LABEL: Record<string, string> = {
  High: "CRITICAL",
  Medium: "WARNING",
  Low: "INFO",
};

export function AiInsights({
  insights,
  loading,
  title = "AI task insights",
  severityBadges = false,
  className = "",
}: {
  insights: InsightItem[];
  loading?: boolean;
  title?: string;
  /** When true, show CRITICAL / WARNING / INFO chips (dashboard layout). */
  severityBadges?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex h-full flex-col rounded-xl border border-site-border bg-site-card/80 p-5 shadow-card backdrop-blur-sm ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <span className="text-xs text-site-muted">Highest priority first</span>
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
        <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-site-border bg-site-bg/40 px-4 py-10 text-center">
          <div className="text-sm text-site-muted">
            <p className="font-medium text-slate-300">No AI insights yet.</p>
            <p className="mt-1 text-xs leading-relaxed">
              Open a project and run predictions (or load the sample project) to see summaries here.
            </p>
          </div>
          <Link
            href="/projects"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-site-accent px-4 text-sm font-semibold text-white transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
          >
            Go to projects
          </Link>
        </div>
      ) : (
        <ul className="mt-4 flex-1 space-y-3">
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
            const severity = SEVERITY_LABEL[it.riskLevel] ?? "INFO";
            return (
              <li
                key={it.taskId}
                className="flex gap-3 rounded-lg border border-site-border bg-[#0f172a]/80 p-3 transition hover:border-site-accent/40 hover:bg-white/5"
              >
                <div
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${tone.bg} ring-1 ${tone.ring}`}
                >
                  <Icon className={`h-4 w-4 ${tone.accent}`} aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  {severityBadges && (
                    <span
                      className={`mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        it.riskLevel === "High"
                          ? "bg-red-500/20 text-red-300"
                          : it.riskLevel === "Medium"
                            ? "bg-amber-500/20 text-amber-200"
                            : "bg-slate-500/25 text-slate-300"
                      }`}
                    >
                      {severity}
                    </span>
                  )}
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
      {insights.length > 0 && (
        <div className="mt-4 border-t border-site-border pt-3">
          <Link
            href="/projects"
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-site-border bg-site-bg/60 text-sm font-medium text-site-accent transition hover:border-site-accent/40 hover:bg-site-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
          >
            Open project list
          </Link>
        </div>
      )}
    </div>
  );
}
