"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { ChevronDown, Info } from "lucide-react";
import { api, type RiskTrendPoint } from "@/lib/api";

/**
 * Hero widget on the dashboard: stacked-area history of High / Medium / Low
 * risk task counts across the chosen lookback window. Self-fetching so the
 * range dropdown can refresh data without lifting state into the dashboard.
 *
 * Data comes from /api/dashboard/risk-trend, which derives a daily snapshot
 * on the fly from existing predictions.
 */

const RANGES = [
  { value: 7, label: "7 Days" },
  { value: 14, label: "14 Days" },
  { value: 30, label: "30 Days" },
  { value: 60, label: "60 Days" },
  { value: 90, label: "90 Days" },
] as const;

type RangeValue = (typeof RANGES)[number]["value"];

const COLORS = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#10b981",
} as const;

// Plain-English definition of the risk thresholds, mirroring the gap rules in
// RuleBasedPrediction.cs / ai-service. Surfaced in info tooltips so users can
// understand what the colours mean without reading the source.
export const RISK_LEVEL_EXPLANATION = [
  "How risk levels are calculated:",
  "• Low (green): on track — within 5 percentage points of plan",
  "• Medium (orange): 6–15 points behind plan — needs a nudge",
  "• High (red): more than 15 points behind plan — needs action",
].join("\n");

