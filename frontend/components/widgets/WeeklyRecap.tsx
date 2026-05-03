"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, RefreshCw, Sparkles } from "lucide-react";
import { api, type WeeklyRecapDto } from "@/lib/api";

/**
 * Short AI recap pinned to the top of the dashboard. Headline is always on;
 * bullets live behind a collapsible so the dashboard stays scannable. Backed
 * by /api/dashboard/weekly-recap, which caches per-org for 12h server-side.
 */
export function WeeklyRecap() {
  const [recap, setRecap] = useState<WeeklyRecapDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const load = useCallback(async (refresh: boolean) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await api.weeklyRecap(refresh);
      setRecap(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load weekly recap.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    function onOrgChange() {
      void load(false);
    }
    window.addEventListener("simulyn:org-changed", onOrgChange);
    return () => window.removeEventListener("simulyn:org-changed", onOrgChange);
  }, [load]);

  if (loading) {
    return (
      <section className="rounded-xl border border-site-border bg-gradient-to-br from-site-card via-site-card to-slate-900/40 p-5 shadow-card">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-32 rounded bg-white/10" />
          <div className="h-4 w-3/4 rounded bg-white/10" />
          <div className="h-3 w-1/2 rounded bg-white/5" />
        </div>
      </section>
    );
  }

  if (error && !recap) {
    return (
      <section className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
        <div className="flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load(false)}
            className="rounded-md border border-red-400/40 px-2.5 py-1 text-xs text-red-100 transition hover:bg-red-500/20"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }
  if (!recap) return null;

  return (
    <section
      aria-label="Weekly AI recap"
      className="rounded-xl border border-site-border bg-gradient-to-br from-site-card via-site-card to-slate-900/40 p-5 shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-site-muted">
            <Sparkles className="h-3 w-3 text-site-accent" aria-hidden />
            AI weekly recap
          </div>
          <h2 className="mt-1 text-lg font-semibold leading-snug text-white">
            {recap.headline}
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-md border border-site-border bg-site-bg/60 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
            title="Regenerate the recap from current data"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
              aria-hidden
            />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls="weekly-recap-bullets"
            className="inline-flex items-center gap-1 rounded-md border border-site-border bg-site-bg/60 px-2 py-1.5 text-xs text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition ${expanded ? "rotate-180" : ""}`}
              aria-hidden
            />
            <span className="sr-only">{expanded ? "Collapse" : "Expand"}</span>
          </button>
        </div>
      </div>

      {expanded && (
        <ul
          id="weekly-recap-bullets"
          className="mt-3 space-y-1.5 text-sm text-slate-300"
        >
          {recap.bullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span
                aria-hidden
                className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-site-accent/70"
              />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] text-site-muted">
        Updated {formatRelative(recap.generatedAt)}
        {recap.isStale ? " · offline fallback" : ""}
      </p>
    </section>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}
