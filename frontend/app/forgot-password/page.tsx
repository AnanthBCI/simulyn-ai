"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-site-border bg-site-card p-8">
        <h1 className="text-2xl font-semibold text-white">Reset your password</h1>
        <p className="mt-2 text-sm text-site-muted">
          Enter the email you registered with. If it matches an account, we&apos;ll
          send a reset link valid for 1 hour.
        </p>
        {sent ? (
          <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            If an account exists for <strong>{email}</strong>, a reset link is on its
            way. Check your inbox (and spam).
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-site-muted">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-site-border bg-site-bg px-3 py-2 text-sm text-white focus:border-site-accent focus:outline-none"
                placeholder="you@company.com"
              />
            </div>
            {error && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-site-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-xs text-site-muted">
          Remembered it?{" "}
          <Link href="/login" className="text-site-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
