import {
  Activity,
  Brain,
  Calendar,
  MessageSquare,
  Sparkles,
  Users,
} from "lucide-react";

function FeatureCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Brain;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#111827] to-[#0a0f1c] p-5 transition hover:border-site-accent/30 hover:shadow-[0_12px_40px_-16px_rgba(59,130,246,0.25)]">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-site-accent/10 text-site-accent ring-1 ring-site-accent/20">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
        {description}
      </p>
      <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.06] bg-[#060a14]/80 p-3">
        {children}
      </div>
    </article>
  );
}

function HealthBriefViz() {
  const r = 28;
  const c = 2 * Math.PI * r;
  const score = 78;
  const offset = c * (1 - score / 100);
  return (
    <div className="flex items-center gap-4">
      <svg
        viewBox="0 0 72 72"
        className="h-20 w-20 shrink-0 -rotate-90"
        aria-hidden
      >
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="#1e293b"
          strokeWidth="6"
        />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div>
        <p className="text-2xl font-bold text-white">{score}/100</p>
        <p className="text-xs text-amber-300">Watch · Behind schedule</p>
        <p className="mt-1 text-[10px] leading-snug text-slate-500">
          Foundation work at risk — add crew this week.
        </p>
      </div>
    </div>
  );
}

function RiskPredictionViz() {
  return (
    <svg viewBox="0 0 200 80" className="h-20 w-full" aria-hidden>
      <line x1="0" y1="60" x2="200" y2="60" stroke="#334155" strokeWidth="1" />
      <rect
        x="120"
        y="8"
        width="70"
        height="52"
        fill="rgb(244,63,94)"
        fillOpacity="0.12"
        rx="4"
      />
      <text x="125" y="22" fill="#f87171" fontSize="8" fontWeight="600">
        High risk zone
      </text>
      <polyline
        points="0,55 25,52 50,48 75,42 100,38 125,32 150,28 175,22 200,18"
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="175" cy="22" r="4" fill="#f43f5e" />
    </svg>
  );
}

function ScheduleViz() {
  const rows = [
    { label: "Foundation", w: "85%", color: "bg-emerald-500" },
    { label: "Masonry", w: "42%", color: "bg-rose-500" },
    { label: "MEP", w: "30%", color: "bg-violet-500" },
  ];
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-[10px] text-slate-500">
            {r.label}
          </span>
          <div className="h-2 flex-1 rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full ${r.color}`}
              style={{ width: r.w }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function CopilotViz() {
  return (
    <div className="space-y-2 text-[10px]">
      <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-sm bg-site-accent/20 px-2 py-1.5 text-slate-200">
        Why is Tower B delayed?
      </div>
      <div className="max-w-[90%] rounded-lg rounded-tl-sm border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-slate-300">
        Masonry L4 is 30 pts behind expected progress. 3 high-risk tasks this
        week.
      </div>
    </div>
  );
}

function OrgViz() {
  const colors = [
    "from-blue-500",
    "from-violet-500",
    "from-emerald-500",
    "from-amber-500",
  ];
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {colors.map((c, i) => (
          <div
            key={c}
            className={`h-8 w-8 rounded-full bg-gradient-to-br ${c} to-slate-700 ring-2 ring-[#060a14]`}
            style={{ zIndex: 4 - i }}
          />
        ))}
      </div>
      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-slate-400">
        Multi-org · RBAC
      </span>
    </div>
  );
}

function WeeklyRecapViz() {
  const bars = [40, 65, 45, 80, 55, 70, 50];
  return (
    <div>
      <p className="mb-2 text-[10px] font-medium text-slate-500">
        Weekly look-ahead
      </p>
      <div className="flex h-16 items-end gap-1">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-gradient-to-t from-site-accent/80 to-violet-500/60"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function FeatureGrid() {
  return (
    <section
      id="features"
      className="scroll-mt-24 border-t border-white/[0.06] bg-[#060a14] py-20"
    >
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Everything you need in one intelligent platform
          </h2>
          <p className="mt-3 text-slate-400">
            Predict. Explain. Act. — the same pillars you see in the app, built
            for construction PMs who need answers before the site meeting.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={Activity}
            title="Deterministic Risk Prediction"
            description="Transparent, rule-based scoring of risk levels and delay days. See the math behind every prediction."
          >
            <RiskPredictionViz />
          </FeatureCard>
          <FeatureCard
            icon={Brain}
            title="AI Project Health Brief"
            description="One-line headline, trade-aware narrative, and a 0–100 health score on every project page."
          >
            <HealthBriefViz />
          </FeatureCard>
          <FeatureCard
            icon={Calendar}
            title="What-If Simulation Engine"
            description="Five scenario types (delays, resource adds, scope cuts, weather, more). Queue up to 8, run in parallel, compare side by side."
          >
            <ScheduleViz />
          </FeatureCard>
          <FeatureCard
            icon={Sparkles}
            title="Weekly Look-Ahead"
            description="Auto-generated recap across your portfolio — headline plus collapsible bullets, cached 12h."
          >
            <WeeklyRecapViz />
          </FeatureCard>
          <FeatureCard
            icon={MessageSquare}
            title="Ask Simulyn"
            description="Chat copilot grounded in your org data. Ask about delays, trade-offs, and what-if outcomes — no black box."
          >
            <CopilotViz />
          </FeatureCard>
          <FeatureCard
            icon={Users}
            title="Multi-tenant workspaces"
            description="Organizations, roles, and org switcher — every API call scoped with tenant isolation."
          >
            <OrgViz />
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}
