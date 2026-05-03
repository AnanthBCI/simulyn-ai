"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, HelpCircle } from "lucide-react";
import type { AlertItem } from "@/lib/api";

/**
 * Dashboard alerts surface. Each alert shows:
 *   - a risk chip,
 *   - the plain-English reason (AI summary),
 *   - an expandable recommendation (AI mitigation plan),
 *   - a "Why?" tooltip with the deterministic math behind the risk call.
 */
export function AlertsWidget({
  alerts,
  projectNameById,
  loading,
  limit = 4,
}: {
  alerts: AlertItem[];
  projectNameById: Map<string, string>;
  loading?: boolean;
  limit?: number;
}) {
  const shown = alerts.slice(0, limit);

  return (
    <div className="rounded-xl border border-site-border bg-site-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">Top risk alerts</h3>
        {alerts.length > shown.length && (
          <span className="text-xs text-site-muted">
            {shown.length} of {alerts.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-site-border bg-site-bg/50 p-3">
              <div className="h-3 w-24 rounded bg-white/10" />
              <div className="mt-2 h-3 w-5/6 rounded bg-white/5" />
            </div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="mt-4 grid h-[180px] place-items-center text-center text-sm text-site-muted">
          <div>
            <p>No active alerts.</p>
            <p className="mt-1 text-xs">Predictions are clean.</p>
          </div>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {shown.map((a, i) => (
            <AlertRow
              key={`${a.taskId ?? "noid"}-${i}`}
              alert={a}
              projectName={
                a.projectName ??
                (a.projectId ? projectNameById.get(a.projectId) : undefined)
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AlertRow({
  alert,
  projectName,
}: {
  alert: AlertItem;
  projectName?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);

  const reason =
    alert.reason ??
    (alert.message ? stripTaskPrefix(alert.message, alert.taskName) : "Risk detected");

  const hasRecommendation = !!(alert.recommendation && alert.recommendation.trim());

  return (
    <li className="rounded-lg border border-site-border bg-site-bg/50 p-3 transition hover:border-site-accent/40">
      <div className="flex items-start gap-2">
        <RiskChip level={alert.riskLevel} />
        <div className="min-w-0 flex-1">
          {alert.taskName && (
            <p className="truncate text-sm font-medium text-white">{alert.taskName}</p>
          )}
          <p className="mt-0.5 text-sm text-slate-300">{reason}</p>
        </div>
        <span className="shrink-0 text-[10px] uppercase tracking-wider text-site-muted">
          {timeAgo(alert.createdAt)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {alert.delayDays != null && alert.delayDays > 0 && (
          <span className="rounded-md border border-site-border bg-white/5 px-1.5 py-0.5 text-site-muted">
            ~{alert.delayDays}d est. delay
          </span>
        )}
        {alert.whySignal && (
          <button
            type="button"
            onClick={() => setWhyOpen((v) => !v)}
            onBlur={() => setWhyOpen(false)}
            aria-expanded={whyOpen}
            className="relative inline-flex items-center gap-1 rounded-md border border-site-border bg-site-bg/60 px-2 py-0.5 text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
            title={alert.whySignal}
          >
            <HelpCircle className="h-3 w-3" aria-hidden />
            Why?
            {whyOpen && (
              <span
                role="tooltip"
                className="pointer-events-none absolute left-0 top-full z-10 mt-1 w-64 rounded-md border border-site-border bg-site-card px-2.5 py-1.5 text-left text-[11px] font-normal normal-case tracking-normal text-slate-200 shadow-lg"
              >
                {alert.whySignal}
              </span>
            )}
          </button>
        )}
        {hasRecommendation && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 rounded-md border border-site-border bg-site-bg/60 px-2 py-0.5 text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
          >
            <ChevronDown
              className={`h-3 w-3 transition ${expanded ? "rotate-180" : ""}`}
              aria-hidden
            />
            {expanded ? "Hide plan" : "Show plan"}
          </button>
        )}
        {alert.projectId && projectName && (
          <Link
            href={`/projects/${alert.projectId}`}
            className="ml-auto text-site-accent hover:underline"
          >
            {projectName} →
          </Link>
        )}
      </div>

      {expanded && hasRecommendation && (
        <pre className="mt-2 whitespace-pre-wrap rounded-md border border-site-border bg-site-bg/80 p-2.5 font-sans text-xs leading-relaxed text-slate-200">
          {alert.recommendation}
        </pre>
      )}
    </li>
  );
}

function RiskChip({ level }: { level: string }) {
  const cls =
    level === "High"
      ? "border-red-500/40 bg-red-500/10 text-red-300"
      : level === "Medium"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${cls}`}
    >
      {level}
    </span>
  );
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!isFinite(t)) return "";
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86_400 * 7) return `${Math.floor(diff / 86_400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Legacy alerts combined the task name + reason into a single `message` string
 * like "Pour foundation: Expected ~60% vs actual 30%.". If the backend only
 * gives us that, strip the task prefix so the reason reads cleanly standalone.
 */
function stripTaskPrefix(message: string, taskName?: string | null): string {
  if (!taskName) return message;
  const prefix = `${taskName}: `;
  return message.startsWith(prefix) ? message.slice(prefix.length) : message;
}
