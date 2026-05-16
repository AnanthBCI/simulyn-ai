"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Info } from "lucide-react";
import type { DashboardSummary } from "@/lib/api";
import { RISK_LEVEL_EXPLANATION } from "./RiskTrend";

const COLORS = {
  high: "#ef4444", // red-500
  medium: "#f59e0b", // amber-500
  low: "#10b981", // emerald-500
  none: "#475569", // slate-600 — visible on dark bg
};

/**
 * Donut chart showing the distribution of risk levels across all tasks
 * in the active organization. Backed by the extended /dashboard/summary
 * endpoint (no extra request needed).
 */
export function RiskDistribution({ summary }: { summary: DashboardSummary | null }) {
  const data = useMemo(() => {
    if (!summary) return [];
    return [
      { name: "High", value: summary.highRiskTasks, color: COLORS.high },
      { name: "Medium", value: summary.mediumRiskTasks, color: COLORS.medium },
      { name: "Low", value: summary.lowRiskTasks, color: COLORS.low },
      { name: "Unrun", value: summary.unpredictedTasks, color: COLORS.none },
    ].filter((d) => d.value > 0);
  }, [summary]);

  const total = useMemo(
    () =>
      summary
        ? summary.highRiskTasks +
          summary.mediumRiskTasks +
          summary.lowRiskTasks +
          summary.unpredictedTasks
        : 0,
    [summary],
  );

  return (
    <div className="flex h-full flex-col rounded-xl border border-site-border bg-site-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h3 className="text-base font-semibold text-white">
            Risk distribution
          </h3>
          <span
            title={`Share of tasks at each risk level across all projects in this workspace.\n\n${RISK_LEVEL_EXPLANATION}`}
            className="inline-flex items-center text-site-muted hover:text-slate-300"
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">
              Share of tasks at each risk level. {RISK_LEVEL_EXPLANATION}
            </span>
          </span>
        </div>
        <span className="text-xs text-site-muted">All tasks</span>
      </div>

      {total === 0 ? (
        <div className="grid flex-1 place-items-center text-sm text-site-muted">
          No tasks yet.
        </div>
      ) : (
        <div className="relative mt-2 min-h-[220px] flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                stroke="none"
              >
                {data.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-3xl font-bold text-white">{total}</p>
            <p className="text-xs text-site-muted">Total tasks</p>
          </div>
        </div>
      )}

      {total > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {data.map((d) => (
            <li key={d.name} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-300">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: d.color }}
                  aria-hidden
                />
                {labelFor(d.name)}
              </span>
              <span className="text-white">
                {d.value}{" "}
                <span className="text-xs text-site-muted">
                  ({Math.round((d.value / total) * 100)}%)
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function labelFor(name: string): string {
  switch (name) {
    case "High":
      return "High risk";
    case "Medium":
      return "Medium risk";
    case "Low":
      return "Low risk";
    case "Unrun":
      return "No prediction yet";
    default:
      return name;
  }
}
