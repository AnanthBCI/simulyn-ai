import {
  AlertTriangle,
  Building2,
  Cloud,
  Globe2,
  TrendingDown,
  TrendingUp,
  Truck,
} from "lucide-react";

function KpiCard({
  label,
  value,
  sub,
  trend,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  trend: "up" | "down" | "neutral";
  tone: "good" | "warn" | "danger" | "default";
}) {
  const valueColor =
    tone === "good"
      ? "text-emerald-400"
      : tone === "warn"
        ? "text-amber-400"
        : tone === "danger"
          ? "text-rose-400"
          : "text-white";
  const Trend = trend === "down" ? TrendingDown : TrendingUp;
  const trendColor =
    trend === "down"
      ? "text-emerald-400"
      : trend === "up"
        ? "text-rose-400"
        : "text-slate-500";

  return (
    <div className="rounded-xl border border-white/[0.12] bg-[#0d1322] p-4 backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${valueColor}`}>
        {value}
      </p>
      <p
        className={`mt-1 flex items-center gap-1 text-[11px] font-medium ${trendColor}`}
      >
        {trend !== "neutral" && <Trend className="h-3.5 w-3.5" aria-hidden />}
        {sub}
      </p>
    </div>
  );
}

function RiskTrendChart() {
  return (
    <div className="rounded-xl border border-white/[0.12] bg-[#0d1322] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-white">
          High-risk tasks · 30 days
        </p>
        <div className="flex gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            High
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Med
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Low
          </span>
        </div>
      </div>
      <svg
        viewBox="0 0 280 72"
        className="h-16 w-full"
        aria-hidden
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="riskHigh" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(244,63,94)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="rgb(244,63,94)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points="0,72 35,68 70,62 105,55 140,48 175,42 210,35 245,28 280,22 280,72"
          fill="rgb(16,185,129)"
          fillOpacity="0.35"
        />
        <polygon
          points="0,68 35,63 70,56 105,48 140,40 175,33 210,26 245,20 280,14 280,22 245,28 210,35 175,42 140,48 105,55 70,62 35,68 0,72"
          fill="rgb(245,158,11)"
          fillOpacity="0.35"
        />
        <polygon
          points="0,65 35,58 70,50 105,40 140,30 175,22 210,15 245,10 280,6 280,14 245,20 210,26 175,33 140,40 105,48 70,56 35,63"
          fill="url(#riskHigh)"
        />
        <polyline
          points="0,65 35,58 70,50 105,40 140,30 175,22 210,15 245,10 280,6"
          fill="none"
          stroke="rgb(244,63,94)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

const TOP_RISKS = [
  {
    icon: Truck,
    title: "Masonry L4",
    meta: "Tower B · 5d slip risk",
    level: "High",
    tone: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  },
  {
    icon: Cloud,
    title: "Weather window",
    meta: "3 outdoor tasks",
    level: "Med",
    tone: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  },
  {
    icon: Building2,
    title: "Steel erection",
    meta: "Phase 2 · progress gap",
    level: "Med",
    tone: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  },
] as const;

export function HeroDashboardPreview() {
  return (
    <div className="simulyn-float overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-b from-[#121a2e] to-[#0a0f1c] shadow-[0_32px_80px_-24px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.06)]">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-site-accent/15 text-site-accent">
            <Globe2 className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              Portfolio overview
            </p>
            <p className="text-[10px] text-slate-500">
              Acme Construction · Workspace
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-400 sm:inline">
            All projects
          </span>
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-site-accent to-violet-500 ring-2 ring-[#0a0f1c]" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        <KpiCard
          label="Projects"
          value="12"
          sub="+2 this month"
          trend="up"
          tone="default"
        />
        <KpiCard
          label="High-risk"
          value="8"
          sub="+3 vs last week"
          trend="up"
          tone="danger"
        />
        <KpiCard
          label="Open alerts"
          value="5"
          sub="2 need action"
          trend="neutral"
          tone="warn"
        />
        <KpiCard
          label="Health score"
          value="78"
          sub="Portfolio avg"
          trend="down"
          tone="good"
        />
      </div>

      <div className="grid gap-3 px-4 pb-4 lg:grid-cols-[1.2fr_0.8fr]">
        <RiskTrendChart />
        <div className="rounded-xl border border-white/[0.12] bg-[#0d1322] p-4">
          <p className="text-sm font-semibold text-white">Top risk alerts</p>
          <ul className="mt-3 space-y-2.5">
            {TOP_RISKS.map(({ icon: Icon, title, meta, level, tone }) => (
              <li
                key={title}
                className="flex items-start gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2"
              >
                <div className={`mt-0.5 rounded-md border p-1.5 ${tone}`}>
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-white">
                    {title}
                  </p>
                  <p className="text-[10px] text-slate-500">{meta}</p>
                </div>
                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${tone}`}
                >
                  {level}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-site-accent">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            AI reasons + Why? math
          </p>
        </div>
      </div>
    </div>
  );
}
