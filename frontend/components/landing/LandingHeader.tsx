import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Globe } from "lucide-react";

const NAV = [
  { label: "Product", href: "#features" },
  { label: "Platform", href: "#demo" },
  { label: "Pricing", href: "#pricing" },
] as const;

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#060a14]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 lg:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Image
            src="/logo-mark.png"
            alt="Simulyn AI"
            width={32}
            height={32}
            priority
            className="h-8 w-8 object-contain"
          />
          <span className="text-base font-semibold tracking-tight text-white">
            Simulyn <span className="text-site-accent">AI</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="group inline-flex items-center gap-0.5 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              {label}
              <ChevronDown
                className="h-3.5 w-3.5 opacity-40 transition group-hover:opacity-70"
                aria-hidden
              />
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-400 lg:inline-flex">
            <Globe className="h-3.5 w-3.5" aria-hidden />
            EN
          </span>
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-site-accent px-4 py-2 text-sm font-medium text-white shadow-[0_0_20px_rgba(59,130,246,0.35)] transition hover:bg-blue-500"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
