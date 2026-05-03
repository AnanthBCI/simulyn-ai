"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, Sparkles } from "lucide-react";
import { api, type ProjectBriefDto } from "@/lib/api";

/**
 * One-glance AI narrative pinned to the top of /projects/[id]. Reads from
 * GET /api/projects/{id}/brief — that endpoint caches for 12h server-side, so
 * mounting is cheap. The "Refresh" button re-generates with ?refresh=true.
 *
 * Keep this widget deliberately low-chrome: it's the first thing the PM sees
 * when opening a project, so the headline + health chip should land without
 * competing with the rest of the page.
 */
export function ProjectHealthBrief({ projectId }: { projectId: string }) {
  const [brief, setBrief] = useState<ProjectBriefDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await api.projectBrief(projectId, refresh);
        setBrief(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load project brief.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  if (loading) {
    return (
      <section className="rounded-xl border border-site-border bg-gradient-to-br from-site-card via-site-card to-slate-900/40 p-5 shadow-card">
        <div className="flex animate-pulse items-start gap-4">
          <div className="h-14 w-14 rounded-full bg-white/10" />
          <div className="flex-1 space-y-3">
            <div className="h-4 w-3/4 rounded bg-white/10" />
            <div className="h-3 w-full rounded bg-white/5" />
            <div className="h-3 w-5/6 rounded bg-white/5" />
          </div>
        </div>
      </section>
    );
  }

  if (error && !brief) {
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
  if (!brief) return null;

  return (
    <section
      aria-label="Project health brief"
      className="rounded-xl border border-site-border bg-gradient-to-br from-site-card via-site-card to-slate-900/40 p-5 shadow-card"
    >
      <div className="flex items-start gap-4">
        <HealthScoreChip score={brief.healthScore} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-site-muted">
                <Sparkles className="h-3 w-3 text-site-accent" aria-hidden />
                AI project brief
              </div>
              <h2 className="mt-1 text-lg font-semibold leading-snug text-white">
                {brief.headline}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-site-border bg-site-bg/60 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
              title="Regenerate the brief from current data"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                aria-hidden
              />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-slate-300">{brief.body}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {brief.toneTags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-site-border bg-white/5 px-2.5 py-0.5 text-[11px] text-slate-300"
              >
                {t}
              </span>
            ))}
            <Link
              href={`/simulation?projectId=${projectId}&suggest=1`}
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300 transition hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
              title="Pre-load the simulator with AI-suggested scenarios for this project"
            >
              <AlertTriangle className="h-3 w-3" aria-hidden />
              Show me what could go wrong
            </Link>
            <span className="ml-auto text-[11px] text-site-muted">
              Updated {formatRelative(brief.createdAt)}
              {brief.isStale ? " · offline fallback" : ""}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function HealthScoreChip({ score }: { score: number }) {
  const tone =
    score >= 80
      ? "from-emerald-500/20 to-emerald-500/5 border-emerald-500/40 text-emerald-300"
      : score >= 55
        ? "from-amber-500/20 to-amber-500/5 border-amber-500/40 text-amber-300"
        : "from-red-500/20 to-red-500/5 border-red-500/40 text-red-300";
  return (
    <div
      className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border bg-gradient-to-br ${tone}`}
      title="Health score (0 worst — 100 best)"
      aria-label={`Health score ${score} out of 100`}
    >
      <span className="text-xl font-semibold leading-none">{score}</span>
      <span className="mt-0.5 text-[10px] uppercase tracking-wide opacity-80">Health</span>
    </div>
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
