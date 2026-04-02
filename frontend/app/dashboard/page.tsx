"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  api,
  type AlertItem,
  type DashboardSummary,
  type ProjectDto,
  getToken,
} from "@/lib/api";

function Card({
  title,
  value,
  hint,
}: {
  title: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-site-border bg-site-card p-5">
      <p className="text-sm text-site-muted">{title}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-site-muted">{hint}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setError(null);
    try {
      const [s, p, a] = await Promise.all([
        api.dashboardSummary(),
        api.projects(),
        api.alerts(),
      ]);
      setSummary(s);
      setProjects(p);
      setAlerts(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-site-muted">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-site-muted">Projects, risk, and alerts at a glance.</p>
      </div>

      {error && <p className="text-red-400">{error}</p>}

      {summary && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card title="Total projects" value={summary.totalProjects} />
          <Card title="High-risk tasks" value={summary.highRiskTasks} />
          <Card title="Open alerts" value={summary.openAlerts} hint="Medium + high risk" />
        </div>
      )}

      <section>
        <h2 className="text-lg font-medium">Risk alerts</h2>
        <ul className="mt-3 space-y-2">
          {alerts.length === 0 && (
            <li className="rounded-lg border border-site-border bg-site-card px-4 py-3 text-sm text-site-muted">
              No active alerts.
            </li>
          )}
          {alerts.map((a, i) => (
            <li
              key={`${a.taskId}-${i}`}
              className="rounded-lg border border-site-border bg-site-card px-4 py-3 text-sm"
            >
              <span
                className={
                  a.riskLevel === "High"
                    ? "text-red-400"
                    : a.riskLevel === "Medium"
                      ? "text-amber-400"
                      : "text-site-muted"
                }
              >
                [{a.riskLevel}]
              </span>{" "}
              {a.message}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Projects</h2>
          <Link
            href="/projects/new"
            className="rounded-md bg-site-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600"
          >
            New project
          </Link>
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-site-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-site-border bg-site-bg/80 text-site-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Window</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Tasks</th>
                <th className="px-4 py-3 font-medium">High risk</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-site-border/60 last:border-0">
                  <td className="px-4 py-3">{p.name}</td>
                  <td className="px-4 py-3 text-site-muted">
                    {p.startDate} → {p.endDate}
                  </td>
                  <td className="px-4 py-3">{p.status}</td>
                  <td className="px-4 py-3">{p.taskCount}</td>
                  <td className="px-4 py-3">{p.highRiskTaskCount}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/projects/${p.id}`} className="text-site-accent hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-site-muted">
                    No projects yet. Create one to get started.
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
