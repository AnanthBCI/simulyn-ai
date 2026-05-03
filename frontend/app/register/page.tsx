"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, setActiveOrgId, setToken, type InvitePreview } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/primitives";
import { usePageTitle } from "@/hooks/usePageTitle";

type FieldErrors = Partial<Record<"name" | "email" | "password", string>>;

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function RegisterInner() {
  usePageTitle("Create account");
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const inviteToken = searchParams?.get("token") ?? null;
  const prefilledEmail = searchParams?.get("email") ?? null;
  const [name, setName] = useState("");
  const [email, setEmail] = useState(prefilledEmail ?? "");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteToken) return;
    let cancelled = false;
    api
      .invitePreview(inviteToken)
      .then((preview) => {
        if (cancelled) return;
        setInvite(preview);
        if (preview.email) setEmail(preview.email);
      })
      .catch((err) => {
        if (cancelled) return;
        setInviteError(
          (err as Error).message ||
            "This invite is invalid or has expired. You can still register normally.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  const passwordHint = passwordStrength(password);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = "Please tell us your name.";
    else if (name.trim().length < 2) next.name = "Name is too short.";
    if (!email.trim()) next.email = "Email is required.";
    else if (!isValidEmail(email)) next.email = "Enter a valid email address.";
    if (!password) next.password = "Choose a password.";
    else if (password.length < 6)
      next.password = "Password must be at least 6 characters.";
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
      const res = await api.register(
        name.trim(),
        email.trim(),
        password,
        inviteToken ?? undefined,
      );
      setToken(res.token);
      try {
        const orgs = await api.myOrganizations();
        // If this was an invite flow, prefer the inviting org as active.
        const preferred = invite
          ? orgs.find((o) => o.name === invite.organizationName)
          : undefined;
        if (preferred) setActiveOrgId(preferred.id);
        else if (orgs[0]) setActiveOrgId(orgs[0].id);
      } catch {
        /* ignore */
      }
      toast.success(
        invite
          ? `Welcome! You're now part of ${invite.organizationName}.`
          : "Account created. Welcome to Simulyn AI!",
        { duration: 5000 },
      );
      router.push("/dashboard");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Registration failed";
      setFormError(friendlyRegisterError(raw));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-site-border bg-site-card p-8 shadow-card">
        <Link
          href="/"
          className="flex items-center justify-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-site-bg"
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
        <h1 className="mt-6 text-center text-2xl font-semibold text-white">
          {invite ? "Accept your invite" : "Create account"}
        </h1>
        <p className="mt-1 text-center text-sm text-site-muted">
          {invite
            ? `You're joining ${invite.organizationName} as ${invite.role}.`
            : "30 days free. No credit card. Bring your schedule."}
        </p>
        {inviteError && (
          <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            {inviteError}
          </div>
        )}
        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <Field
            label="Name"
            error={errors.name}
            errorId="reg-name-err"
            input={
              <input
                className={inputClass(!!errors.name)}
                autoComplete="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
                }}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "reg-name-err" : undefined}
                required
              />
            }
          />
          <Field
            label="Email"
            error={errors.email}
            errorId="reg-email-err"
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
                aria-describedby={errors.email ? "reg-email-err" : undefined}
                required
              />
            }
          />
          <Field
            label="Password"
            error={errors.password}
            errorId="reg-pw-err"
            hint={
              password
                ? `Strength: ${passwordHint.label}`
                : "At least 6 characters."
            }
            hintTone={passwordHint.tone}
            input={
              <input
                className={inputClass(!!errors.password)}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password)
                    setErrors((p) => ({ ...p, password: undefined }));
                }}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "reg-pw-err" : "reg-pw-hint"}
                minLength={6}
                required
              />
            }
          />

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
            {loading ? "Creating…" : "Register"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-site-muted">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-site-accent hover:underline focus-visible:outline-none focus-visible:underline"
          >
            Sign in
          </Link>
        </p>
        <p className="mt-4 text-center text-[11px] text-site-muted">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="underline hover:text-white">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-white">
            Privacy policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-site-muted">Loading…</div>}>
      <RegisterInner />
    </Suspense>
  );
}

function Field({
  label,
  input,
  error,
  errorId,
  hint,
  hintTone = "muted",
}: {
  label: string;
  input: React.ReactNode;
  error?: string;
  errorId?: string;
  hint?: string;
  hintTone?: "muted" | "good" | "warn" | "danger";
}) {
  const hintCls =
    hintTone === "good"
      ? "text-emerald-400"
      : hintTone === "warn"
        ? "text-amber-400"
        : hintTone === "danger"
          ? "text-red-400"
          : "text-site-muted";
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300">{label}</label>
      <div className="mt-1">{input}</div>
      {error ? (
        <p id={errorId} className="mt-1 text-xs text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id="reg-pw-hint" className={`mt-1 text-xs ${hintCls}`}>
          {hint}
        </p>
      ) : null}
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

function passwordStrength(pw: string): {
  label: string;
  tone: "muted" | "warn" | "good";
} {
  if (pw.length < 6) return { label: "too short", tone: "warn" };
  let score = 0;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score >= 3) return { label: "strong", tone: "good" };
  if (score >= 1) return { label: "okay", tone: "warn" };
  return { label: "weak", tone: "warn" };
}

function friendlyRegisterError(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg.includes("already") || msg.includes("exists") || msg.includes("duplicate")) {
    return "An account with that email already exists. Try signing in instead.";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  return raw.length > 140 ? "Registration failed. Please try again." : raw;
}
