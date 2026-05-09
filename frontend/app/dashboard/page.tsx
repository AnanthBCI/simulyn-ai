"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FolderKanban,
  ListTodo,
  AlertTriangle,
  Bell,
  Plus,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  api,
  type AlertItem,
  type DashboardSummary,
  type InsightItem,
  type MeDto,
  type ProjectDto,
  type RiskTrendPoint,
  getToken,
} from "@/lib/api";
import { RiskDistribution } from "@/components/widgets/RiskDistribution";
import { ProjectProgress } from "@/components/widgets/ProjectProgress";
import { AiInsights } from "@/components/widgets/AiInsights";
import { RiskTrend } from "@/components/widgets/RiskTrend";
import { WeeklyRecap } from "@/components/widgets/WeeklyRecap";
import { AlertsWidget } from "@/components/widgets/AlertsWidget";
import { BudgetStatusWidget } from "@/components/widgets/BudgetStatusWidget";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  CardSkeleton,
  ErrorBanner,
  Skeleton,
  Spinner,
} from "@/components/ui/primitives";
import { usePageTitle } from "@/hooks/usePageTitle";

// ----- helpers -----

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

function greetingFor(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// ----- small UI primitives -----

type KpiTone = "default" | "danger" | "warn" | "good";

function Kpi({
  label,
  value,
  hint,
  tone = "default",
  Icon,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: KpiTone;
  Icon: typeof FolderKanban;
  /** When set the whole card becomes a clickable navigation tile. */
  href?: string;
}) {
  const iconBg =
    tone === "danger"
      ? "bg-red-500/10 text-red-400 ring-red-500/20"
      : tone === "warn"
        ? "bg-amber-500/10 text-amber-400 ring-amber-500/20"
        : tone === "good"
          ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
          : "bg-blue-500/10 text-blue-400 ring-blue-500/20";
  const valueClass =
    tone === "danger"
      ? "text-red-300"
      : tone === "warn"
        ? "text-amber-300"
        : tone === "good"
          ? "text-emerald-300"
          : "text-white";

  const body = (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-site-muted">
          {label}
        </p>
        <p className={`mt-2 text-3xl font-bold ${valueClass}`}>{value}</p>
        {hint && <p className="mt-1 text-xs text-site-muted">{hint}</p>}
      </div>
      <div className={`grid h-10 w-10 place-items-center rounded-full ring-4 ${iconBg}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group block rounded-xl border border-site-border bg-site-card p-5 shadow-card transition hover:border-site-accent/40 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
      >
        {body}
      </Link>
    );
  }
  return (
    <div className="rounded-xl border border-site-border bg-site-card p-5 shadow-card transition hover:border-site-accent/30">
      {body}
    </div>
  );
}

// ----- page -----

export default function DashboardPage() {
  usePageTitle("Dashboard");
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [me, setMe] = useState<MeDto | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [trend, setTrend] = useState<RiskTrendPoint[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [bundleSeeding, setBundleSeeding] = useState(false);

  const load = useCallback(async () => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setError(null);
    setInsightsLoading(true);
    setTrendLoading(true);
    try {
      const [m, s, p, a, i, t] = await Promise.all([
        api.me().catch(() => null),
        api.dashboardSummary(),
        api.projects(),
        api.alerts(),
        api.insights(5).catch(() => [] as InsightItem[]),
        api.riskTrend(30).catch(() => [] as RiskTrendPoint[]),
      ]);
      setMe(m);
      setSummary(s);
      setProjects(p);
      setAlerts(a);
      setInsights(i);
      setTrend(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
      setInsightsLoading(false);
      setTrendLoading(false);
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

  async function loadBundle() {
    const ok = await confirm({
      title: "Build the demo bundle?",
      message:
        "This creates 4 demo projects (~54 tasks total) and runs AI predictions on all of them. With local Ollama this can take 2–3 minutes. Continue?",
      confirmLabel: "Build demo",
    });
    if (!ok) return;
    setBundleSeeding(true);
    const started = performance.now();
    const tId = toast.info("Building demo projects… this may take 2–3 minutes.", {
      duration: 0,
    });
    try {
      const created = await api.createSampleBundle();
      const elapsed = ((performance.now() - started) / 1000).toFixed(0);
      toast.dismiss(tId);
      toast.success(
        `Created ${created.length} demo projects in ${elapsed}s — Healthy, Trouble, Just-started, Near-complete.`,
        { duration: 7000 },
      );
      await load();
    } catch (e) {
      toast.dismiss(tId);
      toast.error(e instanceof Error ? e.message : "Failed to create demo bundle");
    } finally {
      setBundleSeeding(false);
    }
  }

  const totalTasks = useMemo(
    () => projects.reduce((sum, p) => sum + p.taskCount, 0),
    [projects],
  );
  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === "Active").length,
    [projects],
  );
  const atRiskProjects = useMemo(
    () => projects.filter((p) => p.highRiskTaskCount > 0).length,
    [projects],
  );
  const overdueProjects = useMemo(
    () => projects.filter((p) => daysRemaining(p.endDate) < 0).length,
    [projects],
  );
  const lastAlertAt = useMemo(
    () => (alerts.length > 0 ? alerts[0].createdAt : null),
    [alerts],
  );

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [projects]);

  const topAlerts = useMemo(() => alerts.slice(0, 6), [alerts]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-3 h-7 w-64" />
          <Skeleton className="mt-2 h-3 w-72" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CardSkeleton className="h-[340px]" />
          </div>
          <CardSkeleton className="h-[340px]" />
        </div>
      </div>
    );
  }

  const greeting = greetingFor(new Date());
  const firstName = (me?.name ?? "").split(" ")[0] || me?.name || "there";
  const orgName = me?.activeOrganizationName;

  return (
    <div className="space-y-6">
      {/* 1. Page header — title + subtitle + quick actions on the right */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-site-accent">
            {orgName ?? "Personal workspace"}
            {me?.activeOrganizationRole && (
              <span className="ml-2 font-normal text-site-muted">
                · {me.activeOrganizationRole}
              </span>
            )}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-site-muted">
            {projects.length === 0
              ? "Let's get your first project in. Import an Excel schedule or load a demo bundle to see the AI in action."
              : `You have ${projects.length} ${
                  projects.length === 1 ? "project" : "projects"
                } and ${totalTasks} ${totalTasks === 1 ? "task" : "tasks"}. ${
                  atRiskProjects > 0
                    ? `${atRiskProjects} ${atRiskProjects === 1 ? "project needs" : "projects need"} attention.`
                    : "Everything looks on track."
                }`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-site-accent px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New project
          </Link>
          <Link
            href="/simulation"
            className="inline-flex items-center gap-1.5 rounded-md border border-site-border bg-site-card px-3.5 py-2 text-sm text-slate-300 shadow-sm transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
          >
            <Wand2 className="h-4 w-4" aria-hidden />
            Simulator
          </Link>
          {me?.isPlatformAdmin && (
            <button
              type="button"
              disabled={bundleSeeding || seeding}
              onClick={() => void loadBundle()}
              className="inline-flex items-center gap-1.5 rounded-md border border-site-accent/40 bg-site-accent/10 px-3.5 py-2 text-sm font-medium text-site-accent transition hover:bg-site-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
              title="Seed 4 varied demo projects (platform admin)"
            >
              {bundleSeeding ? <Spinner size="sm" /> : <Sparkles className="h-4 w-4" />}
              {bundleSeeding ? "Building demo… (2-3 min)" : "Demo bundle"}
            </button>
          )}
        </div>
      </header>

      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      {/* Budget warning / blocked banner. Self-hides when usage is well under
          soft cap, so there's no visual noise on a normal day. */}
      <BudgetStatusWidget />

      {/* 2. Weekly recap — only surfaced once there's a project to recap */}
      {projects.length > 0 && <WeeklyRecap />}

      {/* 3. KPI strip */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Projects"
            value={summary.totalProjects}
            hint={
              summary.totalProjects === 0
                ? "Create one to get started"
                : `${activeProjects} active${overdueProjects > 0 ? ` · ${overdueProjects} overdue` : ""}`
            }
            Icon={FolderKanban}
            href={summary.totalProjects > 0 ? "/projects" : undefined}
          />
          <Kpi
            label="Tasks"
            value={totalTasks}
            hint={
              totalTasks === 0
                ? "Add tasks or import from Excel"
                : `Across ${projects.length} ${projects.length === 1 ? "project" : "projects"}`
            }
            Icon={ListTodo}
            href={totalTasks > 0 ? "/projects" : undefined}
          />
          <Kpi
            label="High-risk tasks"
            value={summary.highRiskTasks}
            hint={
              summary.highRiskTasks === 0
                ? "Nothing critical right now"
                : `In ${atRiskProjects} ${atRiskProjects === 1 ? "project" : "projects"} — view`
            }
            tone={
              summary.highRiskTasks === 0
                ? "good"
                : summary.highRiskTasks > 5
                  ? "danger"
                  : "warn"
            }
            Icon={AlertTriangle}
            href={summary.highRiskTasks > 0 ? "/projects?filter=atRisk" : undefined}
          />
          <Kpi
            label="Open alerts"
            value={summary.openAlerts}
            hint={lastAlertAt ? `Last update ${timeAgo(lastAlertAt)}` : "Quiet"}
            tone={
              summary.openAlerts === 0
                ? "good"
                : summary.openAlerts > 5
                  ? "danger"
                  : "warn"
            }
            Icon={Bell}
          />
        </div>
      )}

      {/* 3. Empty state — only when zero projects */}
      {projects.length === 0 && (
        <section className="rounded-2xl border border-dashed border-site-border bg-site-card p-10 text-center shadow-card">
          <p className="text-base font-medium text-white">
            You don&apos;t have any projects yet.
          </p>
          <p className="mt-2 text-sm text-site-muted">
            Pick the fastest path to seeing Simulyn in action:
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              disabled={seeding || bundleSeeding}
              onClick={() => void loadSample()}
              className="inline-flex items-center gap-2 rounded-md bg-site-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {seeding && <Spinner size="sm" />}
              {seeding ? "Building sample project…" : "Load 1 sample project"}
            </button>
            {me?.isPlatformAdmin && (
              <button
                type="button"
                disabled={bundleSeeding || seeding}
                onClick={() => void loadBundle()}
                className="inline-flex items-center gap-2 rounded-md border border-site-accent/40 bg-site-accent/10 px-4 py-2 text-sm font-medium text-site-accent transition hover:bg-site-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bundleSeeding && <Spinner size="sm" />}
                {bundleSeeding ? "Building 4 demo projects…" : "Load demo bundle (4 projects)"}
              </button>
            )}
            <Link
              href="/projects/new"
              className="rounded-md border border-site-border bg-site-card px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
            >
              Create blank project
            </Link>
          </div>
        </section>
      )}

      {/* 4. Hero row: Risk Trend (line chart, 2 cols) + AI Insights (1 col) */}
      {projects.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RiskTrend points={trend} loading={trendLoading} />
          </div>
          <AiInsights insights={insights} loading={insightsLoading} />
        </div>
      )}

      {/* 5. Three-widget row: Project Progress | Risk Distribution | Top Alerts */}
      {projects.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <ProjectProgress projects={projects} limit={6} />
          <RiskDistribution summary={summary} />
          <AlertsWidget alerts={topAlerts} projectNameById={projectNameById} limit={4} />
        </div>
      )}

    </div>
  );
}
