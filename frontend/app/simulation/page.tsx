"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type MeDto, type ProjectDto, type SimulationResult, getToken } from "@/lib/api";

export default function SimulationPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [projectId, setProjectId] = useState("");
  const [delayDays, setDelayDays] = useState(3);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [me, setMe] = useState<MeDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    void api
      .projects()
      .then((p) => ({ p }))
      .then(async ({ p }) => {
        const m = await api.me();
        return { p, m };
      })
      .then(({ p, m }) => {
        if (cancelled) return;
        setProjects(p);
        setProjectId((prev) => prev || p[0]?.id || "");
        setMe(m);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    if (me && !me.isEntitled) {
      setError("Subscription required. Contact sales for an invoice plan.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.runSimulation({ projectId, inputDelayDays: delayDays });
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-site-muted">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">What-if simulation</h1>
        <p className="text-site-muted">
          Enter a hypothetical delay (days) and see estimated impact on the project finish.
        </p>
      </div>

      <form
        onSubmit={run}
        className="space-y-4 rounded-xl border border-site-border bg-site-card p-6"
      >
        <div>
          <label className="text-sm text-site-muted">Project</label>
          <select
            className="mt-1 w-full rounded-md border border-site-border bg-site-bg px-3 py-2"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-site-muted">Hypothetical delay (days)</label>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-md border border-site-border bg-site-bg px-3 py-2"
            value={delayDays}
            onChange={(e) => setDelayDays(Number(e.target.value))}
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy || !projectId || (me ? !me.isEntitled : true)}
          className="rounded-md bg-site-accent px-4 py-2 font-medium text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {busy ? "Running…" : "Run simulation"}
        </button>
        {me && !me.isEntitled && (
          <p className="text-sm text-amber-200">
            Simulation disabled for your plan: {me.plan} ({me.subscriptionStatus})
          </p>
        )}
      </form>

      {result && (
        <div className="rounded-xl border border-site-border bg-site-card p-6">
          <h2 className="text-lg font-medium">Result</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-site-muted">Input delay</dt>
              <dd>{result.inputDelay} days</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-site-muted">Predicted schedule impact</dt>
              <dd>{result.predictedDelay} days</dd>
            </div>
          </dl>
          {result.impactSummary && (
            <p className="mt-4 whitespace-pre-wrap text-sm text-site-muted">{result.impactSummary}</p>
          )}
        </div>
      )}
    </div>
  );
}
