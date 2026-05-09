import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Brain,
  Building2,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  HardHat,
  KeyRound,
  LineChart,
  Lock,
  MessageSquare,
  Shield,
  Sparkles,
  TrendingUp,
  Upload,
  Users,
  Zap,
} from "lucide-react";

export const metadata = {
  title: "Simulyn AI — Predict. Explain. Act.",
  description:
    "Construction Decision Intelligence. Spot delays before they happen, understand why, and fix them in minutes—not after they cost you weeks.",
};

const PRIMARY_BTN =
  "rounded-lg bg-site-accent px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-600 hover:shadow-[0_0_32px_rgba(59,130,246,0.7)] shadow-[0_0_24px_rgba(59,130,246,0.45)]";

const SECONDARY_BTN =
  "rounded-lg border border-site-border bg-site-card px-5 py-3 text-sm font-medium text-white transition hover:border-site-accent/50 hover:bg-white/5";

function CoreFeature({
  icon: Icon,
  eyebrow,
  title,
  body,
  quote,
  footer,
}: {
  icon: typeof Sparkles;
  eyebrow: string;
  title: string;
  body: string;
  quote?: string;
  footer: string;
}) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-site-border bg-gradient-to-br from-site-card to-site-card/60 p-6 transition duration-300 hover:-translate-y-1 hover:border-site-accent/50 hover:shadow-[0_8px_40px_-12px_rgba(59,130,246,0.35)]">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-site-accent/10 blur-2xl transition group-hover:bg-site-accent/20" />
      <div className="relative flex flex-1 flex-col">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-site-accent/15 text-site-accent ring-1 ring-site-accent/30">
          <Icon className="h-5 w-5" />
        </div>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-site-accent">
          {eyebrow}
        </p>
        <h3 className="mt-1 text-lg font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-site-muted">{body}</p>
        {quote && (
          <blockquote className="mt-4 rounded-lg border-l-2 border-site-accent/60 bg-white/[0.03] px-3 py-2 text-xs italic leading-relaxed text-slate-300">
            &ldquo;{quote}&rdquo;
          </blockquote>
        )}
        <p className="mt-auto pt-4 text-xs font-medium text-site-muted">{footer}</p>
      </div>
    </div>
  );
}

function SupportFeature({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Sparkles;
  title: string;
  body: string;
}) {
  return (
    <div className="group flex gap-3 rounded-xl border border-site-border bg-site-card/60 p-4 transition hover:-translate-y-0.5 hover:border-site-accent/40 hover:bg-site-card">
      <div className="shrink-0 rounded-lg bg-white/5 p-2 text-site-muted transition group-hover:bg-site-accent/15 group-hover:text-site-accent">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h4 className="text-sm font-semibold text-white">{title}</h4>
        <p className="mt-1 text-xs leading-relaxed text-site-muted">{body}</p>
      </div>
    </div>
  );
}

function Step({
  number,
  icon: Icon,
  title,
  body,
}: {
  number: string;
  icon: typeof Sparkles;
  title: string;
  body: string;
}) {
  return (
    <div className="relative flex flex-col items-center text-center">
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-site-accent/10 ring-1 ring-site-accent/30">
        <Icon className="h-7 w-7 text-site-accent" />
        <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-site-accent text-[11px] font-bold text-white">
          {number}
        </span>
      </div>
      <h3 className="mt-5 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 max-w-[240px] text-sm text-site-muted">{body}</p>
    </div>
  );
}

function AudienceTile({
  icon: Icon,
  title,
}: {
  icon: typeof Sparkles;
  title: string;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-xl border border-site-border bg-site-card/60 p-4 transition hover:-translate-y-0.5 hover:border-site-accent/40 hover:bg-site-card">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-site-accent/10 text-site-accent transition group-hover:bg-site-accent/20">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-white">{title}</p>
    </div>
  );
}

function TrustTile({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Sparkles;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-site-border bg-site-card/60 p-5 transition hover:-translate-y-0.5 hover:border-site-accent/40">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30">
        <Icon className="h-5 w-5" />
      </div>
      <h4 className="mt-4 text-sm font-semibold text-white">{title}</h4>
      <p className="mt-1 text-xs leading-relaxed text-site-muted">{body}</p>
    </div>
  );
}