export function RiskTrend({
  initialPoints,
  initialDays = 30,
}: {
  /** Optional pre-fetched data so the dashboard can hydrate the widget
   *  instantly on first render. Range changes always refetch. */
  initialPoints?: RiskTrendPoint[];
  initialDays?: RangeValue;
} = {}) {
  const [days, setDays] = useState<RangeValue>(initialDays);
  const [points, setPoints] = useState<RiskTrendPoint[]>(initialPoints ?? []);
  const [loading, setLoading] = useState(!initialPoints);

  const load = useCallback(async (d: RangeValue) => {
    setLoading(true);
    try {
      const res = await api.riskTrend(d);
      setPoints(res);
    } catch {
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch whenever the lookback changes. Skip the first run if we were
  // hydrated with initialPoints at exactly the initial range.
  const [didHydrate, setDidHydrate] = useState(false);
  useEffect(() => {
    if (!didHydrate && initialPoints && days === initialDays) {
      setDidHydrate(true);
      return;
    }
    setDidHydrate(true);
    void load(days);
  }, [days, initialDays, initialPoints, didHydrate, load]);

  useEffect(() => {
    function onOrgChange() {
      void load(days);
    }
    window.addEventListener("simulyn:org-changed", onOrgChange);
    return () => window.removeEventListener("simulyn:org-changed", onOrgChange);
  }, [days, load]);

  const data = useMemo(
    () =>
      points.map((p) => ({
        date: p.date,
        shortDate: shortDate(p.date),
        high: p.highRiskTasks,
        medium: p.mediumRiskTasks,
        low: p.lowRiskTasks,
      })),
    [points],
  );

  // Only render an Area for series that actually have data. Without this, an
  // all-zero series still draws its stroke at the same y-position as the layer
  // beneath it — e.g. when medium=0, the orange stroke overlays the green
  // top edge of Low Risk and the band looks like it's outlined in orange.
  const hasLow = useMemo(() => data.some((d) => d.low > 0), [data]);
  const hasMedium = useMemo(() => data.some((d) => d.medium > 0), [data]);
  const hasHigh = useMemo(() => data.some((d) => d.high > 0), [data]);

  const currentLabel =
    RANGES.find((r) => r.value === days)?.label ?? `${days} Days`;

  return (
    <div className="flex h-full flex-col rounded-xl border border-site-border bg-site-card p-5 shadow-card">
      {/* Header: title + info + range dropdown */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <h3 className="text-base font-semibold text-white">
            High-risk Tasks – Last {currentLabel}
          </h3>
          <span
            title={`Daily count of tasks the AI flagged at each risk level over the selected window.\n\n${RISK_LEVEL_EXPLANATION}`}
            className="inline-flex items-center text-site-muted hover:text-slate-300"
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">
              Daily count of tasks the AI flagged at each risk level.
              {" "}
              {RISK_LEVEL_EXPLANATION}
            </span>
          </span>
        </div>

        <div className="relative">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as RangeValue)}
            aria-label="Lookback window"
            className="appearance-none rounded-md border border-site-border bg-site-bg/60 py-1 pl-2.5 pr-7 text-xs text-slate-200 outline-none transition hover:bg-white/5 focus:border-site-accent focus:ring-2 focus:ring-site-accent/20"
          >
            {RANGES.map((r) => (
              <option
                key={r.value}
                value={r.value}
                className="bg-site-card text-white"
              >
                {r.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-site-muted"
            aria-hidden
          />
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-300">
        <LegendDot color={COLORS.high} label="High Risk" />
        <LegendDot color={COLORS.medium} label="Medium Risk" />
        <LegendDot color={COLORS.low} label="Low Risk" />
      </div>

      {/* Chart */}
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
                <linearGradient id="riskTrendHigh" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.high} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={COLORS.high} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="riskTrendMedium" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.medium} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={COLORS.medium} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="riskTrendLow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.low} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={COLORS.low} stopOpacity={0.05} />
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
                cursor={{ stroke: "#3b82f6", strokeOpacity: 0.4 }}
              />
              {/* Drawn in stack order Low -> Medium -> High so High sits on top
                  visually (matches the legend reading order). Each Area is
                  skipped when its series is all-zero so its stroke doesn't
                  overlay the layer beneath it. */}
              {hasLow && (
                <Area
                  type="monotone"
                  dataKey="low"
                  name="Low Risk"
                  stackId="risk"
                  stroke={COLORS.low}
                  strokeWidth={2}
                  fill="url(#riskTrendLow)"
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: COLORS.low,
                    stroke: "#0a0f1c",
                    strokeWidth: 2,
                  }}
                  animationDuration={400}
                />
              )}
              {hasMedium && (
                <Area
                  type="monotone"
                  dataKey="medium"
                  name="Medium Risk"
                  stackId="risk"
                  stroke={COLORS.medium}
                  strokeWidth={2}
                  fill="url(#riskTrendMedium)"
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: COLORS.medium,
                    stroke: "#0a0f1c",
                    strokeWidth: 2,
                  }}
                  animationDuration={400}
                />
              )}
              {hasHigh && (
                <Area
                  type="monotone"
                  dataKey="high"
                  name="High Risk"
                  stackId="risk"
                  stroke={COLORS.high}
                  strokeWidth={2.5}
                  fill="url(#riskTrendHigh)"
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: COLORS.high,
                    stroke: "#0a0f1c",
                    strokeWidth: 2,
                  }}
                  animationDuration={400}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      {label}
    </span>
  );
}

type TooltipDatum = {
  date: string;
  high: number;
  medium: number;
  low: number;
};

type TooltipPayloadEntry = {
  payload?: TooltipDatum;
};

function RiskTrendTooltip(props: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}) {
  const { active, payload } = props;
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;
  const total = datum.high + datum.medium + datum.low;
  return (
    <div className="rounded-lg border border-site-border bg-site-card px-3 py-2 text-xs shadow-card">
      <p className="font-medium text-white">{prettyDate(datum.date)}</p>
      <div className="mt-1 space-y-0.5">
        <TooltipRow color={COLORS.high} label="High Risk" value={datum.high} />
        <TooltipRow
          color={COLORS.medium}
          label="Medium Risk"
          value={datum.medium}
        />
        <TooltipRow color={COLORS.low} label="Low Risk" value={datum.low} />
      </div>
      <p className="mt-1.5 border-t border-site-border pt-1.5 text-[11px] text-site-muted">
        Total: <span className="font-semibold text-slate-200">{total}</span>
      </p>
    </div>
  );
}

function TooltipRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 text-site-muted">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: color }}
          aria-hidden
        />
        {label}
      </span>
      <span className="font-semibold text-white">{value}</span>
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
