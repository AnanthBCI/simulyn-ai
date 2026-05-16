"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Gauge, TrendingUp } from "lucide-react";
import { api, type BudgetStatus } from "@/lib/api";

/**
 * Dashboard widget that surfaces today's per-org LLM spend against the daily
 * cap. Quietly hides itself when the org is well under soft cap (we don't
 * want to nag users with a "$0.04 of $5" bar). Renders as a warning banner
 * once spend crosses the soft cap, and as a hard error card with a link to
 * billing once the hard cap is hit and AI calls are blocked.
 *
 * The widget tolerates a missing endpoint (older deploys) by silently
 * unmounting on 404 / 401 — never blocks the dashboard from rendering.
 */
export function BudgetStatusWidget() {
  const [status, setStatus] = useState<BudgetStatus | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getBudget()
      .then((s) => {
        if (cancelled) return;
        setStatus(s);
      })
      .catch(() => {
        // Any failure (auth, 404, network, unknown) → just hide. The budget
        // widget is informational — never block the dashboard if it errors.
        if (cancelled) return;
        setHidden(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (hidden || !status) return null;

  // Don't render until we're at least at 50% of the soft cap. Below that, a
  // budget bar is just noise — the user already knows they're not spending.
  const halfSoft = status.softCapMills / 2;
  if (status.todayMills < halfSoft) return null;

  const usd = (mills: number) => (mills / 1000).toFixed(2);
  const pctOfHard = Math.min(100, Math.round((status.todayMills / Math.max(1, status.hardCapMills)) * 100));

  if (status.level === "Blocked") {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-red-200">
              Daily AI budget reached (${usd(status.hardCapMills)})
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-red-200/80">
              New AI features (predictions, project briefs, weekly recap, copilot)
              will resume after UTC midnight. An Admin can raise the daily cap
              under <Link href="/admin/billing" className="font-medium underline hover:text-white">Billing</Link>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const tone = status.level === "Warning" ? "warning" : "ok";
  const toneClass =
    tone === "warning"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
      : "border-site-border bg-site-card text-slate-300";
  const Icon = tone === "warning" ? TrendingUp : Gauge;
  const iconClass = tone === "warning" ? "text-amber-400" : "text-blue-400";
  const barFill = tone === "warning" ? "bg-amber-400" : "bg-blue-400";

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h3 className="text-sm font-semibold text-white">
              {tone === "warning" ? "Approaching daily AI budget" : "Today's AI spend"}
            </h3>
            <p className="text-xs font-mono text-slate-300">
              ${usd(status.todayMills)} of ${usd(status.hardCapMills)}
            </p>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-700/40">
            <div
              className={`h-full rounded-full ${barFill}`}
              style={{ width: `${pctOfHard}%` }}
              aria-label={`${pctOfHard}% of daily AI budget used`}
            />
          </div>
          {tone === "warning" && (
            <p className="mt-2 text-xs text-amber-100/80">
              Heads up — once you hit ${usd(status.hardCapMills)} new AI calls
              are paused until UTC midnight to protect your budget.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