function PriceCard({
  name,
  price,
  priceSuffix,
  tagline,
  features,
  highlighted,
  cta,
  href,
}: {
  name: string;
  price: string;
  priceSuffix?: string;
  tagline: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
  /** Where the CTA goes. Defaults to /register?plan={name} so the user lands
   *  in signup pre-tagged with their chosen plan. mailto: links open the user's
   *  email client (used for the Enterprise tier). */
  href?: string;
}) {
  const ctaHref = href ?? `/register?plan=${encodeURIComponent(name)}`;
  const isExternal = ctaHref.startsWith("mailto:") || ctaHref.startsWith("http");
  const ctaClass = `mt-6 rounded-lg px-4 py-2.5 text-center text-sm font-medium transition ${
    highlighted
      ? "bg-site-accent text-white hover:bg-blue-600 hover:shadow-[0_0_24px_rgba(59,130,246,0.5)]"
      : "border border-site-border text-white hover:border-site-accent/50 hover:bg-white/5"
  }`;
  return (
    <div
      className={`flex flex-col rounded-2xl border p-6 transition hover:-translate-y-1 ${
        highlighted
          ? "border-site-accent bg-gradient-to-br from-site-accent/10 via-site-card to-site-card shadow-[0_0_0_1px_rgba(59,130,246,0.4),0_12px_40px_-8px_rgba(59,130,246,0.4)]"
          : "border-site-border bg-site-card hover:border-site-accent/40"
      }`}
    >
      {highlighted && (
        <span className="mb-3 inline-block w-fit rounded-full bg-site-accent/15 px-3 py-1 text-xs font-medium text-site-accent">
          Most popular
        </span>
      )}
      <h3 className="text-lg font-semibold text-white">{name}</h3>
      <p className="text-sm text-site-muted">{tagline}</p>
      <p className="mt-4 flex items-baseline gap-1 text-3xl font-bold text-white">
        {price}
        {priceSuffix && (
          <span className="text-sm font-normal text-site-muted">{priceSuffix}</span>
        )}
      </p>
      <ul className="mt-6 space-y-2 text-sm text-slate-300">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-site-accent" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {isExternal ? (
        <a href={ctaHref} className={ctaClass}>{cta}</a>
      ) : (
        <Link href={ctaHref} className={ctaClass}>{cta}</Link>
      )}
    </div>
  );
}

