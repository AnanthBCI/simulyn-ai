"use client";

import { useEffect } from "react";

const SUFFIX = "Simulyn AI";

/**
 * Sets `document.title` to "<title> · Simulyn AI" while the component is
 * mounted. On unmount the title is left as-is — the next page's hook will
 * overwrite it. Keeps the tab name accurate as the user navigates between
 * client-side routes (Next.js App Router does not auto-update titles for
 * client components).
 */
export function usePageTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!title) {
      document.title = SUFFIX;
      return;
    }
    document.title = `${title} · ${SUFFIX}`;
  }, [title]);
}
