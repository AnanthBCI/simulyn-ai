import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  KeyRound,
  Lock,
  Play,
  Shield,
  Zap,
} from "lucide-react";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { HeroDashboardPreview } from "@/components/landing/HeroDashboardPreview";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { LandingDemo } from "@/components/landing/LandingDemo";
import { Reveal } from "@/components/Reveal";

export const metadata = {
  title: "Simulyn AI — Predict delays. Reduce risks.",
  description:
    "The construction risk co-pilot. Deterministic risk scores, AI health briefs, weekly look-ahead, and what-if simulation — side by side.",
};

const PRIMARY_BTN =
  "inline-flex items-center gap-2 rounded-lg bg-site-accent px-5 py-3 text-sm font-medium text-white shadow-[0_0_24px_rgba(59,130,246,0.45)] transition hover:bg-blue-500 hover:shadow-[0_0_32px_rgba(59,130,246,0.55)]";

const GHOST_BTN =
  "inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-5 py-3 text-sm font-medium text-white backdrop-blur-sm transition hover:border-white/30 hover:bg-white/10";

const ROLES = [
  "General Contractors",
  "Project Managers",
  "Planning Engineers",
  "Commercial Builders",
  "EPC Contractors",
  "Civil & Infrastructure",
] as const;

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
  href?: string;
}) {
  const ctaHref = href ?? `/register?plan=${encodeURIComponent(name)}`;
  const isExternal =
    ctaHref.startsWith("mailto:") || ctaHref.startsWith("http");
  const ctaClass = `mt-6 block rounded-lg px-4 py-2.5 text-center text-sm font-medium transition ${
    highlighted
      ? "bg-site-accent text-white hover:bg-blue-500"
      : "border border-white/10 text-white hover:border-site-accent/40 hover:bg-white/5"
  }`;
  return (
    <div
      className={`flex flex-col rounded-2xl border p-6 ${
        highlighted
          ? "border-site-accent/50 bg-gradient-to-b from-site-accent/10 to-[#111827] shadow-[0_0_40px_-12px_rgba(59,130,246,0.4)]"
          : "border-white/[0.08] bg-[#111827]"
      }`}
    >
      {highlighted && (
        <span className="mb-3 w-fit rounded-full bg-site-accent/15 px-3 py-1 text-xs font-medium text-site-accent">
          Most popular
        </span>
      )}
      <h3 className="text-lg font-semibold text-white">{name}</h3>
      <p className="text-sm text-slate-400">{tagline}</p>
      <p className="mt-4 flex items-baseline gap-1 text-3xl font-bold text-white">
        {price}
        {priceSuffix && (
          <span className="text-sm font-normal text-slate-400">
            {priceSuffix}
          </span>
        )}
      </p>
      <ul className="mt-6 flex-1 space-y-2 text-sm text-slate-300">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-site-accent" />
            {f}
          </li>
        ))}
      </ul>
      {isExternal ? (
        <a href={ctaHref} className={ctaClass}>
          {cta}
        </a>
      ) : (
        <Link href={ctaHref} className={ctaClass}>
          {cta}
        </Link>
      )}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#060a14] text-slate-100">
      <LandingHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="pointer-events-none absolute inset-0">
          <Image
            src="/hero-construction.png"
            alt=""
            fill
            priority
            quality={90}
            unoptimized
            className="object-cover object-center opacity-40"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#060a14] via-[#060a14]/90 to-[#060a14]/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#060a14] via-transparent to-[#060a14]/60" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-10 lg:px-6 lg:pb-20 lg:pt-14">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-site-accent/30 bg-site-accent/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-site-accent">
                <span className="text-site-accent">+</span> AI copilot for
                construction
              </span>
              <h1 className="mt-5 text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]">
                Predict delays. Reduce risks.{" "}
                <span className="bg-gradient-to-r from-blue-400 via-site-accent to-violet-400 bg-clip-text text-transparent">
                  Deliver with confidence.
                </span>
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-slate-300">
                Simulyn is the construction risk co-pilot — deterministic
                scores, AI narratives, and what-if simulation so you walk into
                every site meeting prepared.
              </p>
              <p className="mt-3 text-sm text-slate-500">
                Spot delays before they happen. Understand why. Stress-test the
                plan before it costs you weeks.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register" className={PRIMARY_BTN}>
                  Start 30-day free trial
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <a href="#demo" className={GHOST_BTN}>
                  <Play className="h-4 w-4 fill-current" aria-hidden />
                  See it in action
                </a>
              </div>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-site-accent" />
                  No credit card required
                </li>
                <li className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-site-accent" />
                  Results in under 60 seconds
                </li>
                <li className="flex items-center gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-site-accent" />
                  Excel schedule import
                </li>
              </ul>
            </div>
            <HeroDashboardPreview />
          </div>
        </div>
      </section>

      {/* Trust — roles, not fictional customer logos */}
      <section className="border-b border-white/[0.06] bg-[#0a0f1c]/80 py-8">
        <div className="mx-auto max-w-7xl px-4 text-center lg:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Built for modern construction teams
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {ROLES.map((role) => (
              <span
                key={role}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-medium text-slate-400"
              >
                {role}
              </span>
            ))}
          </div>
        </div>
      </section>

      <FeatureGrid />
      <LandingDemo />

      {/* Pricing */}
      <section
        id="pricing"
        className="scroll-mt-24 border-t border-white/[0.06] py-20"
      >
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Simple, project-based pricing
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-400">
              Pay per active project — invite your whole team at no extra cost.
            </p>
          </div>
          <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-3">
            <PriceCard
              name="Starter"
              price="Free"
              priceSuffix=" for 30 days"
              tagline="Try Simulyn risk-free."
              cta="Start free"
              features={[
                "1 active project",
                "Up to 50 tasks",
                "Excel import",
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
                "Unlimited tasks & members",
                "5 what-if scenarios + compare",
                "Weekly AI recap",
                "Ask Simulyn copilot",
                "Auto-suggest scenarios",
              ]}
            />
            <PriceCard
              name="Enterprise"
              price="Custom"
              tagline="Large teams & custom workflows."
              cta="Book a demo"
              href="mailto:hello@simulyn.ai?subject=Enterprise%20demo"
              features={[
                "Multiple projects",
                "SSO / SAML (roadmap)",
                "Custom rule tuning",
                "Dedicated support",
              ]}
            />
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="border-t border-white/[0.06] bg-[#0a0f1c] py-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white">
              Secure. Compliant-ready. Reliable.
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Multi-tenant from day one — your data never crosses organizations.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Shield,
                title: "Multi-tenant architecture",
                body: "Every org isolated at the database layer with scoped API headers.",
              },
              {
                icon: Lock,
                title: "Organization isolation",
                body: "Projects, predictions, and briefs belong to one tenant only.",
              },
              {
                icon: KeyRound,
                title: "Role-based access",
                body: "Owner, Admin, Member, Viewer — gates on every mutation.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-xl border border-white/[0.08] bg-[#111827] p-5"
              >
                <Icon className="h-5 w-5 text-emerald-400" aria-hidden />
                <h3 className="mt-3 text-sm font-semibold text-white">
                  {title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-white/[0.06] bg-[#0a0f1c]/40 py-16">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 text-center sm:grid-cols-5 lg:px-6">
          {[
            { value: "5", label: "What-if scenario types" },
            { value: "8", label: "Scenarios to compare" },
            { value: "100%", label: "Transparent math" },
            { value: "4", label: "Org roles (RBAC)" },
            { value: "12h", label: "AI brief cache" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-4xl font-bold text-site-accent sm:text-5xl">
                {s.value}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-400">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-8 lg:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-site-accent/25 bg-gradient-to-br from-site-accent/15 via-[#111827] to-[#0a0f1c] px-6 py-12 text-center sm:px-12">
            <div className="pointer-events-none absolute -top-20 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-site-accent/20 blur-[80px]" />
            <h2 className="relative text-3xl font-bold text-white">
              Stop reacting to delays.{" "}
              <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                Start preventing them.
              </span>
            </h2>
            <p className="relative mx-auto mt-3 max-w-lg text-slate-400">
              Load a sample project and see predictions, briefs, and simulations
              in under a minute.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/register" className={PRIMARY_BTN}>
                Start your free trial
              </Link>
              <a href="#demo" className={GHOST_BTN}>
                See it in action
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-white/[0.06] py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row lg:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo-mark.png"
              alt=""
              width={24}
              height={24}
              className="h-6 w-6"
            />
            <span className="text-sm font-semibold text-white">
              Simulyn <span className="text-site-accent">AI</span>
            </span>
          </Link>
          <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-500">
            <a href="#features" className="hover:text-white">
              Product
            </a>
            <a href="#pricing" className="hover:text-white">
              Pricing
            </a>
            <a href="mailto:hello@simulyn.ai" className="hover:text-white">
              Contact
            </a>
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
          </nav>
        </div>
        <p className="mt-6 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} Simulyn AI. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