function HeroPreview() {
  return (
    <div className="relative mx-auto mt-14 max-w-3xl">
      <div className="absolute -inset-x-8 -inset-y-6 -z-10 rounded-[32px] bg-gradient-to-br from-site-accent/20 via-site-accent/5 to-transparent blur-2xl" />
      <div className="rounded-2xl border border-site-border bg-site-card/80 p-5 shadow-[0_20px_80px_-20px_rgba(59,130,246,0.35)] backdrop-blur">
        <div className="flex items-center justify-between border-b border-site-border pb-3">
          <div className="flex items-center gap-2 text-xs text-site-muted">
            <span className="flex h-2 w-2 rounded-full bg-amber-400" />
            Tower B Construction · AI Project Health Brief
          </div>
          <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400">
            Health 62
          </span>
        </div>
        <p className="mt-3 text-sm text-white">
          <span className="font-semibold">Tower B is 3 days behind plan.</span>{" "}
          <span className="text-slate-300">
            Masonry on level 4 is the bottleneck — crew availability is the most sensitive lever this week.
          </span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] text-amber-400">
            Watch
          </span>
          <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-slate-300">
            Behind schedule
          </span>
          <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-slate-300">
            Finish week 24
          </span>
        </div>

        <div className="mt-5 border-t border-site-border pt-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-site-muted">
              Scenario comparison
            </div>
            <div className="text-[11px] text-site-muted">Impact (days)</div>
          </div>
          <div className="divide-y divide-site-border overflow-hidden rounded-lg border border-site-border">
            <div className="flex items-center justify-between px-3 py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                  Uniform slip
                </span>
                <span className="text-slate-200">+3d across all tasks</span>
              </div>
              <span className="rounded bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
                +3d
              </span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                  Add resource
                </span>
                <span className="text-slate-200">Masonry crew ×1.5</span>
              </div>
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                −2d
              </span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                  Weather pause
                </span>
                <span className="text-slate-200">2-day rain window</span>
              </div>
              <span className="rounded bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
                +2d
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoMomentShowcase() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-site-border bg-site-card p-6 transition hover:-translate-y-1 hover:border-site-accent/40">
        <div className="mb-4 flex items-center gap-2 text-xs text-site-accent">
          <Brain className="h-4 w-4" />
          <span className="font-medium uppercase tracking-wider">AI Health Brief</span>
        </div>
        <div className="rounded-xl border border-site-border bg-site-bg/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <h4 className="text-base font-semibold text-white">
              Tower B is trending off-track this week
            </h4>
            <span className="shrink-0 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-400">
              62 / 100
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Masonry on level 4 is 30% behind window, and rebar delivery slipped 2 days.
            Bringing a second masonry crew Mon-Wed recovers most of the schedule;
            without it, finish pushes to week 26.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="rounded bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">
              Watch
            </span>
            <span className="rounded bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">
              Crew-sensitive
            </span>
            <span className="rounded bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">
              2 critical tasks
            </span>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="text-site-muted">Cached 12h · auto-refresh weekly</span>
          <span className="inline-flex items-center gap-1 text-site-accent">
            Show me what could go wrong
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-site-border bg-site-card p-6 transition hover:-translate-y-1 hover:border-site-accent/40">
        <div className="mb-4 flex items-center gap-2 text-xs text-site-accent">
          <Activity className="h-4 w-4" />
          <span className="font-medium uppercase tracking-wider">
            Scenario comparison
          </span>
        </div>
        <div className="overflow-hidden rounded-xl border border-site-border bg-site-bg/60">
          <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-site-border px-4 py-2.5 text-[11px] uppercase tracking-wider text-site-muted">
            <div>Scenario</div>
            <div>Impact</div>
          </div>
          <div className="divide-y divide-site-border">
            <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 text-xs">
              <div>
                <div className="font-medium text-white">Uniform slip</div>
                <div className="text-site-muted">+3d across all 42 tasks</div>
              </div>
              <span className="self-center rounded bg-rose-500/15 px-2 py-1 text-[11px] font-semibold text-rose-300">
                +3d
              </span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 text-xs">
              <div>
                <div className="font-medium text-white">Add resource</div>
                <div className="text-site-muted">Masonry crew ×1.5, Mon–Fri</div>
              </div>
              <span className="self-center rounded bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-300">
                −2d
              </span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 text-xs">
              <div>
                <div className="font-medium text-white">Weather pause</div>
                <div className="text-site-muted">2-day rain window, outdoor tasks</div>
              </div>
              <span className="self-center rounded bg-rose-500/15 px-2 py-1 text-[11px] font-semibold text-rose-300">
                +2d
              </span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 text-xs">
              <div>
                <div className="font-medium text-white">Scope reduction</div>
                <div className="text-site-muted">Drop optional finishes, phase 2</div>
              </div>
              <span className="self-center rounded bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-300">
                −4d
              </span>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="text-site-muted">Up to 8 scenarios, in parallel</span>
          <span className="inline-flex items-center gap-1 text-site-accent">
            Suggest scenarios
            <Sparkles className="h-3 w-3" />
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div>
      <header className="sticky top-0 z-40 border-b border-site-border bg-site-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo-mark.png"
              alt="Simulyn AI"
              width={36}
              height={36}
              priority
              className="h-9 w-9 object-contain"
            />
            <span className="text-lg font-semibold tracking-tight text-white">
              Simulyn <span className="text-site-accent">AI</span>
            </span>
          </Link>
          <div className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <a href="#features" className="transition hover:text-white">
              Features
            </a>
            <a href="#demo" className="transition hover:text-white">
              See it in action
            </a>
            <a href="#pricing" className="transition hover:text-white">
              Pricing
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-300 hover:text-white">
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-site-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-600 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-site-accent/20 blur-[120px]" />
          <div className="absolute left-1/4 top-1/2 h-[400px] w-[400px] rounded-full bg-blue-500/10 blur-[100px]" />
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(148,163,184,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.4) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage:
                "radial-gradient(ellipse 70% 50% at 50% 30%, black 40%, transparent 80%)",
            }}
          />
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-8 pt-20 text-center sm:pt-24">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-site-accent/40 bg-site-accent/10 px-3 py-1 text-xs font-medium text-site-accent">
            <Sparkles className="h-3 w-3" />
            The construction risk co-pilot
          </span>
          <h1 className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-7xl">
            Predict.{" "}
            <span className="bg-gradient-to-r from-site-accent to-blue-400 bg-clip-text text-transparent">
              Explain.
            </span>{" "}
            <span className="bg-gradient-to-r from-blue-400 to-site-accent bg-clip-text text-transparent">
              Act.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-200 sm:text-xl">
            Spot delays before they happen, understand <em>why</em>, and fix them in
            minutes—not after they cost you weeks.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-base text-site-muted">
            Simulyn reads your schedule, flags every at-risk task, and gives you clear,
            trade-aware actions—so you walk into every site meeting prepared.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/register" className={PRIMARY_BTN}>
              Start 30-day free trial
            </Link>
            <a href="#demo" className={SECONDARY_BTN}>
              View demo
            </a>
          </div>
          <p className="mt-3 text-xs text-site-muted">
            No credit card required · Results in under 60 seconds · Works with Excel schedules
          </p>

          <HeroPreview />
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-24 px-4 py-16">
        {/* SOCIAL PROOF — single line */}
        <section className="text-center">
          <p className="mx-auto max-w-2xl text-base italic text-site-muted">
            Built for modern construction teams who want to stay ahead of delays—not
            react to them.
          </p>
        </section>

        {/* PROBLEM */}
        <section className="relative">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-300">
              <AlertTriangle className="h-3 w-3" />
              The problem
            </span>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Construction delays don&apos;t happen overnight.
            </h2>
            <p className="mt-3 text-lg text-site-muted">
              They build up quietly—until it&apos;s too late.
            </p>
          </div>
          <div className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-2">
            {[
              "Risks are buried inside complex schedules",
              "Delays are discovered after they happen",
              "Teams spend hours creating weekly reports",
              "Decisions are reactive instead of proactive",
            ].map((line) => (
              <div
                key={line}
                className="flex items-start gap-3 rounded-xl border border-site-border bg-site-card/40 p-4"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <p className="text-sm text-slate-200">{line}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-base font-medium text-white">
            By the time you notice, the timeline has already slipped.
          </p>
        </section>

        {/* SOLUTION */}
        <section className="relative">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-site-accent/40 bg-site-accent/10 px-3 py-1 text-xs font-medium text-site-accent">
              <Sparkles className="h-3 w-3" />
              The solution
            </span>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Meet Simulyn AI —{" "}
              <span className="bg-gradient-to-r from-site-accent to-blue-400 bg-clip-text text-transparent">
                Construction Decision Intelligence
              </span>
            </h2>
            <p className="mt-3 text-lg text-site-muted">
              Simulyn turns your schedule into clear, actionable decisions.
            </p>
          </div>
          <div className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-2">
            {[
              {
                icon: Activity,
                text: "Instantly analyzes your entire project",
              },
              {
                icon: AlertCircle,
                text: "Flags tasks at risk before they slip",
              },
              {
                icon: Brain,
                text: "Explains the reason in plain English",
              },
              {
                icon: Zap,
                text: "Recommends actions you can take immediately",
              },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-3 rounded-xl border border-site-border bg-site-card/60 p-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-site-accent/10 text-site-accent">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium text-white">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CORE FEATURES */}
        <section id="features">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Three pillars that do the work of a planner
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-site-muted">
              Built from the ground up so a site PM can answer the three questions
              that matter every Monday — without opening a spreadsheet.
            </p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            <CoreFeature
              icon={Brain}
              eyebrow="Know in seconds"
              title="AI Project Health Brief"
              body="Every project opens with a one-line headline, a short explanation, and a 0-100 health score. Refresh any time; cached 12h so it's instant on next visit."
              quote="Foundation work is at risk due to slower progress. Add a second crew this week to avoid a 5-day delay."
              footer="Pinned to every project page"
            />
            <CoreFeature
              icon={Calendar}
              eyebrow="Stop writing reports"
              title="Weekly Look-Ahead (Auto-Generated)"
              body="Simulyn writes your weekly summary for you: what got worse, what improved, what needs attention — grounded in a 7-day risk delta across every project."
              footer="Cached 12h per organization"
            />
            <CoreFeature
              icon={Activity}
              eyebrow="Test before you decide"
              title="What-If Simulation Engine"
              body="Delay a task, add resources, or pause for weather — then see the impact on your timeline. Compare up to 8 scenarios side by side, in parallel."
              footer="5 scenario types · Auto-suggest included"
            />
          </div>
        </section>

        {/* SUPPORTING FEATURES */}
        <section>
          <div className="text-center">
            <h3 className="text-xl font-semibold text-white">Everything else you need</h3>
            <p className="mt-2 text-sm text-site-muted">
              The glue that makes the three pillars actually work in a real project.
            </p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SupportFeature
              icon={AlertCircle}
              title="Top Risk Alerts"
              body="Simulyn surfaces the tasks most likely to delay your project — with plain-English reasons and a Why? tooltip showing the exact math."
            />
            <SupportFeature
              icon={Sparkles}
              title="Auto-Suggest Scenarios"
              body="One click and the AI picks the 3-4 what-ifs worth running right now, given this project's current risk and progress state."
            />
            <SupportFeature
              icon={TrendingUp}
              title="Prediction Delta Tracking"
              body="See what changed, not just the current state. Re-runs surface Medium→High, Risk improved, +3d vs last — right in the task table."
            />
            <SupportFeature
              icon={FileSpreadsheet}
              title="Excel Schedule Import"
              body="Drop a .xlsx and headers are auto-detected. Predictions run on every imported task automatically — no setup, no config."
            />
            <SupportFeature
              icon={MessageSquare}
              title='AI Copilot — "Ask Simulyn"'
              body='Ask questions in plain English: "What’s at risk this week?", "Why is this project delayed?" Instant answers, grounded in your real project data.'
            />
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="overflow-hidden rounded-3xl border border-site-border bg-gradient-to-br from-site-card via-site-card to-site-accent/5 p-10">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white">
              Simple. Fast. Built for real workflows.
            </h2>
            <p className="mt-2 text-sm text-site-muted">
              Upload once, then live in the loop.
            </p>
          </div>
          <div className="mt-12 flex flex-col items-center gap-10 lg:flex-row lg:items-start lg:justify-between">
            <Step
              number="1"
              icon={Upload}
              title="Upload your schedule"
              body="Import your Excel file or load a sample project."
            />
            <ArrowRight className="hidden h-6 w-6 shrink-0 text-site-accent/60 lg:mt-5 lg:block" />
            <Step
              number="2"
              icon={Brain}
              title="Simulyn analyzes your plan"
              body="Every task gets a risk score, delay estimate, and explanation."
            />
            <ArrowRight className="hidden h-6 w-6 shrink-0 text-site-accent/60 lg:mt-5 lg:block" />
            <Step
              number="3"
              icon={Zap}
              title="Take action with confidence"
              body="Use AI insights and simulations to fix issues before they escalate."
            />
          </div>
        </section>

        {/* SEE IT IN ACTION */}
        <section id="demo">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-site-accent/40 bg-site-accent/10 px-3 py-1 text-xs font-medium text-site-accent">
              <Sparkles className="h-3 w-3" />
              See it in action
            </span>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              From schedule → insights → decisions in under a minute
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-site-muted">
              Simulyn analyzes your project, identifies risks, and gives you clear
              next steps—before delays impact your timeline.
            </p>
          </div>
          <div className="mt-12">
            <DemoMomentShowcase />
          </div>
        </section>

        {/* WHO IT'S FOR */}
        <section>
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Built for the teams running the site
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-site-muted">
              Whether you&apos;re running a single tower or a portfolio of civil
              projects, Simulyn fits the way you already work.
            </p>
          </div>
          <div className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-2">
            <AudienceTile icon={Users} title="Construction Project Managers" />
            <AudienceTile icon={HardHat} title="Contractors & Site Engineers" />
            <AudienceTile icon={LineChart} title="Planning & Scheduling Teams" />
            <AudienceTile
              icon={Building2}
              title="Mid-size to large construction companies"
            />
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Simple, project-based pricing
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-site-muted">
              Pay per active project—not per seat. Invite your whole team at no extra
              cost.
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              No credit card required · Cancel any time
            </p>
          </div>
          <div className="mx-auto mt-10 grid max-w-5xl gap-6 sm:grid-cols-3">
            <PriceCard
              name="Starter"
              price="Free"
              priceSuffix=" for 30 days"
              tagline="Try Simulyn risk-free."
              cta="Start free"
              features={[
                "1 active project",
                "Up to 50 tasks",
                "Excel schedule import",
                "AI project brief",
              ]}
            />
            <PriceCard
              name="Pro"
              price="$199"
              priceSuffix=" / project / month"
              tagline="For active construction teams."
              highlighted
              cta="Start trial"
              features={[
                "Unlimited tasks",
                "Unlimited team members",
                "5 what-if scenarios + comparison",
                "Weekly AI recap",
                "Auto-suggested scenarios",
                "AI copilot",
                "Priority support",
              ]}
            />
            <PriceCard
              name="Enterprise"
              price="Custom"
              tagline="For large teams and custom workflows."
              cta="Book a demo"
              href="mailto:hello@simulyn.ai?subject=Enterprise%20demo%20request"
              features={[
                "Multiple projects",
                "SSO / SAML (roadmap)",
                "Custom rule tuning",
                "Audit logs (roadmap)",
                "Dedicated support",
              ]}
            />
          </div>
        </section>

        {/* TRUST & SECURITY */}
        <section>
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
              <Shield className="h-3 w-3" />
              Trust &amp; security
            </span>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Built for enterprise-grade security
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-site-muted">
              Your project data stays private and secure.
            </p>
          </div>
          <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
            <TrustTile
              icon={Shield}
              title="Multi-tenant secure architecture"
              body="Every organization is isolated at the database layer. Requests carry a scoped tenant header; data never crosses organizations."
            />
            <TrustTile
              icon={Lock}
              title="Organization-level data isolation"
              body="Projects, tasks, predictions, simulations, and briefs all belong to an organization — no shared tables, no noisy neighbours."
            />
            <TrustTile
              icon={KeyRound}
              title="Role-based access control"
              body="Four roles — Owner, Admin, Member, Viewer — gate every action. Platform admin capability is separate from org membership."
            />
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="relative overflow-hidden rounded-3xl border border-site-accent/30 bg-gradient-to-br from-site-accent/15 via-site-card to-site-card p-12 text-center">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[600px] -translate-x-1/2 rounded-full bg-site-accent/20 blur-[100px]" />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Stop reacting to delays.{" "}
              <span className="bg-gradient-to-r from-site-accent to-blue-300 bg-clip-text text-transparent">
                Start preventing them.
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-site-muted">
              Simulyn AI helps you stay ahead—every single week.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/register" className={PRIMARY_BTN}>
                Start your free trial
              </Link>
              <a href="#demo" className={SECONDARY_BTN}>
                Book a demo
              </a>
            </div>
            <p className="mt-4 text-xs text-site-muted">
              No credit card required · Setup in under 2 minutes
            </p>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-site-border pt-8">
          <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo-mark.png"
                alt="Simulyn AI"
                width={24}
                height={24}
                className="h-6 w-6 object-contain"
              />
              <span className="text-sm font-semibold text-white">
                Simulyn <span className="text-site-accent">AI</span>
              </span>
            </Link>
            <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-site-muted">
              <a href="#features" className="transition hover:text-white">
                Product
              </a>
              <a href="#pricing" className="transition hover:text-white">
                Pricing
              </a>
              <a
                href="mailto:hello@simulyn.ai"
                className="transition hover:text-white"
              >
                Contact
              </a>
              <Link href="/privacy" className="transition hover:text-white">
                Privacy
              </Link>
              <Link href="/terms" className="transition hover:text-white">
                Terms
              </Link>
            </nav>
          </div>
          <p className="mt-6 text-center text-xs text-site-muted">
            © {new Date().getFullYear()} Simulyn AI. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
}
