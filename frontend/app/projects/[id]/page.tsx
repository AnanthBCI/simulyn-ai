"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, type ImportScheduleResult, type MeDto, type ProjectDto, type TaskDto, getToken } from "@/lib/api";

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [project, setProject] = useState<ProjectDto | null>(null);
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [me, setMe] = useState<MeDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [importResult, setImportResult] = useState<ImportScheduleResult | null>(null);

  const [taskName, setTaskName] = useState("");
  const [tStart, setTStart] = useState("");
  const [tEnd, setTEnd] = useState("");
  const [progress, setProgress] = useState(0);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.createTask({
        projectId: id,
        name: taskName,
        startDate: tStart,
        endDate: tEnd,
        progress,
        status: "InProgress",
      });
      setTaskName("");
      setProgress(0);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function onImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".xlsx")) {
      setError("Please choose a .xlsx file.");
      return;
    }
    setBusy(true);
    setError(null);
    setImportResult(null);
    try {
      const r = await api.importSchedule(id, f);
      setImportResult(r);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function runProjectPrediction() {
    if (me && !me.isEntitled) {
      setError("Subscription required. Contact sales for an invoice plan.");
      return;
    }
    setBusy(true);
    try {
      await api.runPrediction({ projectId: id });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prediction failed");
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
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-site-muted">Loading…</p>;
  if (!project) return <p className="text-red-400">{error ?? "Not found"}</p>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-sm text-site-accent hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{project.name}</h1>
          <p className="text-site-muted">
            {project.startDate} → {project.endDate} · {project.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || (me ? !me.isEntitled : true)}
            onClick={() => void runProjectPrediction()}
            className="rounded-md bg-site-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
          >
            Run prediction (all tasks)
          </button>
          {me && !me.isEntitled && (
            <span className="flex items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              Prediction disabled for your plan: {me.plan} ({me.subscriptionStatus})
            </span>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!confirm("Delete this project?")) return;
              await api.deleteProject(id);
              router.push("/dashboard");
            }}
            className="rounded-md border border-red-500/50 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
          >
            Delete project
          </button>
        </div>
      </div>

      {error && <p className="text-red-400">{error}</p>}

      <section className="rounded-xl border border-site-border bg-site-card p-6">
        <h2 className="text-lg font-medium">Import schedule from Excel</h2>
        <p className="mt-1 text-sm text-site-muted">
          First row: headers. Required columns: task name (e.g. Task Name), start date, end date. Optional: progress
          (%).
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-md border border-site-border px-4 py-2 text-sm hover:bg-white/5">
            Choose .xlsx file
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => void onImportExcel(e)} disabled={busy} />
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

      <section className="rounded-xl border border-site-border bg-site-card p-6">
        <h2 className="text-lg font-medium">Add task</h2>
        <form onSubmit={addTask} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="text-xs text-site-muted">Name</label>
            <input
              className="mt-1 w-full rounded-md border border-site-border bg-site-bg px-3 py-2"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs text-site-muted">Start</label>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-site-border bg-site-bg px-3 py-2"
              value={tStart}
              onChange={(e) => setTStart(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs text-site-muted">End</label>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-site-border bg-site-bg px-3 py-2"
              value={tEnd}
              onChange={(e) => setTEnd(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs text-site-muted">Progress %</label>
            <input
              type="number"
              min={0}
              max={100}
              className="mt-1 w-full rounded-md border border-site-border bg-site-bg px-3 py-2"
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md border border-site-border py-2 text-sm hover:bg-white/5"
            >
              Add task
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-medium">Tasks</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-site-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-site-border bg-site-bg/80 text-site-muted">
              <tr>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Window</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Delay (est.)</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-b border-site-border/60">
                  <td className="px-4 py-3">{t.name}</td>
                  <td className="px-4 py-3 text-site-muted">
                    {t.startDate} → {t.endDate}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={t.progress}
                      disabled={busy}
                      onChange={(e) => void updateProgress(t, Number(e.target.value))}
                      className="w-full"
                    />
                    <span className="text-xs text-site-muted">{t.progress}%</span>
                  </td>
                  <td className="px-4 py-3">{t.latestRisk ?? "—"}</td>
                  <td className="px-4 py-3">{t.latestDelayDays ?? "—"}</td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-site-muted">
                    No tasks yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
