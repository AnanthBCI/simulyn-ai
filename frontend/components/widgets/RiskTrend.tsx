"use client";

import { useId, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { RiskTrendPoint } from "@/lib/api";

/**
 * Dashboard trend: stacked area chart of high / medium / low risk task counts
 * over the requested window.
 */
export function RiskTrend({
  points,
  loading,
}: {
  points: RiskTrendPoint[];
  loading?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const data = useMemo(
    () =>
      points.map((p) => ({
        date: p.date,
        shortDate: shortDate(p.date),
        high: p.highRiskTasks,
        medium: p.mediumRiskTasks,
        low: p.lowRiskTasks,
        total: p.highRiskTasks + p.mediumRiskTasks + p.lowRiskTasks,
      })),
    [points],
  );

  const stats = useMemo(() => {
    if (data.length < 2) return null;
    const first = data[0].high;
    const last = data[data.length - 1].high;
    const peak = data.reduce((max, d) => Math.max(max, d.high), 0);
    const delta = last - first;
    return { first, last, peak, delta };
  }, [data]);

  const trendIcon =
    !stats || stats.delta === 0
      ? Minus
      : stats.delta > 0
        ? TrendingUp
        : TrendingDown;
  const trendColor =
    !stats || stats.delta === 0
      ? "text-site-muted"
      : stats.delta > 0
        ? "text-red-400"
        : "text-emerald-400";
  const trendLabel = !stats
    ? "—"
    : stats.delta === 0
      ? "Flat"
      : stats.delta > 0
        ? `+${stats.delta} high vs ${data.length}d ago`
        : `${stats.delta} high vs ${data.length}d ago`;

  const TrendIcon = trendIcon;

  return (
    <div className="flex h-full flex-col rounded-xl border border-site-border bg-site-card/80 p-5 shadow-card backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">Portfolio risk trend</h3>
          <p className="mt-1 text-xs text-site-muted">
            Stacked high / medium / low · last {data.length || 30} days
          </p>
        </div>
        {stats && (
          <div className="text-right">
            <p className="text-3xl font-bold tabular-nums text-white">{stats.last}</p>
            <p className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${trendColor}`}>
              <TrendIcon className="h-3.5 w-3.5" />
              <span>High-risk {trendLabel}</span>
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-site-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-red-500" aria-hidden />
          High
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-amber-500" aria-hidden />
          Medium
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-emerald-500" aria-hidden />
          Low
        </span>
      </div>

      <div className="mt-4 min-h-[220px] flex-1 sm:min-h-[260px]">
        {loading ? (
          <div className="grid h-full min-h-[220px] place-items-center text-sm text-site-muted sm:min-h-[260px]">
            Loading chart…
          </div>
        ) : data.length === 0 ? (
          <div className="grid h-full min-h-[220px] place-items-center text-sm text-site-muted sm:min-h-[260px]">
            No prediction history yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={240}>
            <AreaChart
              data={data}
              margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
            >
              <defs>
                <linearGradient id={`${uid}-low`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id={`${uid}-med`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.06} />
                </linearGradient>
                <linearGradient id={`${uid}-high`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.65} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.08} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1f2937"
                vertical={false}
              />
              <XAxis
                dataKey="shortDate"
                stroke="#475569"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis
                stroke="#475569"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={32}
              />
              <Tooltip
                content={<RiskTrendTooltip />}
                cursor={{ stroke: "#64748b", strokeOpacity: 0.35 }}
              />
              <Area
                type="monotone"
                dataKey="low"
                stackId="risk"
                stroke="#10b981"
                strokeWidth={1}
                fill={`url(#${uid}-low)`}
                dot={false}
                animationDuration={400}
              />
              <Area
                type="monotone"
                dataKey="medium"
                stackId="risk"
                stroke="#f59e0b"
                strokeWidth={1}
                fill={`url(#${uid}-med)`}
                dot={false}
                animationDuration={400}
              />
              <Area
                type="monotone"
                dataKey="high"
                stackId="risk"
                stroke="#ef4444"
                strokeWidth={1.5}
                fill={`url(#${uid}-high)`}
                dot={false}
                activeDot={{
                  r: 5,
                  fill: "#ef4444",
                  stroke: "#0a0f1c",
                  strokeWidth: 2,
                }}
                animationDuration={400}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {stats && (
        <div className="mt-4 grid grid-cols-3 divide-x divide-site-border border-t border-site-border pt-3 text-center">
          <Stat label={`${data.length}d ago · high`} value={stats.first} />
          <Stat label="Peak high" value={stats.peak} tone="warn" />
          <Stat label="Today · high" value={stats.last} tone={stats.delta > 0 ? "danger" : "good"} />
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn" | "danger" | "good";
}) {
  const cls =
    tone === "danger"
      ? "text-red-400"
      : tone === "warn"
        ? "text-amber-400"
        : tone === "good"
          ? "text-emerald-400"
          : "text-white";
  return (
    <div className="px-2">
      <p className={`text-lg font-semibold tabular-nums ${cls}`}>{value}</p>
      <p className="text-[11px] uppercase tracking-wider text-site-muted">{label}</p>
    </div>
  );
}

type TooltipPayload = {
  payload?: { date: string; high: number; medium: number; low: number; total: number };
};

function RiskTrendTooltip(props: { active?: boolean; payload?: TooltipPayload[] }) {
  const { active, payload } = props;
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;
  return (
    <div className="rounded-lg border border-site-border bg-site-card px-3 py-2 text-xs shadow-card">
      <p className="font-medium text-white">{prettyDate(datum.date)}</p>
      <p className="mt-1 text-site-muted">
        High: <span className="font-semibold text-red-400">{datum.high}</span>
      </p>
      <p className="text-site-muted">
        Medium: <span className="font-semibold text-amber-400">{datum.medium}</span>
      </p>
      <p className="text-site-muted">
        Low: <span className="font-semibold text-emerald-400">{datum.low}</span>
      </p>
      <p className="mt-1 border-t border-site-border pt-1 text-site-muted">
        Total tasks: <span className="font-medium text-white">{datum.total}</span>
      </p>
    </div>
  );
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function prettyDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
