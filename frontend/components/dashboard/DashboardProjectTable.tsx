"use client";

import Link from "next/link";
import type { ProjectDto } from "@/lib/api";

function timeProgress(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!isFinite(s) || !isFinite(e) || e <= s) return 0;
  const now = Date.now();
  if (now <= s) return 0;
  if (now >= e) return 100;
  return Math.round(((now - s) / (e - s)) * 100);
}

function daysRemaining(end: string): number {
  return Math.round((new Date(end).getTime() - Date.now()) / 86_400_000);
}

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

/**
 * Dense project table for the redesigned dashboard (does not affect /projects).
 */
export function DashboardProjectTable({
  projects,
  limit = 8,
}: {
  projects: ProjectDto[];
  limit?: number;
}) {
  const rows = [...projects]
    .sort((a, b) => {
      if (a.highRiskTaskCount !== b.highRiskTaskCount) {
        return b.highRiskTaskCount - a.highRiskTaskCount;
      }
      return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
    })
    .slice(0, limit);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-site-border bg-site-card/80 p-8 text-center text-sm text-site-muted backdrop-blur-sm">
        No projects yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-site-border bg-site-card/80 shadow-card backdrop-blur-sm">
      <div className="border-b border-site-border px-4 py-4 sm:px-5">
        <h3 className="text-base font-semibold text-white">Project progress</h3>
        <p className="mt-0.5 text-xs text-site-muted">
          Schedule elapsed vs window · {rows.length} shown
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-site-border text-[11px] font-semibold uppercase tracking-wider text-site-muted">
              <th className="px-4 py-3 sm:px-5">Project</th>
              <th className="px-4 py-3 sm:px-5">Progress</th>
              <th className="px-4 py-3 sm:px-5">Status</th>
              <th className="px-4 py-3 sm:px-5">Target</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-site-border">
            {rows.map((p) => {
              const tp = timeProgress(p.startDate, p.endDate);
              const remaining = daysRemaining(p.endDate);
              const overdue = remaining < 0;
              const atRisk = p.highRiskTaskCount > 0;
              return (
                <tr key={p.id} className="transition hover:bg-white/[0.03]">
                  <td className="px-4 py-3 sm:px-5">
                    <Link
                      href={`/projects/${p.id}`}
                      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
                    >
                      <span className="font-medium text-white group-hover:text-site-accent">
                        {p.name}
                      </span>
                      <span className="mt-0.5 block font-mono text-[11px] text-site-muted">
                        ID {shortId(p.id)}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 min-w-[96px] flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full ${
                            overdue ? "bg-red-500" : atRisk ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${tp}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-xs tabular-nums text-site-muted">
                        {tp}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 sm:px-5">
                    {overdue ? (
                      <span className="inline-flex rounded-md bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-300 ring-1 ring-red-500/30">
                        Delayed
                      </span>
                    ) : atRisk ? (
                      <span className="inline-flex rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-200 ring-1 ring-amber-500/30">
                        At risk
                      </span>
                    ) : (
                      <span className="inline-flex rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-500/25">
                        On track
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 sm:px-5">
                    <span className="text-slate-200">
                      {new Date(p.endDate).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    {overdue && (
                      <span className="mt-0.5 block text-xs font-medium text-red-400">
                        {Math.abs(remaining)}d overdue
                      </span>
                    )}
                    {!overdue && atRisk && (
                      <span className="mt-0.5 block text-xs text-amber-400/90">
                        {remaining}d remaining
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {projects.length > limit && (
        <div className="border-t border-site-border px-4 py-3 text-center sm:px-5">
          <Link
            href="/projects"
            className="text-xs font-medium text-site-accent hover:underline focus-visible:outline-none focus-visible:underline"
          >
            View all {projects.length} projects →
          </Link>
        </div>
      )}
    </div>
  );
}
