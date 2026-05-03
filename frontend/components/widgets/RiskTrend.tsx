"use client";

import { useMemo } from "react";
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
 * Hero widget on the dashboard: 30-day history of high-risk task counts as a
 * gradient area chart. Inspired by the BuildSmart "Progress overview" panel
 * — a single, scannable signal that answers "are we trending toward more or
 * fewer risky tasks?".
 *
 * Data comes from /api/dashboard/risk-trend, which derives a daily snapshot
 * on the fly from existing predictions (no separate snapshot table yet).
 */
export function RiskTrend({
  points,
  loading,
}: {
  points: RiskTrendPoint[];
  loading?: boolean;
}) {
  const data = useMemo(
    () =>
      points.map((p) => ({
        date: p.date,
        // Short date for the X-axis tick.
        shortDate: shortDate(p.date),
        high: p.highRiskTasks,
        medium: p.mediumRiskTasks,
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
        ? `+${stats.delta} vs ${data.length}d ago`
        : `${stats.delta} vs ${data.length}d ago`;

  const TrendIcon = trendIcon;

  return (
    <div className="flex h-full flex-col rounded-xl border border-site-border bg-site-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">
            High-risk tasks · last {data.length || 30} days
          </h3>
          <p className="mt-1 text-xs text-site-muted">
            Daily snapshot of tasks the AI flagged as high risk.
          </p>
        </div>
        {stats && (
          <div className="text-right">
            <p className="text-3xl font-bold text-white">{stats.last}</p>
            <p className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${trendColor}`}>
              <TrendIcon className="h-3.5 w-3.5" />
              {trendLabel}
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 min-h-[260px] flex-1">
        {loading ? (
          <div className="grid h-full place-items-center text-sm text-site-muted">
            Loading chart…
          </div>
        ) : data.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-site-muted">
            No prediction history yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={260}>
            <AreaChart
              data={data}
              margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
            >
              <defs>
                <linearGradient id="riskTrendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
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
              <Tooltip content={<RiskTrendTooltip />} cursor={{ stroke: "#3b82f6", strokeOpacity: 0.4 }} />
              <Area
                type="monotone"
                dataKey="high"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="url(#riskTrendGradient)"
                dot={false}
                activeDot={{
                  r: 5,
                  fill: "#3b82f6",
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
          <Stat label={`${data.length}d ago`} value={stats.first} />
          <Stat label="Peak" value={stats.peak} tone="warn" />
          <Stat label="Today" value={stats.last} tone={stats.delta > 0 ? "danger" : "good"} />
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
      <p className={`text-lg font-semibold ${cls}`}>{value}</p>
      <p className="text-[11px] uppercase tracking-wider text-site-muted">{label}</p>
    </div>
  );
}

type TooltipPayload = {
  payload?: { date: string; high: number; medium: number };
};

function RiskTrendTooltip(props: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  const { active, payload } = props;
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;
  return (
    <div className="rounded-lg border border-site-border bg-site-card px-3 py-2 text-xs shadow-card">
      <p className="font-medium text-white">{prettyDate(datum.date)}</p>
      <p className="mt-0.5 text-site-muted">
        High risk: <span className="font-semibold text-red-400">{datum.high}</span>
      </p>
      {datum.medium > 0 && (
        <p className="text-site-muted">
          Medium: <span className="font-semibold text-amber-400">{datum.medium}</span>
        </p>
      )}
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
