"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui/primitives";
import { usePageTitle } from "@/hooks/usePageTitle";

type FieldErrors = Partial<Record<"password" | "confirm", string>>;

function ResetPasswordInner() {
  usePageTitle("Reset password");
  const router = useRouter();
  const params = useSearchParams();
  const token = params?.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Cancel the auto-redirect if the component unmounts (user navigates away
  // between success + the 2s timeout).
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!password) next.password = "Choose a new password.";
    else if (password.length < 8)
      next.password = "Password must be at least 8 characters.";
    if (!confirm) next.confirm = "Confirm your password.";
    else if (password && confirm && password !== confirm)
      next.confirm = "Passwords don't match.";
    return next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const fieldErrors = validate();
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setSubmitting(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      redirectTimer.current = setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Reset failed.";
      setFormError(friendlyResetError(raw));
    } finally {
      setSubmitting(false);
    }
  }

  // Token-missing state takes over the whole card so users don't read the
  // welcoming "Choose a new password" copy and then get confused by the error.
  if (!token) {
    return (
      <AuthCard title="Reset link missing or invalid">
        <div
          role="alert"
          className="mt-6 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"
        >
          We couldn&apos;t find a reset token in your link. Open the link from
          your email again, or{" "}
          <Link
            href="/forgot-password"
            className="underline hover:text-white focus-visible:outline-none focus-visible:text-white"
          >
            request a new one
          </Link>
          .
        </div>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Password updated">
        <div
          role="status"
          className="mt-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300"
        >
          Your password has been updated. Redirecting you to sign in…
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      subtitle="Your reset link is valid for 1 hour from the moment it was sent."
    >
      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <div>
          <label
            htmlFor="reset-password"
            className="block text-sm font-medium text-slate-300"
          >
            New password
          </label>
          <div className="mt-1">
            <input
              id="reset-password"
              className={inputClass(!!errors.password)}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
              }}
              aria-invalid={!!errors.password}
              aria-describedby={
                errors.password ? "reset-pw-err" : "reset-pw-hint"
              }
              minLength={8}
              required
            />
          </div>
          {errors.password ? (
            <p id="reset-pw-err" className="mt-1 text-xs text-red-400">
              {errors.password}
            </p>
          ) : (
            <p id="reset-pw-hint" className="mt-1 text-xs text-site-muted">
              At least 8 characters.
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="reset-confirm"
            className="block text-sm font-medium text-slate-300"
          >
            Confirm password
          </label>
          <div className="mt-1">
            <input
              id="reset-confirm"
              className={inputClass(!!errors.confirm)}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (errors.confirm) setErrors((p) => ({ ...p, confirm: undefined }));
              }}
              aria-invalid={!!errors.confirm}
              aria-describedby={errors.confirm ? "reset-confirm-err" : undefined}
              minLength={8}
              required
            />
          </div>
          {errors.confirm && (
            <p id="reset-confirm-err" className="mt-1 text-xs text-red-400">
              {errors.confirm}
            </p>
          )}
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
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-site-accent py-2 font-medium text-white transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-site-card disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <Spinner size="sm" />}
          {submitting ? "Updating…" : "Update password"}
        </button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-8 text-sm text-site-muted">
          Loading…
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}

// Shared card chrome — matches login/register so the auth flow feels unified.
function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
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
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-center text-sm text-site-muted">{subtitle}</p>
        )}
        {children}
        <p className="mt-6 text-center text-sm text-site-muted">
          Remembered it?{" "}
          <Link
            href="/login"
            className="text-site-accent hover:underline focus-visible:outline-none focus-visible:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
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

function friendlyResetError(raw: string): string {
  const msg = raw.toLowerCase();
  if (
    msg.includes("expired") ||
    msg.includes("invalid token") ||
    msg.includes("not found")
  ) {
    return "This reset link is invalid or has expired. Request a new one.";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  if (msg.includes("too short") || msg.includes("8 chars")) {
    return "Password must be at least 8 characters.";
  }
  return raw.length > 140 ? "Reset failed. Please try again." : raw;
}
