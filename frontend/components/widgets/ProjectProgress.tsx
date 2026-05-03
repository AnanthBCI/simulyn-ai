"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ProjectDto } from "@/lib/api";

/**
 * Compact "mini Gantt" widget. For each project we render a horizontal bar
 * representing the project window, with a filled portion showing how much of
 * the schedule has elapsed. Coloured by health (overdue/at-risk/on-track).
 *
 * No real Gantt library — that would be heavy and the dashboard only needs the
 * "at-a-glance" version. The full per-task Gantt belongs on the project page.
 */
export function ProjectProgress({
  projects,
  limit = 6,
}: {
  projects: ProjectDto[];
  limit?: number;
}) {
  const rows = useMemo(() => {
    const sorted = [...projects].sort((a, b) => {
      // Most "interesting" first: high-risk first, then closest to ending.
      if (a.highRiskTaskCount !== b.highRiskTaskCount) {
        return b.highRiskTaskCount - a.highRiskTaskCount;
      }
      return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
    });
    return sorted.slice(0, limit).map((p) => {
      const tp = timeProgress(p.startDate, p.endDate);
      const remaining = daysRemaining(p.endDate);
      const overdue = remaining < 0;
      const atRisk = p.highRiskTaskCount > 0;
      const barColor = overdue
        ? "bg-red-500"
        : atRisk
          ? "bg-amber-500"
          : "bg-emerald-500";
      return {
        project: p,
        tp,
        remaining,
        overdue,
        atRisk,
        barColor,
      };
    });
  }, [projects, limit]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-site-border bg-site-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">Project progress</h3>
        <span className="text-xs text-site-muted">
          Top {Math.min(limit, projects.length)} of {projects.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="grid h-[220px] place-items-center text-sm text-site-muted">
          No projects yet.
        </div>
      ) : (
        <>
          <ul className="mt-4 flex-1 space-y-3">
            {rows.map(({ project, tp, remaining, overdue, atRisk, barColor }) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="group block rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="line-clamp-1 font-medium text-white group-hover:text-site-accent">
                      {project.name}
                    </span>
                    <span className="shrink-0 text-xs text-site-muted">
                      {overdue ? (
                        <span className="text-red-400">
                          {Math.abs(remaining)}d overdue
                        </span>
                      ) : atRisk ? (
                        <span className="text-amber-400">
                          {remaining}d left · at risk
                        </span>
                      ) : (
                        <span>{remaining}d left</span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${tp}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs tabular-nums text-site-muted">
                      {tp}%
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {projects.length > limit && (
            <Link
              href="/projects"
              className="mt-4 block border-t border-site-border pt-3 text-center text-xs font-medium text-site-accent transition hover:underline focus-visible:outline-none focus-visible:underline"
            >
              View all {projects.length} projects →
            </Link>
          )}
        </>
      )}
    </div>
  );
}

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
