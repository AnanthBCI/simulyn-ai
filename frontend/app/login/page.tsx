"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api, setActiveOrgId, setToken } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/primitives";
import { usePageTitle } from "@/hooks/usePageTitle";

type FieldErrors = Partial<Record<"email" | "password", string>>;

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function LoginInner() {
  usePageTitle("Sign in");
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  // ?next= preserves where the user was when their session expired so we can
  // bounce them right back after login. Sanitised to internal paths only.
  const rawNext = searchParams?.get("next") ?? null;
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!email.trim()) next.email = "Email is required.";
    else if (!isValidEmail(email)) next.email = "Enter a valid email address.";
    if (!password) next.password = "Password is required.";
    return next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const fieldErrors = validate();
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setLoading(true);
    try {
      const res = await api.login(email.trim(), password);
      setToken(res.token);
      try {
        const orgs = await api.myOrganizations();
        if (orgs[0]) setActiveOrgId(orgs[0].id);
      } catch {
        /* ignore — first dashboard load will handle */
      }
      toast.success(`Welcome back, ${res.name.split(" ")[0] || "there"}.`);
      router.push(next ?? "/dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setFormError(friendlyAuthError(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-site-border bg-site-card p-8 shadow-card">
        <Link
          href="/"
          className="flex items-center justify-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-site-bg rounded-md"
          aria-label="Simulyn AI — Home"
        >
          <Image
            src="/logo-mark.png"
            alt=""
            width={40}
            height={40}
            priority
            className="h-10 w-10 object-contain"
          />
          <span className="text-xl font-semibold tracking-tight text-white">
            Simulyn <span className="text-site-accent">AI</span>
          </span>
        </Link>
        <h1 className="mt-6 text-center text-2xl font-semibold text-white">Sign in</h1>
        <p className="mt-1 text-center text-sm text-site-muted">
          Welcome back. Let&apos;s see what&apos;s slipping.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <Field
            label="Email"
            error={errors.email}
            input={
              <input
                className={inputClass(!!errors.email)}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                }}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "login-email-err" : undefined}
                required
              />
            }
            errorId="login-email-err"
          />
          <Field
            label="Password"
            error={errors.password}
            input={
              <input
                className={inputClass(!!errors.password)}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password)
                    setErrors((p) => ({ ...p, password: undefined }));
                }}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "login-pw-err" : undefined}
                required
              />
            }
            errorId="login-pw-err"
          />
          <div className="text-right text-xs">
            <Link
              href="/forgot-password"
              className="text-site-muted hover:text-site-accent focus-visible:outline-none focus-visible:underline"
            >
              Forgot password?
            </Link>
          </div>

          {formError && (
            <p
              role="alert"
              className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
            >
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-site-accent py-2 font-medium text-white transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-site-card disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Spinner size="sm" />}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-site-muted">
          No account?{" "}
          <Link
            href="/register"
            className="text-site-accent hover:underline focus-visible:outline-none focus-visible:underline"
          >
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-site-muted">Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}

function Field({
  label,
  input,
  error,
  errorId,
}: {
  label: string;
  input: React.ReactNode;
  error?: string;
  errorId?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300">{label}</label>
      <div className="mt-1">{input}</div>
      {error && (
        <p id={errorId} className="mt-1 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

function inputClass(hasError: boolean): string {
  const base =
    "w-full rounded-md border bg-site-bg px-3 py-2 text-white outline-none transition focus:ring-2";
  return hasError
    ? `${base} border-red-500/60 focus:border-red-500 focus:ring-red-500/30`
    : `${base} border-site-border focus:border-site-accent focus:ring-site-accent/20`;
}

function friendlyAuthError(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg.includes("invalid") || msg.includes("unauthor") || msg.includes("not found")) {
    return "Email or password is incorrect.";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  // Server returned plain JSON or a long stack — keep it short.
  return raw.length > 140 ? "Sign in failed. Please try again." : raw;
}
