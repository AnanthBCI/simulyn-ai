import { CheckCircle2 } from "lucide-react";
import { Reveal } from "@/components/Reveal";

function DashboardMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.12] bg-[#111827] shadow-[0_32px_80px_-24px_rgba(59,130,246,0.3)]">
      <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#0a0f1c] px-5 py-3.5 text-sm text-slate-500">
        <span className="font-semibold uppercase tracking-wider text-slate-300">
          Dashboard
        </span>
        <span className="text-xs">Acme Construction</span>
      </div>
      <div className="space-y-4 p-5">
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Projects", value: "12" },
            { label: "Tasks", value: "184" },
            { label: "High-risk", value: "8", tone: "text-rose-300" },
            { label: "Alerts", value: "5", tone: "text-amber-300" },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-lg border border-white/[0.08] bg-[#0a0f1c] p-3"
            >
              <div className="text-[11px] font-medium text-slate-400">
                {k.label}
              </div>
              <div
                className={`mt-1.5 text-2xl font-bold ${k.tone ?? "text-white"}`}
              >
                {k.value}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-[#0a0f1c] p-4">
          <p className="text-sm font-semibold text-white">
            ✨ AI weekly look-ahead
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            3 projects worsened vs last week — Masonry L4 and steel erection
            need immediate attention.
          </p>
        </div>
        <ul className="space-y-2">
          {[
            "Masonry L4 → 5d delay risk",
            "MEP rough-in slipping",
            "Foundation on track",
          ].map((text) => (
            <li
              key={text}
              className="rounded-md border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 text-sm font-medium text-slate-300"
            >
              {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function LandingDemo() {
  return (
    <section
      id="demo"
      className="scroll-mt-24 border-t border-white/[0.06] py-20"
    >
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <DashboardMockup />
          </Reveal>
          <Reveal delay={120}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-site-accent">
              See it in action
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              From schedule to decisions in under a minute
            </h2>
            <p className="mt-4 text-slate-400">
              Load a sample project, run predictions, read the AI health brief,
              stress-test with what-if scenarios, and ask Simulyn — the same
              flow you get after sign-up.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-slate-300">
              {[
                "KPI strip + risk trend + AI insights on the dashboard",
                "Per-task risk with Why? tooltip showing deterministic math",
                "Compare up to 8 what-if scenarios side by side",
              ].map((b) => (
                <li key={b} className="flex gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-site-accent" />
                  {b}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
