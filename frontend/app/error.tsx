"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Default error boundary for the app/ tree. Renders when a server component
 * throws or a client component throws during render. We intentionally keep it
 * minimal — production users see a friendly card; the trace id (when the API
 * sent one) is surfaced so support can correlate against backend logs.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
      // Mirror to the browser console in dev so the stack is one click away.
      // eslint-disable-next-line no-console
      console.error("App error boundary caught:", error);
    }
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <div className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300">
        Something went wrong
      </div>
      <h1 className="text-2xl font-semibold text-white">
        We hit an unexpected error
      </h1>
      <p className="text-sm text-site-muted">
        The team has been notified. You can retry the action, head back to the
        dashboard, or contact support if it keeps happening.
      </p>
      {error.digest && (
        <p className="rounded-md border border-site-border bg-site-card/60 px-3 py-2 font-mono text-xs text-site-muted">
          Error reference: <span className="text-slate-200">{error.digest}</span>
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-site-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded-md border border-site-border bg-site-card px-4 py-2 text-sm font-medium text-white transition hover:bg-white/5"
        >
          Back to dashboard
        </Link>
        <a
          href="mailto:hello@simulyn.ai?subject=Simulyn%20error%20report"
          className="text-sm text-site-muted transition hover:text-white"
        >
          Contact support
        </a>
      </div>
    </div>
  );
}
