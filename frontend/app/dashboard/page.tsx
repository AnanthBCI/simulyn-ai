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
  CalendarClock,
  Search,
  CircleDollarSign,
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
import { openAskSimulyn } from "@/lib/chat-bridge";
import { RiskDistribution } from "@/components/widgets/RiskDistribution";
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
import { DashboardCriticalBanner } from "@/components/dashboard/DashboardCriticalBanner";
import { DashboardProjectTable } from "@/components/dashboard/DashboardProjectTable";
import { DashboardRecommendedActions } from "@/components/dashboard/DashboardRecommendedActions";
import { DashboardChatShortcuts } from "@/components/dashboard/DashboardChatShortcuts";
import { usePageTitle } from "@/hooks/usePageTitle";

const headerBtnPrimary =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-site-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40";
const headerBtnGhost =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-site-border bg-[#0f172a]/60 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-site-accent/35 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40";

/** Illustrative $/day for delay exposure (no cost model in API yet). */
const COST_PER_DELAY_DAY_USD = 1200;

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

function formatUsd(n: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

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
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-site-muted">
          {label}
        </p>
        <p className={`mt-1.5 text-2xl font-bold tabular-nums sm:text-3xl ${valueClass}`}>
          {value}
        </p>
        {hint && <p className="mt-1 text-[11px] leading-snug text-site-muted sm:text-xs">{hint}</p>}
      </div>
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ring-4 sm:h-10 sm:w-10 ${iconBg}`}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group block min-h-[96px] rounded-xl border border-site-border bg-[#0f172a]/70 p-4 shadow-card backdrop-blur-sm transition hover:border-site-accent/40 hover:bg-[#0f172a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 sm:min-h-0 sm:p-5"
      >
        {body}
      </Link>
    );
  }
  return (
    <div className="min-h-[96px] rounded-xl border border-site-border bg-[#0f172a]/70 p-4 shadow-card backdrop-blur-sm sm:min-h-0 sm:p-5">
      {body}
    </div>
  );
}

function aggregateDelayDays(insights: InsightItem[], alerts: AlertItem[]): number {
  const seen = new Set<string>();
  let sum = 0;
  for (const i of insights) {
    if (seen.has(i.taskId)) continue;
    seen.add(i.taskId);
    sum += Math.max(0, i.delayDays ?? 0);
  }
  for (const a of alerts) {
    if (!a.taskId || seen.has(a.taskId)) continue;
    if (a.delayDays == null) continue;
    seen.add(a.taskId);
    sum += Math.max(0, a.delayDays);
  }
  return sum;
}

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
        api.insights(8).catch(() => [] as InsightItem[]),
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
  const completedProjects = useMemo(
    () => projects.filter((p) => p.status === "Completed").length,
    [projects],
  );
  const atRiskProjects = useMemo(
    () => projects.filter((p) => p.highRiskTaskCount > 0).length,
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

  const criticalAlert = useMemo(() => {
    const high = alerts.find((a) => a.riskLevel === "High");
    return high ?? alerts[0] ?? null;
  }, [alerts]);

  const criticalProjectName = useMemo(() => {
    if (!criticalAlert?.projectId) return undefined;
    return (
      criticalAlert.projectName ?? projectNameById.get(criticalAlert.projectId) ?? undefined
    );
  }, [criticalAlert, projectNameById]);

  const expectedDelayDays = useMemo(
    () => aggregateDelayDays(insights, alerts),
    [insights, alerts],
  );

  const illustrativeCost = expectedDelayDays * COST_PER_DELAY_DAY_USD;

  const atRiskPct = useMemo(() => {
    if (projects.length === 0) return 0;
    return Math.round((atRiskProjects / projects.length) * 100);
  }, [projects.length, atRiskProjects]);

  const initials = useMemo(() => {
    return (me?.name ?? "")
      .split(" ")
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [me?.name]);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-4 border-b border-site-border/50 pb-6 lg:flex-row lg:justify-between">
          <div>
            <Skeleton className="h-3 w-40" />
            <Skeleton className="mt-3 h-8 w-72" />
            <Skeleton className="mt-2 h-3 w-96 max-w-full" />
          </div>
          <Skeleton className="h-11 w-full max-w-md rounded-lg lg:w-80" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
          <CardSkeleton className="h-[320px]" />
          <CardSkeleton className="h-[320px]" />
        </div>
      </div>
    );
  }

  const greeting = greetingFor(new Date());
  const firstName = (me?.name ?? "").split(" ")[0] || me?.name || "there";
  const orgName = me?.activeOrganizationName;

  const mainColumn = (
    <div className="min-w-0 space-y-6">
      {projects.length > 0 && (
        <>
          <WeeklyRecap />
          <BudgetStatusWidget />
        </>
      )}

      {summary && projects.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Kpi
            label="Active projects"
            value={activeProjects}
            hint={
              completedProjects > 0
                ? `${completedProjects} completed · ${projects.length} total`
                : `${projects.length} in portfolio`
            }
            Icon={FolderKanban}
            href="/projects"
          />
          <Kpi
            label="Projects at risk"
            value={atRiskProjects}
            hint={
              projects.length === 0
                ? "—"
                : `${atRiskPct}% of portfolio${atRiskProjects > 0 ? " — review schedule" : ""}`
            }
            tone={atRiskProjects > 0 ? "warn" : "good"}
            Icon={AlertTriangle}
            href={atRiskProjects > 0 ? "/projects?filter=atRisk" : "/projects"}
          />
          <Kpi
            label="Expected delay"
            value={expectedDelayDays > 0 ? `${expectedDelayDays} d` : "0 d"}
            hint="From top alerts & insights"
            tone={expectedDelayDays > 8 ? "danger" : expectedDelayDays > 0 ? "warn" : "good"}
            Icon={CalendarClock}
          />
          <Kpi
            label="Critical tasks"
            value={summary.highRiskTasks}
            hint={
              summary.highRiskTasks === 0
                ? "Nothing blocking"
                : `Across ${atRiskProjects || "—"} at-risk project${atRiskProjects === 1 ? "" : "s"}`
            }
            tone={
              summary.highRiskTasks === 0
                ? "good"
                : summary.highRiskTasks > 5
                  ? "danger"
                  : "warn"
            }
            Icon={ListTodo}
            href={summary.highRiskTasks > 0 ? "/projects?filter=atRisk" : undefined}
          />
          <Kpi
            label="Exposure (illustrative)"
            value={expectedDelayDays > 0 ? formatUsd(illustrativeCost) : formatUsd(0)}
            hint={`~$${COST_PER_DELAY_DAY_USD.toLocaleString()}/delay-day · not billed data`}
            tone={illustrativeCost > 20_000 ? "danger" : illustrativeCost > 0 ? "warn" : "good"}
            Icon={CircleDollarSign}
          />
        </div>
      )}

      {projects.length === 0 && (
        <section className="rounded-2xl border border-dashed border-site-border bg-[#0f172a]/50 p-8 text-center shadow-card sm:p-10">
          <p className="text-base font-semibold text-white">No projects yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-site-muted">
            Start with a sample tour or a blank project — Simulyn will score risk and draft your weekly story.
          </p>
          <div className="mt-6 flex max-w-lg flex-col gap-3 sm:mx-auto sm:flex-row sm:flex-wrap sm:justify-center">
            <button
              type="button"
              disabled={seeding || bundleSeeding}
              onClick={() => void loadSample()}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-site-accent px-5 text-sm font-semibold text-white transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {seeding && <Spinner size="sm" />}
              {seeding ? "Building sample…" : "Load sample project"}
            </button>
            {me?.isPlatformAdmin && (
              <button
                type="button"
                disabled={bundleSeeding || seeding}
                onClick={() => void loadBundle()}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-site-accent/40 bg-site-accent/10 px-5 text-sm font-semibold text-site-accent transition hover:bg-site-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bundleSeeding && <Spinner size="sm" />}
                {bundleSeeding ? "Building…" : "Demo bundle (4 projects)"}
              </button>
            )}
            <Link
              href="/projects/new"
              className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-site-border bg-site-bg/60 px-5 text-sm font-medium text-slate-200 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
            >
              New blank project
            </Link>
          </div>
        </section>
      )}

      {projects.length > 0 && criticalAlert && (
        <DashboardCriticalBanner alert={criticalAlert} projectName={criticalProjectName} />
      )}

      {projects.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <RiskTrend points={trend} loading={trendLoading} />
          <RiskDistribution summary={summary} />
        </div>
      )}

      {projects.length > 0 && (
        <>
          <DashboardProjectTable projects={projects} limit={8} />
          <div id="dashboard-alerts">
            <AlertsWidget alerts={topAlerts} projectNameById={projectNameById} limit={5} />
          </div>
        </>
      )}
    </div>
  );

  const insightsRail = (
    <div className="flex min-w-0 flex-col gap-5 xl:max-w-[380px] xl:shrink-0">
      <AiInsights
        insights={insights}
        loading={insightsLoading}
        title="AI insights"
        severityBadges
      />
      <DashboardRecommendedActions insights={insights} alerts={alerts} />
      <DashboardChatShortcuts />
    </div>
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="border-b border-site-border/60 pb-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {greeting}, {firstName}{" "}
              <span className="font-normal text-site-muted" aria-hidden>
                👋
              </span>
            </h1>
            <p className="text-sm text-site-muted">
              {orgName ?? "Personal workspace"}
              {me?.activeOrganizationRole ? ` · ${me.activeOrganizationRole}` : ""}
            </p>
            <p className="max-w-2xl pt-2 text-sm leading-relaxed text-slate-300 sm:text-[15px]">
              {projects.length === 0
                ? "Your overview will fill in as soon as you add a project — risk trend, alerts, and AI insights stay scoped to this workspace."
                : atRiskProjects > 0
                  ? `${projects.length} project${projects.length === 1 ? "" : "s"} · ${totalTasks} task${totalTasks === 1 ? "" : "s"}. ${atRiskProjects} project${atRiskProjects === 1 ? "" : "s"} have high-risk work in flight.`
                  : `${projects.length} project${projects.length === 1 ? "" : "s"} · ${totalTasks} task${totalTasks === 1 ? "" : "s"}. Portfolio looks calm — keep an eye on the trend chart.`}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
            <Link href="/projects/new" className={headerBtnPrimary}>
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              New project
            </Link>
            <Link href="/simulation" className={headerBtnGhost}>
              <Wand2 className="h-4 w-4 shrink-0" aria-hidden />
              What-if
            </Link>
            <button
              type="button"
              onClick={() => openAskSimulyn()}
              className={`${headerBtnGhost} justify-start text-left sm:min-w-[220px]`}
            >
              <Search className="h-4 w-4 shrink-0 text-site-accent" aria-hidden />
              <span className="truncate">Ask Simulyn AI…</span>
            </button>
            <Link
              href="/projects?filter=atRisk"
              className="relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-site-border bg-[#0f172a]/60 text-slate-200 transition hover:border-site-accent/35 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
              aria-label={`Alerts${summary && summary.openAlerts > 0 ? `, ${summary.openAlerts} open` : ""}`}
            >
              <Bell className="h-5 w-5" aria-hidden />
              {summary != null && summary.openAlerts > 0 && (
                <span className="absolute -right-1 -top-1 grid min-h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-[#0B1120]">
                  {summary.openAlerts > 99 ? "99+" : summary.openAlerts}
                </span>
              )}
            </Link>
            {me && (
              <div
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-site-border bg-site-accent/15 text-sm font-semibold text-site-accent"
                title={me.name}
              >
                {initials || "U"}
              </div>
            )}
            {me?.isPlatformAdmin && (
              <button
                type="button"
                disabled={bundleSeeding || seeding}
                onClick={() => void loadBundle()}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-site-accent/40 bg-site-accent/10 px-4 py-2.5 text-sm font-semibold text-site-accent transition hover:bg-site-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
                title="Seed 4 varied demo projects"
              >
                {bundleSeeding ? <Spinner size="sm" /> : <Sparkles className="h-4 w-4" />}
                {bundleSeeding ? "Building…" : "Demo bundle"}
              </button>
            )}
          </div>
        </div>
        {lastAlertAt && projects.length > 0 && summary != null && summary.openAlerts > 0 && (
          <p className="mt-3 text-xs text-site-muted">
            Latest alert activity {timeAgo(lastAlertAt)} ·{" "}
            <Link href="#dashboard-alerts" className="text-site-accent hover:underline">
              Jump to alerts
            </Link>
          </p>
        )}
      </header>

      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      {projects.length > 0 ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_380px] xl:items-start xl:gap-8">
          {mainColumn}
          <aside className="hidden xl:block">{insightsRail}</aside>
        </div>
      ) : (
        mainColumn
      )}

      {projects.length > 0 && (
        <div className="space-y-5 xl:hidden">{insightsRail}</div>
      )}
    </div>
  );
}
