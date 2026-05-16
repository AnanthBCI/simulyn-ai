"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui/primitives";
import { usePageTitle } from "@/hooks/usePageTitle";

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export default function ForgotPasswordPage() {
  usePageTitle("Forgot password");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError("Email is required.");
      return;
    }
    if (!isValidEmail(trimmed)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError(undefined);

    setSubmitting(true);
    try {
      await api.requestPasswordReset(trimmed);
      setSent(true);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Something went wrong.";
      setFormError(friendlyResetError(raw));
    } finally {
      setSubmitting(false);
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
          Reset your password
        </h1>
        <p className="mt-1 text-center text-sm text-site-muted">
          Enter the email you registered with. If it matches an account, we&apos;ll
          send a reset link valid for 1 hour.
        </p>

        {sent ? (
          <div
            role="status"
            className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300"
          >
            If an account exists for <strong>{email.trim()}</strong>, a reset link
            is on its way. Check your inbox (and spam).
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label
                htmlFor="forgot-email"
                className="block text-sm font-medium text-slate-300"
              >
                Email
              </label>
              <div className="mt-1">
                <input
                  id="forgot-email"
                  className={inputClass(!!emailError)}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(undefined);
                  }}
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? "forgot-email-err" : undefined}
                  placeholder="you@company.com"
                  required
                />
              </div>
              {emailError && (
                <p id="forgot-email-err" className="mt-1 text-xs text-red-400">
                  {emailError}
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
              {submitting ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

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
  if (msg.includes("network") || msg.includes("fetch")) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  if (msg.includes("rate") || msg.includes("too many")) {
    return "Too many requests. Please wait a moment and try again.";
  }
  return raw.length > 140 ? "Couldn't send the reset link. Please try again." : raw;
}
