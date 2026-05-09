"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Download, Sparkles, Trash2, Upload, Wand2 } from "lucide-react";
import {
  api,
  type ImportScheduleResult,
  type MeDto,
  type ProjectDto,
  type TaskDto,
  getToken,
  importTemplateUrl,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { DateField } from "@/components/ui/DateField";
import {
  CardSkeleton,
  EmptyState,
  ErrorBanner,
  Spinner,
  TableSkeleton,
} from "@/components/ui/primitives";
import { ProjectHealthBrief } from "@/components/widgets/ProjectHealthBrief";
import { usePageTitle } from "@/hooks/usePageTitle";

const MAX_IMPORT_BYTES = 5 * 1024 * 1024; // 5 MB hard limit

type SortKey = "name" | "start" | "end" | "progress" | "risk" | "delay";
type SortDir = "asc" | "desc";
const RISK_RANK: Record<string, number> = { High: 3, Medium: 2, Low: 1 };

function RiskPill({ risk }: { risk?: string | null }) {
  if (!risk) return <span className="text-site-muted">—</span>;
  const cls =
    risk === "High"
      ? "border-red-500/40 bg-red-500/10 text-red-300"
      : risk === "Medium"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  return (
    <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {risk}
    </span>
  );
}

const RISK_ORDER: Record<string, number> = { Low: 0, Medium: 1, High: 2 };

/**
 * Tiny "Risk improved/worsened" pill shown under the current risk when we have
 * a previous prediction to compare against. Using the ordinal order so Low→High
 * reads as two steps worse, not "same string".
 */
function RiskDeltaPill({
  latest,
  previous,
}: {
  latest?: string | null;
  previous?: string | null;
}) {
  if (!latest || !previous || latest === previous) return null;
  const a = RISK_ORDER[previous] ?? -1;
  const b = RISK_ORDER[latest] ?? -1;
  if (a < 0 || b < 0) return null;
  const worsened = b > a;
  const cls = worsened
    ? "border-red-500/40 bg-red-500/10 text-red-300"
    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  const label = worsened ? `Risk worsened (${previous}→${latest})` : `Risk improved (${previous}→${latest})`;
  return (
    <span
      className={`mt-1 inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}
      title={label}
    >
      {worsened ? "↑" : "↓"} {previous} → {latest}
    </span>
  );
}

/**
 * Delta pill for the estimated delay-days column. Renders "+N days vs last run"
 * (or "-N days") when the delay changed between the last two predictions.
 */
function DelayDeltaPill({
  latest,
  previous,
}: {
  latest?: number | null;
  previous?: number | null;
}) {
  if (latest == null || previous == null) return null;
  const diff = latest - previous;
  if (diff === 0) return null;
  const worsened = diff > 0;
  const cls = worsened
    ? "border-red-500/40 bg-red-500/10 text-red-300"
    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  const sign = worsened ? "+" : "";
  return (
    <span
      className={`ml-2 inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}
      title={`${sign}${diff} day${Math.abs(diff) === 1 ? "" : "s"} vs last run`}
    >
      {sign}
      {diff}d vs last
    </span>
  );
}

function TaskRow({
  task,
  busy,
  expanded,
  onToggle,
  onProgressChange,
  onDelete,
  onPredict,
}: {
  task: TaskDto;
  busy: boolean;
  expanded: boolean;
  onToggle: () => void;
  onProgressChange: (value: number) => void;
  onDelete: () => void;
  onPredict: () => void;
}) {
  const hasInsight = !!task.latestSummary || !!task.latestRecommendation;
  return (
    <>
      <tr className="border-b border-site-border transition last:border-0 hover:bg-white/5">
        <td className="px-4 py-3">
          <button
            type="button"
            className="flex flex-col text-left rounded-md transition hover:text-site-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 focus-visible:ring-offset-1 focus-visible:ring-offset-site-card"
            onClick={onToggle}
            aria-expanded={hasInsight ? expanded : undefined}
          >
            <span className="font-medium text-white">{task.name}</span>
            {hasInsight && (
              <span className="text-xs text-site-muted">
                {expanded ? "▾ Hide AI insight" : "▸ Show AI insight"}
              </span>
            )}
          </button>
        </td>
        <td className="px-4 py-3 text-site-muted">
          {task.startDate} → {task.endDate}
        </td>
        <td className="px-4 py-3">
          <input
            type="range"
            min={0}
            max={100}
            value={task.progress}
            disabled={busy}
            onChange={(e) => onProgressChange(Number(e.target.value))}
            className="w-full accent-site-accent"
            aria-label={`Progress for ${task.name}`}
          />
          <span className="text-xs text-site-muted">{task.progress}%</span>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-col items-start">
            <RiskPill risk={task.latestRisk} />
            <RiskDeltaPill latest={task.latestRisk} previous={task.previousRisk} />
          </div>
        </td>
        <td className="px-4 py-3 text-slate-300">
          {task.latestDelayDays ?? "—"}
          <DelayDeltaPill
            latest={task.latestDelayDays}
            previous={task.previousDelayDays}
          />
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onPredict}
              className="rounded-md border border-site-border px-2 py-1 text-xs text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
              title="Re-run AI prediction"
            >
              Re-run
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              className="rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-300 transition hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-50"
              title="Delete task"
              aria-label={`Delete task ${task.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </td>
      </tr>
      {expanded && hasInsight && (
        <tr className="border-b border-site-border bg-white/5">
          <td colSpan={6} className="px-6 py-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-site-muted">
                  AI summary
                </p>
                <p className="mt-1 text-sm text-slate-300">{task.latestSummary}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-site-muted">
                  Recommended actions
                </p>
                <pre className="mt-1 whitespace-pre-wrap font-sans text-sm text-slate-300">
                  {task.latestRecommendation}
                </pre>
              </div>
            </div>
            {task.latestPredictionAt && (
              <p className="mt-3 text-xs text-site-muted">
                Generated {new Date(task.latestPredictionAt).toLocaleString()}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function SortHeader({
  label,
  sortKey,
  current,
  dir,
  onSort,
  align = "left",
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = current === sortKey;
  return (
    <th
      className={`px-4 py-3 font-medium ${align === "right" ? "text-right" : ""} ${className}`}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 transition hover:text-white focus-visible:outline-none focus-visible:text-white ${
          active ? "text-white" : ""
        }`}
      >
        {label}
        <ChevronDown
          className={`h-3 w-3 transition ${
            active ? "opacity-100" : "opacity-0 group-hover:opacity-50"
          } ${active && dir === "asc" ? "rotate-180" : ""}`}
        />
      </button>
    </th>
  );
}

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  const [project, setProject] = useState<ProjectDto | null>(null);
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [me, setMe] = useState<MeDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [importResult, setImportResult] = useState<ImportScheduleResult | null>(null);
  const [predictionMsg, setPredictionMsg] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const [taskName, setTaskName] = useState("");
  const [tStart, setTStart] = useState("");
  const [tEnd, setTEnd] = useState("");
  const [progress, setProgress] = useState(0);
  const [taskFormError, setTaskFormError] = useState<string | null>(null);

  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("risk");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [taskSearch, setTaskSearch] = useState("");

  // Sticky compact header that fades in once the full header scrolls out of view.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target) return;
    const obs = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0, rootMargin: "0px 0px 0px 0px" },
    );
    obs.observe(target);
    return () => obs.disconnect();
  }, [project?.id]);

  usePageTitle(project ? project.name : "Project");

  const load = useCallback(async () => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setError(null);
    try {
      const [p, t, m] = await Promise.all([api.project(id), api.tasks(id), api.me()]);
      setProject(p);
      setTasks(t);
      setMe(m);
      setNewName(p.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  // If the user switches active org from the sidebar mid-session, this page
  // is now showing data from the wrong tenant — the API will start returning
  // 404 for the project id under the new org. Bail back to the project list
  // instead of showing a stale snapshot or a confusing error.
  useEffect(() => {
    function onOrgChanged() {
      router.replace("/projects");
    }
    window.addEventListener("simulyn:org-changed", onOrgChanged);
    return () => window.removeEventListener("simulyn:org-changed", onOrgChanged);
  }, [router]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir(k === "name" || k === "start" ? "asc" : "desc");
    }
  }

  const visibleTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    const filtered = q
      ? tasks.filter((t) => t.name.toLowerCase().includes(q))
      : tasks;
    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "start":
          return (
            (new Date(a.startDate).getTime() - new Date(b.startDate).getTime()) * dir
          );
        case "end":
          return (
            (new Date(a.endDate).getTime() - new Date(b.endDate).getTime()) * dir
          );
        case "progress":
          return (a.progress - b.progress) * dir;
        case "risk":
          return (
            ((RISK_RANK[a.latestRisk ?? ""] ?? 0) -
              (RISK_RANK[b.latestRisk ?? ""] ?? 0)) *
            dir
          );
        case "delay":
          return ((a.latestDelayDays ?? 0) - (b.latestDelayDays ?? 0)) * dir;
        default:
          return 0;
      }
    });
    return sorted;
  }, [tasks, taskSearch, sortKey, sortDir]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    setTaskFormError(null);
    if (!taskName.trim()) {
      setTaskFormError("Task name is required.");
      return;
    }
    if (!tStart || !tEnd) {
      setTaskFormError("Pick a start and end date.");
      return;
    }
    if (new Date(tEnd) < new Date(tStart)) {
      setTaskFormError("End date must be on or after start date.");
      return;
    }
    setBusy(true);
    try {
      await api.createTask({
        projectId: id,
        name: taskName.trim(),
        startDate: tStart,
        endDate: tEnd,
        progress,
        status: "InProgress",
      });
      toast.success(`Added task "${taskName.trim()}".`);
      setTaskName("");
      setTStart("");
      setTEnd("");
      setProgress(0);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      setTaskFormError(msg);
      toast.error("Couldn't add task.");
    } finally {
      setBusy(false);
    }
  }

  async function onImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Please choose a .xlsx file.");
      return;
    }
    if (f.size > MAX_IMPORT_BYTES) {
      toast.error(
        `File is too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Max 5 MB.`,
      );
      return;
    }
    setBusy(true);
    setError(null);
    setImportResult(null);
    const tId = toast.info(`Importing ${f.name}…`, { duration: 0 });
    try {
      const r = await api.importSchedule(id, f);
      setImportResult(r);
      toast.dismiss(tId);
      const skippedNote =
        r.rowsSkipped > 0 ? ` (${r.rowsSkipped} row(s) skipped)` : "";
      toast.success(
        `Imported ${r.tasksCreated} task${r.tasksCreated === 1 ? "" : "s"}${skippedNote}. AI predictions will appear shortly.`,
      );
      await load();
    } catch (err) {
      toast.dismiss(tId);
      const msg = err instanceof Error ? err.message : "Import failed";
      toast.error(msg.length > 200 ? "Import failed. Check the file format." : msg);
    } finally {
      setBusy(false);
    }
  }

  async function runProjectPrediction() {
    if (me && !me.isEntitled) {
      toast.warning("Subscription required. Contact sales for an invoice plan.");
      return;
    }
    setBusy(true);
    setPredictionMsg(null);
    const started = performance.now();
    const tId = toast.info("Running AI predictions on all tasks…", {
      duration: 0,
    });
    try {
      const results = await api.runPrediction({ projectId: id });
      const elapsed = ((performance.now() - started) / 1000).toFixed(1);
      const count = Array.isArray(results) ? results.length : 0;
      const msg = `Refreshed predictions for ${count} task${count === 1 ? "" : "s"} in ${elapsed}s. Click any task name to see the AI summary.`;
      setPredictionMsg(msg);
      toast.dismiss(tId);
      toast.success(msg, { duration: 6000 });
      await load();
    } catch (err) {
      toast.dismiss(tId);
      toast.error(err instanceof Error ? err.message : "Prediction failed");
    } finally {
      setBusy(false);
    }
  }

  async function runTaskPrediction(taskId: string) {
    if (me && !me.isEntitled) {
      toast.warning("Subscription required. Contact sales for an invoice plan.");
      return;
    }
    setBusy(true);
    const tId = toast.info("Re-running prediction…", { duration: 0 });
    try {
      await api.runPrediction({ taskId });
      toast.dismiss(tId);
      toast.success("Prediction updated. Expand the task to see the new insight.");
      setExpandedTaskId(taskId);
      await load();
    } catch (err) {
      toast.dismiss(tId);
      toast.error(err instanceof Error ? err.message : "Prediction failed");
    } finally {
      setBusy(false);
    }
  }

  async function updateProgress(task: TaskDto, value: number) {
    setBusy(true);
    try {
      await api.updateTask(task.id, { progress: value });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTask(task: TaskDto) {
    const ok = await confirm({
      title: "Delete task?",
      message: `"${task.name}" and its AI predictions will be removed. This can't be undone.`,
      confirmLabel: "Delete task",
      variant: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.deleteTask(task.id);
      toast.success("Task deleted.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteProject() {
    if (!project) return;
    const ok = await confirm({
      title: "Delete this project?",
      message: `"${project.name}" and all of its tasks, predictions and alerts will be permanently deleted.`,
      requireText: project.name,
      confirmLabel: "Delete project",
      variant: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.deleteProject(id);
      toast.success(`Deleted "${project.name}".`);
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      setBusy(false);
    }
  }

  async function saveRename() {
    if (!project) return;
    if (!newName.trim() || newName === project.name) {
      setRenaming(false);
      return;
    }
    setBusy(true);
    try {
      const updated = await api.updateProject(id, { name: newName.trim() });
      setProject(updated);
      setRenaming(false);
      toast.success("Project renamed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rename failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <CardSkeleton />
        <TableSkeleton rows={6} cols={6} />
      </div>
    );
  }
  if (!project) {
    return (
      <div className="space-y-4">
        <Breadcrumbs
          items={[
            { label: "Projects", href: "/projects" },
            { label: "Not found" },
          ]}
        />
        <ErrorBanner message={error ?? "Project not found."} onRetry={() => void load()} />
      </div>
    );
  }

  return (
    <>
      {/* Compact sticky header — fixed, fades in once the full header scrolls past. */}
      <div
        className={`fixed left-0 right-0 top-0 z-30 border-b border-site-border bg-site-bg/85 backdrop-blur transition-all duration-200 lg:left-64 ${
          scrolled
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0"
        }`}
        aria-hidden={!scrolled}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
            {project.name}
          </h2>
          <button
            type="button"
            disabled={busy || (me ? !me.isEntitled : true) || tasks.length === 0}
            onClick={() => void runProjectPrediction()}
            className="inline-flex items-center gap-1.5 rounded-md bg-site-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
            title={tasks.length === 0 ? "Add a task first" : "Run AI prediction on every task"}
          >
            {busy ? <Spinner size="sm" /> : <Wand2 className="h-3.5 w-3.5" aria-hidden />}
            <span className="hidden sm:inline">{busy ? "Running…" : "Run prediction"}</span>
            <span className="sm:hidden">{busy ? "…" : "Predict"}</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void deleteProject()}
            aria-label="Delete project"
            className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </div>

      {/* Sentinel — sits at the very top so it intersects on first paint. */}
      <div ref={sentinelRef} aria-hidden className="h-px" />

      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
          <Breadcrumbs
            items={[
              { label: "Projects", href: "/projects" },
              { label: project.name },
            ]}
          />
          {renaming ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                className="rounded-md border border-site-border bg-site-bg px-3 py-2 text-lg text-white outline-none focus:border-site-accent focus:ring-2 focus:ring-site-accent/20"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                disabled={busy}
                autoFocus
              />
              <button
                type="button"
                onClick={() => void saveRename()}
                disabled={busy}
                className="rounded-md bg-site-accent px-3 py-2 text-sm text-white transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setRenaming(false);
                  setNewName(project.name);
                }}
                className="rounded-md border border-site-border px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-white">{project.name}</h1>
              <button
                type="button"
                onClick={() => setRenaming(true)}
                className="rounded-md border border-site-border px-2 py-1 text-xs text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
              >
                Rename
              </button>
            </div>
          )}
          <p className="mt-1 text-site-muted">
            {project.startDate} → {project.endDate} · {project.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || (me ? !me.isEntitled : true) || tasks.length === 0}
            onClick={() => void runProjectPrediction()}
            className="inline-flex items-center gap-2 rounded-md bg-site-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
            title={tasks.length === 0 ? "Add a task first" : "Run AI prediction on every task"}
          >
            {busy ? <Spinner size="sm" /> : <Wand2 className="h-4 w-4" />}
            {busy ? "Running predictions…" : "Run prediction (all tasks)"}
          </button>
          {me && !me.isEntitled && (
            <span className="flex items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
              Prediction disabled for your plan: {me.plan} ({me.subscriptionStatus})
            </span>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void deleteProject()}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300 transition hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete project
          </button>
        </div>
      </div>

      <ProjectHealthBrief projectId={id} />

      {error && <ErrorBanner message={error} onRetry={() => void load()} />}
      {predictionMsg && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
        >
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1">{predictionMsg}</span>
          <button
            type="button"
            onClick={() => setPredictionMsg(null)}
            className="rounded-md p-1 text-emerald-400 transition hover:bg-emerald-500/10 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <section className="rounded-xl border border-site-border bg-site-card p-6 shadow-card">
        <h2 className="text-lg font-medium text-white">Import schedule from Excel</h2>
        <p className="mt-1 text-sm text-site-muted">
          First row: headers. Required columns: task name (e.g. Task Name), start date, end date.
          Optional: progress (%). AI predictions auto-run after import.
        </p>
        <p className="mt-1 text-sm text-site-muted">
          New here? Grab the template below — it has the right headers and 8 example tasks. Replace
          them with yours and upload.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <a
            href={importTemplateUrl()}
            download
            className="inline-flex items-center gap-1.5 rounded-md border border-site-border px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
          >
            <Download className="h-4 w-4" />
            Download template (.xlsx)
          </a>
          <label
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-site-accent bg-site-accent/10 px-4 py-2 text-sm font-medium text-site-accent transition hover:bg-site-accent/20 focus-within:outline-none focus-within:ring-2 focus-within:ring-site-accent/40 ${
              busy ? "cursor-not-allowed opacity-60" : ""
            }`}
          >
            <Upload className="h-4 w-4" />
            Upload .xlsx file
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => void onImportExcel(e)}
              disabled={busy}
            />
          </label>
          {importResult && (
            <span className="text-sm text-site-muted">
              Created {importResult.tasksCreated}, skipped {importResult.rowsSkipped} row(s).
            </span>
          )}
        </div>
        {importResult?.messages && importResult.messages.length > 0 && (
          <ul className="mt-3 list-inside list-disc text-sm text-site-muted">
            {importResult.messages.slice(0, 8).map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-site-border bg-site-card p-6 shadow-card">
        <h2 className="text-lg font-medium text-white">Add task</h2>
        <form
          onSubmit={addTask}
          noValidate
          className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-300">Name</label>
            <input
              className="mt-1 w-full rounded-md border border-site-border bg-site-bg px-3 py-2 text-white outline-none transition focus:border-site-accent focus:ring-2 focus:ring-site-accent/20"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              required
            />
          </div>
          <div>
            <label
              className="text-xs font-medium text-slate-300"
              htmlFor="task-start"
            >
              Start
            </label>
            <div className="mt-1">
              <DateField
                id="task-start"
                value={tStart}
                onChange={setTStart}
                placeholder="Start date"
                required
                ariaLabel="Task start date"
              />
            </div>
          </div>
          <div>
            <label
              className="text-xs font-medium text-slate-300"
              htmlFor="task-end"
            >
              End
            </label>
            <div className="mt-1">
              <DateField
                id="task-end"
                value={tEnd}
                onChange={setTEnd}
                min={tStart || undefined}
                placeholder="End date"
                required
                ariaLabel="Task end date"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-300">Progress %</label>
            <input
              type="number"
              min={0}
              max={100}
              className="mt-1 w-full rounded-md border border-site-border bg-site-bg px-3 py-2 text-white outline-none transition focus:border-site-accent focus:ring-2 focus:ring-site-accent/20"
              value={progress}
              onChange={(e) =>
                setProgress(Math.max(0, Math.min(100, Number(e.target.value) || 0)))
              }
            />
          </div>
          {taskFormError && (
            <p
              role="alert"
              className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300 sm:col-span-2 lg:col-span-4"
            >
              {taskFormError}
            </p>
          )}
          <div className="flex items-end sm:col-span-2 lg:col-span-1 lg:col-start-4">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-site-border bg-site-bg py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <Spinner size="sm" />}
              Add task
            </button>
          </div>
        </form>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-medium text-white">
              Tasks{" "}
              <span className="ml-1 text-sm font-normal text-site-muted">
                ({visibleTasks.length}
                {visibleTasks.length !== tasks.length ? ` of ${tasks.length}` : ""})
              </span>
            </h2>
            <p className="text-xs text-site-muted">
              Click a task name to view the AI insight. Click any column header to sort.
            </p>
          </div>
          <input
            type="search"
            value={taskSearch}
            onChange={(e) => setTaskSearch(e.target.value)}
            placeholder="Search tasks…"
            className="w-56 rounded-md border border-site-border bg-site-card px-3 py-1.5 text-sm text-white placeholder:text-site-muted focus:border-site-accent focus:outline-none focus:ring-2 focus:ring-site-accent/20"
          />
        </div>
        {tasks.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No tasks yet."
              description="Add one with the form above, or drop in an Excel schedule to bulk-import."
            />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-site-border bg-site-card shadow-card">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-site-border bg-white/5 text-site-muted">
                <tr>
                  <SortHeader
                    label="Task"
                    sortKey="name"
                    current={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Window"
                    sortKey="start"
                    current={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Progress"
                    sortKey="progress"
                    current={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Risk"
                    sortKey="risk"
                    current={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Delay (est.)"
                    sortKey="delay"
                    current={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleTasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    busy={busy}
                    expanded={expandedTaskId === t.id}
                    onToggle={() =>
                      setExpandedTaskId(expandedTaskId === t.id ? null : t.id)
                    }
                    onProgressChange={(v) => void updateProgress(t, v)}
                    onDelete={() => void deleteTask(t)}
                    onPredict={() => void runTaskPrediction(t.id)}
                  />
                ))}
                {visibleTasks.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-site-muted"
                    >
                      No tasks match &quot;{taskSearch}&quot;.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </div>
    </>
  );
}
