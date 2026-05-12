"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Download, FolderKanban, Plus } from "lucide-react";
import {
  api,
  importTemplateUrl,
  type ProjectDto,
  getToken,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import {
  CardSkeleton,
  EmptyState,
  ErrorBanner,
} from "@/components/ui/primitives";
import { PageSection } from "@/components/ui/PageSection";
import { usePageTitle } from "@/hooks/usePageTitle";

type ProjectFilter = "all" | "atRisk" | "onTrack";

const FILTER_VALUES = new Set<ProjectFilter>(["all", "atRisk", "onTrack"]);

function parseFilter(value: string | null): ProjectFilter {
  if (value && FILTER_VALUES.has(value as ProjectFilter)) {
    return value as ProjectFilter;
  }
  return "all";
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

function formatDate(d: string): string {
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ProjectCard({ project }: { project: ProjectDto }) {
  const tp = timeProgress(project.startDate, project.endDate);
  const remaining = daysRemaining(project.endDate);
  const atRisk = project.highRiskTaskCount > 0;
  const overdue = remaining < 0;
  const noTasks = project.taskCount === 0;

  const barColor = overdue
    ? "bg-red-500"
    : atRisk
      ? "bg-amber-500"
      : "bg-emerald-500";

  const status = noTasks
    ? { label: "No tasks yet", cls: "border-site-border bg-white/5 text-site-muted" }
    : overdue
      ? { label: "Overdue", cls: "border-red-500/40 bg-red-500/10 text-red-300" }
      : atRisk
        ? { label: "At risk", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" }
        : { label: "On track", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" };

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex h-full flex-col rounded-xl border border-site-border bg-site-card p-5 shadow-card transition hover:border-site-accent/40 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 text-base font-semibold text-white group-hover:text-site-accent">
          {project.name}
        </h3>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${status.cls}`}
        >
          {status.label}
        </span>
      </div>

      <p className="mt-2 text-xs text-site-muted">
        {formatDate(project.startDate)} — {formatDate(project.endDate)}
      </p>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-site-muted">
          <span>Schedule progress</span>
          <span className="text-slate-300">{tp}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full ${barColor}`}
            style={{ width: `${tp}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-site-muted">
        <div>
          <span className="font-medium text-white">{project.taskCount}</span>{" "}
          {project.taskCount === 1 ? "task" : "tasks"}
          {project.highRiskTaskCount > 0 && (
            <span className="ml-2 text-red-400">
              · {project.highRiskTaskCount} high-risk
            </span>
          )}
        </div>
        <div>
          {overdue ? (
            <span className="text-red-400">{Math.abs(remaining)}d overdue</span>
          ) : remaining === 0 ? (
            <span className="text-amber-300">due today</span>
          ) : (
            <span>{remaining}d left</span>
          )}
        </div>
      </div>
    </Link>
  );
}

// useSearchParams() triggers client-side rendering, which Next's static
// prerender pass rejects unless it's inside a Suspense boundary. Wrap the
// real page in Suspense (see default export below).
function ProjectsListPageInner() {
  usePageTitle("Projects");
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ProjectFilter>(() =>
    parseFilter(searchParams?.get("filter") ?? null),
  );

  // Keep state in sync if the URL changes externally (back/forward, deep-link).
  useEffect(() => {
    const fromUrl = parseFilter(searchParams?.get("filter") ?? null);
    setFilter((prev) => (prev === fromUrl ? prev : fromUrl));
  }, [searchParams]);

  // Push the active filter into the URL so deep-links and refreshes work.
  function applyFilter(next: ProjectFilter) {
    setFilter(next);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (next === "all") params.delete("filter");
    else params.set("filter", next);
    const qs = params.toString();
    router.replace(qs ? `/projects?${qs}` : "/projects", { scroll: false });
  }

  const load = useCallback(async () => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setError(null);
    try {
      const p = await api.projects();
      setProjects(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onOrgChange() {
      setLoading(true);
      void load();
    }
    window.addEventListener("simulyn:org-changed", onOrgChange);
    return () => window.removeEventListener("simulyn:org-changed", onOrgChange);
  }, [load]);

  async function loadSample() {
    setSeeding(true);
    try {
      const p = await api.createSampleProject();
      toast.success("Sample project created.");
      router.push(`/projects/${p.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create sample");
      setSeeding(false);
    }
  }

  const stats = useMemo(() => {
    const total = projects.length;
    const atRisk = projects.filter((p) => p.highRiskTaskCount > 0).length;
    const overdue = projects.filter((p) => daysRemaining(p.endDate) < 0).length;
    const totalTasks = projects.reduce((sum, p) => sum + p.taskCount, 0);
    return { total, atRisk, overdue, totalTasks };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (filter === "atRisk" && p.highRiskTaskCount === 0) return false;
      if (filter === "onTrack" && p.highRiskTaskCount > 0) return false;
      return true;
    });
  }, [projects, search, filter]);

  return (
    <div className="space-y-6">
      {/* Header + quick actions */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Projects</h1>
          <p className="mt-1 text-sm text-site-muted">
            {loading
              ? "Loading projects…"
              : projects.length === 0
                ? "Create your first project, or import an Excel schedule to get going."
                : `${stats.total} ${stats.total === 1 ? "project" : "projects"} · ${stats.totalTasks} ${stats.totalTasks === 1 ? "task" : "tasks"}${
                    stats.atRisk > 0
                      ? ` · ${stats.atRisk} at risk`
                      : ""
                  }${stats.overdue > 0 ? ` · ${stats.overdue} overdue` : ""}`}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <Link
            href="/projects/new"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-site-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New project
          </Link>
          <a
            href={importTemplateUrl()}
            download
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-site-border bg-site-card px-4 py-2.5 text-sm font-medium text-slate-200 shadow-sm transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
            title="Download Excel template with sample tasks"
          >
            <Download className="h-4 w-4" aria-hidden />
            Excel template
          </a>
        </div>
      </header>

      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      {/* Loading skeletons */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          Icon={FolderKanban}
          title="No projects yet."
          description="Create one from scratch, drop an Excel schedule into a project, or load a sample to see the AI in action."
          primaryAction={{
            label: "Create blank project",
            href: "/projects/new",
          }}
          secondaryAction={{
            label: seeding ? "Building sample…" : "Load sample project",
            onClick: () => void loadSample(),
            disabled: seeding,
          }}
        />
      ) : (
        <PageSection
          sectionId="projects-list"
          eyebrow="Library"
          title="Your projects"
          description="Filter to at-risk jobsites, search by name, then open a card for tasks, predictions, and the AI brief."
          actions={
            <p className="text-xs text-site-muted sm:text-right">
              {filteredProjects.length === projects.length
                ? `${projects.length} total`
                : `${filteredProjects.length} of ${projects.length} shown`}
            </p>
          }
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by project name…"
              className="min-h-[44px] w-full rounded-lg border border-site-border bg-site-card px-3 py-2 text-sm text-white placeholder:text-site-muted focus:border-site-accent focus:outline-none focus:ring-2 focus:ring-site-accent/20 lg:max-w-md"
            />
            <div
              role="tablist"
              aria-label="Filter projects"
              className="flex w-full rounded-lg border border-site-border bg-site-card p-1 text-sm shadow-sm sm:w-auto"
            >
              {(
                [
                  ["all", "All"],
                  ["atRisk", "At risk"],
                  ["onTrack", "On track"],
                ] as Array<[ProjectFilter, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={filter === key}
                  onClick={() => applyFilter(key)}
                  className={`min-h-[44px] flex-1 rounded-md px-3 py-2 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 sm:flex-initial sm:px-4 ${
                    filter === key
                      ? "bg-site-accent text-white shadow-sm"
                      : "text-site-muted hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-site-border bg-site-card p-8 text-center text-sm text-site-muted">
              No projects match these filters.
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  applyFilter("all");
                }}
                className="ml-2 inline-flex min-h-[44px] items-center rounded-lg px-2 font-medium text-site-accent hover:underline focus-visible:outline-none focus-visible:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </PageSection>
      )}

    </div>
  );
}

export default function ProjectsListPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-site-muted">Loading projects…</div>}>
      <ProjectsListPageInner />
    </Suspense>
  );
}
