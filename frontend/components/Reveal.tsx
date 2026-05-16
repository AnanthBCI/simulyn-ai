"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useInView } from "@/hooks/useInView";

/**
 * Scroll-triggered fade-in + slide-up wrapper for landing-page sections.
 *
 * SSR-safe: server-rendered markup carries no reveal class, so users without
 * JavaScript (and crawlers) always see fully-visible content. After hydration
 * — and only when `prefers-reduced-motion` is *not* set — the wrapper hides
 * itself and reveals as soon as it scrolls into view.
 *
 * Above-fold sections may briefly flicker (visible → hidden → visible in
 * roughly one paint frame). The trade-off is worth it because every other
 * approach either breaks SSR, breaks no-JS, or requires a large animation
 * dependency. CSS-only, ~25 lines, zero runtime cost beyond a single
 * IntersectionObserver per section.
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Optional stagger delay in ms (use sparingly — small values feel natural). */
  delay?: number;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mq?.matches) return;
    setActive(true);
  }, []);

  const motionClasses = active
    ? `transition-all duration-700 ease-out will-change-[opacity,transform] ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`
    : "";

  return (
    <div
      ref={ref}
      className={`${motionClasses} ${className}`.trim()}
      style={delay && active ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
