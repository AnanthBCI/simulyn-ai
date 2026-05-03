"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

const CONSENT_KEY = "simulyn_cookie_consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const existing = localStorage.getItem(CONSENT_KEY);
    if (!existing) setVisible(true);
  }, []);

  if (!visible) return null;

  function accept() {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ level: "all", at: Date.now() }));
    setVisible(false);
  }

  function essentialOnly() {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ level: "essential", at: Date.now() }),
    );
    setVisible(false);
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-site-border bg-site-card/95 p-4 shadow-2xl backdrop-blur-sm sm:inset-x-auto sm:right-4 sm:max-w-md">
      <button
        type="button"
        onClick={essentialOnly}
        aria-label="Dismiss"
        className="absolute right-3 top-3 rounded-md p-1 text-site-muted hover:bg-white/5 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
      <h2 className="pr-7 text-sm font-semibold text-white">We use cookies</h2>
      <p className="mt-2 text-xs leading-relaxed text-site-muted">
        Simulyn AI uses essential cookies to keep you signed in and a small
        amount of anonymous analytics to understand which features are used.
        No tracking across other sites.{" "}
        <Link
          href="/privacy"
          className="text-site-accent hover:underline"
        >
          Read our privacy policy
        </Link>
        .
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={accept}
          className="rounded-md bg-site-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-600"
        >
          Accept all
        </button>
        <button
          type="button"
          onClick={essentialOnly}
          className="rounded-md border border-site-border px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/5"
        >
          Essential only
        </button>
      </div>
    </div>
  );
}
