"use client";

import { useEffect } from "react";

/**
 * Catches errors thrown in the root layout itself (where the normal error.tsx
 * boundary can't render because the layout is broken). Must include its own
 * <html>/<body> shell. Kept deliberately spartan — no Tailwind utilities here
 * since they may have failed to load.
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
      // eslint-disable-next-line no-console
      console.error("Global error boundary caught:", error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: "48px 16px",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          background: "#0b0f17",
          color: "#e2e8f0",
          minHeight: "100vh",
        }}
      >
        <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
          <div
            style={{
              display: "inline-block",
              background: "rgba(239, 68, 68, 0.15)",
              color: "#fca5a5",
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 500,
              marginBottom: 16,
            }}
          >
            Critical error
          </div>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>
            Simulyn couldn&rsquo;t load
          </h1>
          <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 24 }}>
            Something is broken at the root of the app. Reloading usually fixes
            it. If not, contact support.
          </p>
          {error.digest && (
            <p
              style={{
                fontFamily:
                  'ui-monospace, SFMono-Regular, "SF Mono", monospace',
                fontSize: 12,
                color: "#94a3b8",
                marginBottom: 24,
              }}
            >
              Error reference: <span style={{ color: "#cbd5e1" }}>{error.digest}</span>
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#3b82f6",
              border: "none",
              color: "white",
              padding: "10px 18px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
