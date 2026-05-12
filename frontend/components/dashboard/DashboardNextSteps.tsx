"use client";

import Link from "next/link";
import { ArrowRight, ClipboardList, Sparkles, Wand2 } from "lucide-react";
import type { DashboardSummary } from "@/lib/api";

const btnPrimary =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-site-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40";
const btnSecondary =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-site-border bg-site-card px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-site-accent/30 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40";

/**
 * Surfaces the one or two actions a PM is most likely to need next, so the
 * dashboard reads as a to-do strip instead of only charts.
 */
export function DashboardNextSteps({
  summary,
  projectCount,
}: {
  summary: DashboardSummary | null;
  projectCount: number;
}) {
  if (projectCount === 0) return null;

  const high = summary?.highRiskTasks ?? 0;
  const alerts = summary?.openAlerts ?? 0;
  const needsAttention = high > 0 || alerts > 0;

  if (needsAttention) {
    const riskLabel =
      high > 0 ? `${high} high-risk` : null;
    const alertLabel = alerts > 0 ? `${alerts} alert${alerts === 1 ? "" : "s"}` : null;
    const suffix = [riskLabel, alertLabel].filter(Boolean).join(" · ");

    return (
      <div
        className="rounded-2xl border border-site-border border-l-4 border-l-site-accent bg-site-card p-4 pl-5 shadow-card sm:p-5"
        role="region"
        aria-label="Shortcuts to project lists and simulator"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-site-muted">
              Shortcuts
            </p>
            <p className="mt-1 text-base font-semibold text-white sm:text-lg">
              Open lists when you are ready to act
            </p>
            <p className="mt-1 text-sm leading-relaxed text-site-muted">
              The <span className="font-medium text-slate-300">AI weekly recap</span> below is
              the narrative (what changed and why). This row is only navigation—counts on the
              buttons match your portfolio right now.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:shrink-0">
            <Link href="/projects?filter=atRisk" className={btnPrimary}>
              <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
              At-risk projects
              {suffix ? (
                <span className="rounded-md bg-white/15 px-2 py-0.5 text-xs font-medium tabular-nums">
                  {suffix}
                </span>
              ) : null}
              <ArrowRight className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            </Link>
            <Link href="/simulation" className={btnSecondary}>
              <Wand2 className="h-4 w-4 shrink-0" aria-hidden />
              What-if simulator
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-site-border border-l-4 border-l-emerald-500/70 bg-site-card p-4 pl-5 shadow-card sm:p-5"
      role="status"
      aria-label="Shortcuts when portfolio is calm"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30">
            <Sparkles className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-site-muted">
              Shortcuts
            </p>
            <p className="mt-0.5 text-base font-semibold text-white sm:text-lg">Nothing critical is flashing</p>
            <p className="mt-1 text-sm text-site-muted">
              Use the weekly recap for the story; add work here when you want to grow the portfolio.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
          <Link href="/projects/new" className={btnPrimary}>
            Add a project
            <ArrowRight className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          </Link>
          <Link href="/simulation" className={btnSecondary}>
            <Wand2 className="h-4 w-4 shrink-0" aria-hidden />
            Try a what-if
          </Link>
        </div>
      </div>
    </div>
  );
}
