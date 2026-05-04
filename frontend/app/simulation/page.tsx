"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Lightbulb, Plus, Wand2, X } from "lucide-react";
import {
  api,
  getToken,
  SCENARIO_LABEL,
  SCENARIO_TYPES,
  type MeDto,
  type ProjectDto,
  type ScenarioConfig,
  type ScenarioType,
  type SimulationResult,
  type SuggestedScenario,
  type TaskDto,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import {
  CardSkeleton,
  EmptyState,
  Spinner,
} from "@/components/ui/primitives";
import { usePageTitle } from "@/hooks/usePageTitle";

/**
 * A pending scenario sitting in the run queue. Gets its own local id so we can
 * add/remove duplicates (three uniform slips with different day counts, say)
 * without collisions.
 */
type QueuedScenario = {
  localId: string;
  scenarioType: ScenarioType;
  config: ScenarioConfig;
  /** Optional rationale string from /auto-suggest; rendered under the card. */
  rationale?: string;
};

function newLocalId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function defaultConfig(type: ScenarioType, firstTaskId?: string): ScenarioConfig {
  switch (type) {
    case "UniformSlip":
      return { InputDelayDays: 5 };
    case "SingleTaskSlip":
      return { TaskId: firstTaskId ?? "", DelayDays: 5 };
    case "AddResource":
      return { CapacityMultiplier: 0.25 };
    case "WeatherPause":
      return { PauseDays: 7 };
    case "ScopeReduction":
      return { TasksRemoved: 2 };
  }
}

/** Map an AI-suggested config back into our strict ScenarioConfig shape. */
function coerceConfig(type: ScenarioType, raw: Record<string, unknown>): ScenarioConfig {
  const pick = (keys: string[]): unknown => keys.map((k) => raw[k]).find((v) => v != null);
  switch (type) {
    case "UniformSlip":
      return { InputDelayDays: Number(pick(["InputDelayDays", "inputDelayDays"]) ?? 5) };
    case "SingleTaskSlip":
      return {
        TaskId: String(pick(["TaskId", "taskId"]) ?? ""),
        DelayDays: Number(pick(["DelayDays", "delayDays"]) ?? 5),
      };
    case "AddResource":
      return {
        CapacityMultiplier: Number(
          pick(["CapacityMultiplier", "capacityMultiplier"]) ?? 0.25,
        ),
      };
    case "WeatherPause":
      return { PauseDays: Number(pick(["PauseDays", "pauseDays"]) ?? 7) };
    case "ScopeReduction":
      return { TasksRemoved: Number(pick(["TasksRemoved", "tasksRemoved"]) ?? 2) };
  }
}

// useSearchParams() triggers client-side rendering, which Next's static
// prerender pass rejects unless it's inside a Suspense boundary. Wrap the
// real page in Suspense (see default export below).
function SimulationPageInner() {
  usePageTitle("What-if simulator");
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [projectId, setProjectId] = useState("");
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [me, setMe] = useState<MeDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);

  const [queue, setQueue] = useState<QueuedScenario[]>([]);
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [running, setRunning] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  // Initial load — projects + /me, plus optional ?projectId= pre-select.
  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    const preselect = searchParams.get("projectId") ?? "";
    const autoSuggest = searchParams.get("suggest") === "1";
    let cancelled = false;
    void Promise.all([api.projects(), api.me()])
      .then(([p, m]) => {
        if (cancelled) return;
        setProjects(p);
        const pick = preselect && p.some((x) => x.id === preselect) ? preselect : p[0]?.id ?? "";
        setProjectId(pick);
        setMe(m);
        // If we were asked to auto-suggest on load (deep-link from brief card),
        // do it once the project tasks load; tracked via setTimeout below in the
        // tasks effect so the suggestion has task ids available.
        if (autoSuggest && pick) {
          // Flip a flag via sessionStorage so the tasks effect picks it up.
          try {
            sessionStorage.setItem("simulyn:autoSuggest", pick);
          } catch {
            /* ignore */
          }
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load projects");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  // Load tasks whenever the picked project changes.
  useEffect(() => {
    if (!projectId) {
      setTasks([]);
      return;
    }
    let cancelled = false;
    setTasksLoading(true);
    api
      .tasks(projectId)
      .then((t) => {
        if (!cancelled) setTasks(t);
      })
      .catch((e) => {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Failed to load tasks");
        }
      })
      .finally(() => {
        if (!cancelled) setTasksLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Auto-suggest trigger (from brief card "Show me what could go wrong").
  useEffect(() => {
    if (!projectId || tasksLoading) return;
    let triggerFor: string | null = null;
    try {
      triggerFor = sessionStorage.getItem("simulyn:autoSuggest");
    } catch {
      /* ignore */
    }
    if (triggerFor && triggerFor === projectId) {
      try {
        sessionStorage.removeItem("simulyn:autoSuggest");
      } catch {
        /* ignore */
      }
      void runAutoSuggest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, tasksLoading]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  );
  const canRun = !!selectedProject && queue.length > 0 && (me?.isEntitled ?? false);

  const addScenario = useCallback(
    (type: ScenarioType) => {
      const cfg = defaultConfig(type, tasks[0]?.id);
      setQueue((q) => [...q, { localId: newLocalId(), scenarioType: type, config: cfg }]);
    },
    [tasks],
  );

  const updateScenario = useCallback(
    (localId: string, patch: Partial<ScenarioConfig>) => {
      setQueue((q) =>
        q.map((s) =>
          s.localId === localId
            ? ({
                ...s,
                config: { ...(s.config as Record<string, unknown>), ...patch } as ScenarioConfig,
              })
            : s,
        ),
      );
    },
    [],
  );

  const removeScenario = useCallback((localId: string) => {
    setQueue((q) => q.filter((s) => s.localId !== localId));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setResults([]);
  }, []);

  async function runAutoSuggest() {
    if (!projectId) return;
    setSuggesting(true);
    const tId = toast.info("Asking AI for scenarios to try…", { duration: 0 });
    try {
      const r = await api.autoSuggestScenarios(projectId);
      toast.dismiss(tId);
      if (r.suggestions.length === 0) {
        toast.warning("No suggestions returned. Try adding scenarios manually.");
        return;
      }
      // Replace the queue with the suggestions — clearer than appending, and
      // users can always add more manually.
      const mapped: QueuedScenario[] = r.suggestions.map((s: SuggestedScenario) => ({
        localId: newLocalId(),
        scenarioType: s.scenarioType,
        config: coerceConfig(s.scenarioType, s.config),
        rationale: s.rationale,
      }));
      setQueue(mapped);
      setResults([]);
      toast.success(`Loaded ${mapped.length} AI-suggested scenario${mapped.length === 1 ? "" : "s"}.`);
    } catch (e) {
      toast.dismiss(tId);
      toast.error(e instanceof Error ? e.message : "Suggestion failed");
    } finally {
      setSuggesting(false);
    }
  }

  async function runAll() {
    if (!canRun || !selectedProject) return;
    setRunning(true);
    setResults([]);
    const tId = toast.info(
      `Running ${queue.length} scenario${queue.length === 1 ? "" : "s"}…`,
      { duration: 0 },
    );
    try {
      const body = {
        projectId: selectedProject.id,
        scenarios: queue.map(({ scenarioType, config }) => ({
          projectId: selectedProject.id,
          scenarioType,
          config,
        })),
      };
      const r = await api.compareScenarios(body);
      setResults(r.results);
      toast.dismiss(tId);
      toast.success(`Done — ${r.results.length} scenario${r.results.length === 1 ? "" : "s"} ready to compare.`);
    } catch (e) {
      toast.dismiss(tId);
      toast.error(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">What-if simulator</h1>
          <p className="mt-1 text-site-muted">Loading projects…</p>
        </div>
        <CardSkeleton />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold text-white">What-if simulator</h1>
        <EmptyState
          title="No projects to simulate against."
          description="Create a project (or import an Excel schedule), then come back here to model a scenario."
          primaryAction={{ label: "Create project", href: "/projects/new" }}
          secondaryAction={{ label: "Back to dashboard", href: "/dashboard" }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">What-if simulator</h1>
          <p className="mt-1 text-sm text-site-muted">
            Queue up multiple scenarios, let the AI suggest a mix, and compare the impact side-by-side.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-md border border-site-border px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/5 hover:text-white"
        >
          Back to dashboard
        </Link>
      </header>

      {error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <section className="rounded-xl border border-site-border bg-site-card p-5 shadow-card">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[260px]">
            <label className="text-xs font-medium uppercase tracking-wider text-site-muted">
              Project
            </label>
            <select
              className="mt-1 w-full rounded-md border border-site-border bg-site-bg px-3 py-2 text-white outline-none transition focus:border-site-accent focus:ring-2 focus:ring-site-accent/20"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setQueue([]);
                setResults([]);
              }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-site-card text-white">
                  {p.name}
                </option>
              ))}
            </select>
            {selectedProject && (
              <p className="mt-1 text-xs text-site-muted">
                {selectedProject.taskCount} task{selectedProject.taskCount === 1 ? "" : "s"}
                {selectedProject.highRiskTaskCount > 0 && (
                  <span className="ml-2 text-red-400">
                    · {selectedProject.highRiskTaskCount} already high-risk
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runAutoSuggest()}
              disabled={!projectId || suggesting}
              className="inline-flex items-center gap-1.5 rounded-md border border-site-accent/40 bg-site-accent/10 px-3 py-2 text-sm font-medium text-site-accent transition hover:bg-site-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
              title="Ask AI which scenarios are worth running"
            >
              {suggesting ? <Spinner size="sm" /> : <Lightbulb className="h-4 w-4" aria-hidden />}
              {suggesting ? "Suggesting…" : "Suggest scenarios"}
            </button>
            <button
              type="button"
              onClick={() => void runAll()}
              disabled={!canRun || running}
              className="inline-flex items-center gap-1.5 rounded-md bg-site-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
              title={
                queue.length === 0
                  ? "Add or suggest scenarios first"
                  : `Run ${queue.length} scenario${queue.length === 1 ? "" : "s"} in parallel`
              }
            >
              {running ? <Spinner size="sm" /> : <Wand2 className="h-4 w-4" />}
              {running
                ? "Running…"
                : queue.length <= 1
                  ? "Run simulation"
                  : `Compare ${queue.length} scenarios`}
            </button>
          </div>
        </div>

        {me && !me.isEntitled && (
          <p className="mt-3 text-xs text-amber-300">
            Simulation disabled for your plan: {me.plan} ({me.subscriptionStatus})
          </p>
        )}
      </section>

      <section className="rounded-xl border border-site-border bg-site-card p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-white">Scenarios to run</h2>
            <p className="text-xs text-site-muted">
              Mix and match up to 8 scenarios; they run in parallel.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap gap-1">
              {SCENARIO_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addScenario(t)}
                  disabled={queue.length >= 8}
                  className="inline-flex items-center gap-1 rounded-md border border-site-border bg-site-bg/60 px-2 py-1 text-xs text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
                  title={`Add a ${SCENARIO_LABEL[t]} scenario`}
                >
                  <Plus className="h-3 w-3" aria-hidden />
                  {SCENARIO_LABEL[t]}
                </button>
              ))}
            </div>
            {queue.length > 0 && (
              <button
                type="button"
                onClick={clearQueue}
                className="rounded-md border border-site-border px-2 py-1 text-xs text-slate-400 transition hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {queue.length === 0 ? (
          <div className="mt-4 grid place-items-center rounded-lg border border-dashed border-site-border p-8 text-center text-sm text-site-muted">
            <div>
              <p>No scenarios queued yet.</p>
              <p className="mt-1 text-xs">
                Add one from the chips above, or click <em>Suggest scenarios</em> to let the AI propose a mix.
              </p>
            </div>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {queue.map((s) => (
              <ScenarioCard
                key={s.localId}
                scenario={s}
                tasks={tasks}
                onChange={(patch) => updateScenario(s.localId, patch)}
                onRemove={() => removeScenario(s.localId)}
              />
            ))}
          </ul>
        )}
      </section>

      {(results.length > 0 || running) && (
        <ComparisonTable results={results} running={running} tasks={tasks} />
      )}
    </div>
  );
}

export default function SimulationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-site-muted">Loading scenarios…</div>}>
      <SimulationPageInner />
    </Suspense>
  );
}

function ScenarioCard({
  scenario,
  tasks,
  onChange,
  onRemove,
}: {
  scenario: QueuedScenario;
  tasks: TaskDto[];
  onChange: (patch: Partial<ScenarioConfig>) => void;
  onRemove: () => void;
}) {
  const { scenarioType, config } = scenario;
  return (
    <li className="relative rounded-lg border border-site-border bg-site-bg/50 p-4">
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-2 top-2 rounded-md p-1 text-site-muted transition hover:bg-white/5 hover:text-white"
        aria-label={`Remove ${SCENARIO_LABEL[scenarioType]} scenario`}
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
      <p className="text-xs font-medium uppercase tracking-wider text-site-accent">
        {SCENARIO_LABEL[scenarioType]}
      </p>

      {scenarioType === "UniformSlip" && "InputDelayDays" in config && (
        <NumberInput
          label="Slip every task by"
          suffix="day(s)"
          value={config.InputDelayDays}
          min={0}
          max={365}
          onChange={(v) => onChange({ InputDelayDays: v } as Partial<ScenarioConfig>)}
        />
      )}

      {scenarioType === "SingleTaskSlip" && "TaskId" in config && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="text-xs text-slate-300">Task</label>
            <select
              className="mt-1 w-full rounded-md border border-site-border bg-site-bg px-2 py-1.5 text-sm text-white outline-none focus:border-site-accent focus:ring-2 focus:ring-site-accent/20"
              value={config.TaskId}
              onChange={(e) =>
                onChange({ TaskId: e.target.value } as Partial<ScenarioConfig>)
              }
            >
              {tasks.length === 0 && <option value="">No tasks</option>}
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <NumberInput
            label="Slip by"
            suffix="day(s)"
            value={config.DelayDays}
            min={0}
            max={365}
            onChange={(v) => onChange({ DelayDays: v } as Partial<ScenarioConfig>)}
          />
        </div>
      )}

      {scenarioType === "AddResource" && "CapacityMultiplier" in config && (
        <div className="mt-3">
          <label className="text-xs text-slate-300">Extra capacity</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={Math.round(config.CapacityMultiplier * 100)}
              onChange={(e) =>
                onChange({
                  CapacityMultiplier: Number(e.target.value) / 100,
                } as Partial<ScenarioConfig>)
              }
              className="flex-1 accent-site-accent"
            />
            <span className="w-12 text-right text-sm text-slate-300">
              +{Math.round(config.CapacityMultiplier * 100)}%
            </span>
          </div>
        </div>
      )}

      {scenarioType === "WeatherPause" && "PauseDays" in config && (
        <NumberInput
          label="Pause site for"
          suffix="day(s)"
          value={config.PauseDays}
          min={1}
          max={60}
          onChange={(v) => onChange({ PauseDays: v } as Partial<ScenarioConfig>)}
        />
      )}

      {scenarioType === "ScopeReduction" && "TasksRemoved" in config && (
        <NumberInput
          label="Remove"
          suffix="task(s)"
          value={config.TasksRemoved}
          min={1}
          max={Math.max(1, tasks.length)}
          onChange={(v) => onChange({ TasksRemoved: v } as Partial<ScenarioConfig>)}
        />
      )}

      {scenario.rationale && (
        <p className="mt-3 text-xs italic text-site-muted">{scenario.rationale}</p>
      )}
    </li>
  );
}

function NumberInput({
  label,
  suffix,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  suffix?: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mt-3">
      <label className="text-xs text-slate-300">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) =>
            onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))
          }
          className="w-24 rounded-md border border-site-border bg-site-bg px-2 py-1.5 text-sm text-white outline-none focus:border-site-accent focus:ring-2 focus:ring-site-accent/20"
        />
        {suffix && <span className="text-sm text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}

function ComparisonTable({
  results,
  running,
  tasks,
}: {
  results: SimulationResult[];
  running: boolean;
  tasks: TaskDto[];
}) {
  const taskNameById = useMemo(() => {
    const m = new Map<string, string>();
    tasks.forEach((t) => m.set(t.id, t.name));
    return m;
  }, [tasks]);

  return (
    <section className="rounded-xl border border-site-border bg-site-card shadow-card">
      <div className="flex items-center justify-between border-b border-site-border px-5 py-3">
        <div>
          <h2 className="text-base font-semibold text-white">Side-by-side comparison</h2>
          <p className="text-xs text-site-muted">
            Positive days push finish later, negative days pull finish earlier.
          </p>
        </div>
        {running && <Spinner size="sm" />}
      </div>

      {results.length === 0 ? (
        <div className="grid place-items-center p-8 text-sm text-site-muted">
          Running scenarios…
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-site-border bg-white/5 text-xs uppercase tracking-wider text-site-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Scenario</th>
                <th className="px-5 py-3 font-medium">Inputs</th>
                <th className="px-5 py-3 font-medium text-right">Impact (days)</th>
                <th className="px-5 py-3 font-medium">Summary</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const delta = r.predictedDelay;
                const tone =
                  delta > 0
                    ? "text-red-300"
                    : delta < 0
                      ? "text-emerald-300"
                      : "text-slate-300";
                const sign = delta > 0 ? "+" : "";
                return (
                  <tr key={r.id} className="border-b border-site-border align-top last:border-0">
                    <td className="px-5 py-4">
                      <p className="font-medium text-white">
                        {SCENARIO_LABEL[r.scenarioType as ScenarioType] ?? r.scenarioType}
                      </p>
                      {r.headline && (
                        <p className="mt-1 text-xs text-slate-400">{r.headline}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-300">
                      <ConfigPreview json={r.scenarioConfigJson ?? null} taskNameById={taskNameById} />
                    </td>
                    <td className={`px-5 py-4 text-right text-lg font-semibold ${tone}`}>
                      {sign}
                      {delta}
                    </td>
                    <td className="px-5 py-4">
                      <p className="whitespace-pre-wrap text-sm text-slate-300">
                        {r.impactSummary}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ConfigPreview({
  json,
  taskNameById,
}: {
  json: string | null;
  taskNameById: Map<string, string>;
}) {
  if (!json) return <span className="text-site-muted">—</span>;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return <span className="text-site-muted">—</span>;
  }
  return (
    <ul className="space-y-0.5">
      {Object.entries(parsed).map(([k, v]) => {
        // Swap TaskId UUIDs for names where we have them — the table is more
        // scannable that way.
        let display: string;
        if (k === "TaskId" && typeof v === "string") {
          display = taskNameById.get(v) ?? v;
        } else if (k === "CapacityMultiplier" && typeof v === "number") {
          display = `+${Math.round(v * 100)}%`;
        } else {
          display = String(v);
        }
        return (
          <li key={k} className="flex gap-1">
            <span className="text-site-muted">{k}:</span>
            <span className="text-slate-200">{display}</span>
          </li>
        );
      })}
    </ul>
  );
}
