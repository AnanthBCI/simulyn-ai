"use client";

import Link from "next/link";
import { AlertOctagon, ArrowRight } from "lucide-react";
import type { AlertItem } from "@/lib/api";

/**
 * Dashboard-only hero alert — mirrors the “critical delay risk” strip in the
 * product mockup without changing global navigation.
 */
export function DashboardCriticalBanner({
  alert,
  projectName,
}: {
  alert: AlertItem | null;
  projectName?: string;
}) {
  if (!alert) return null;

  const name =
    projectName ??
    alert.projectName ??
    (alert.projectId ? "Project" : "Portfolio");
  const task = alert.taskName?.trim() || "Task";
  const reason =
    alert.reason ??
    (alert.message ? stripTaskPrefix(alert.message, alert.taskName) : "Risk detected");
  const delay = alert.delayDays != null ? `${alert.delayDays} day${alert.delayDays === 1 ? "" : "s"}` : null;
  const rec =
    alert.recommendation?.split("\n").map((l) => l.replace(/^[-*]\s*/, "").trim()).filter(Boolean)[0] ??
    "Review the task plan and re-run predictions after changes.";

  const href =
    alert.projectId && alert.taskId
      ? `/projects/${alert.projectId}`
      : alert.projectId
        ? `/projects/${alert.projectId}`
        : "/projects?filter=atRisk";

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-red-500/35 bg-gradient-to-r from-red-950/90 via-red-950/50 to-[#0f172a]/90 p-4 shadow-lg shadow-red-950/20 sm:p-5"
      role="alert"
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-red-500/10 blur-2xl" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-500/20 text-red-300 ring-1 ring-red-500/40">
            <AlertOctagon className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-red-200/90">
              Critical delay risk
            </p>
            <p className="mt-1 truncate text-base font-semibold text-white sm:text-lg">
              {task}
              <span className="font-normal text-red-200/80"> · {name}</span>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-red-100/85">{reason}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-red-200/80">
              {delay && (
                <span>
                  Expected slip: <strong className="text-white">{delay}</strong>
                </span>
              )}
              <span className="hidden sm:inline" aria-hidden>
                ·
              </span>
              <span className="line-clamp-2 sm:line-clamp-1">
                Next step: <span className="text-white/95">{rec}</span>
              </span>
            </div>
          </div>
        </div>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-red-950 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 lg:self-center"
        >
          View details
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function stripTaskPrefix(message: string, taskName?: string | null): string {
  if (!taskName) return message;
  const prefix = `${taskName}:`;
  if (message.startsWith(prefix)) return message.slice(prefix.length).trim();
  return message;
}
