"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@/lib/api";

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params?.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError((err as Error).message || "Reset failed. The link may have expired.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
        Missing reset token. Open the link from your email, or{" "}
        <Link href="/forgot-password" className="underline">
          request a new one
        </Link>
        .
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
        Password updated. Redirecting to sign in…
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-site-muted">
          New password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="w-full rounded-lg border border-site-border bg-site-bg px-3 py-2 text-sm text-white focus:border-site-accent focus:outline-none"
          placeholder="At least 8 characters"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-site-muted">
          Confirm password
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          className="w-full rounded-lg border border-site-border bg-site-bg px-3 py-2 text-sm text-white focus:border-site-accent focus:outline-none"
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
        {submitting ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-site-border bg-site-card p-8">
        <h1 className="text-2xl font-semibold text-white">Choose a new password</h1>
        <p className="mt-2 text-sm text-site-muted">
          Your reset link is valid for 1 hour from the moment it was sent.
        </p>
        <div className="mt-6">
          <Suspense fallback={<div className="text-sm text-site-muted">Loading…</div>}>
            <ResetPasswordInner />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
