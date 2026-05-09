import Link from "next/link";

/**
 * Renders for any unmatched route under app/. Friendly explanation + obvious
 * recovery paths beat the default Next.js 404 — especially since users may
 * land here from a stale email link (invite token reused, password reset
 * already consumed, etc.).
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <p className="rounded-full bg-site-accent/15 px-3 py-1 text-xs font-medium text-site-accent">
        404
      </p>
      <h1 className="text-2xl font-semibold text-white">Page not found</h1>
      <p className="text-sm text-site-muted">
        The page you&rsquo;re looking for doesn&rsquo;t exist or has been moved.
        If you followed a link from an email, it may have expired.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/dashboard"
          className="rounded-md bg-site-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
        >
          Go to dashboard
        </Link>
        <Link
          href="/"
          className="rounded-md border border-site-border bg-site-card px-4 py-2 text-sm font-medium text-white transition hover:bg-white/5"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
