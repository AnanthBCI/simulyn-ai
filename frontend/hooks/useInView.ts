"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Returns a ref to attach to an element + a boolean that flips to true the
 * first time the element scrolls into the viewport.
 *
 * Used on the landing page to fade sections in as the user scrolls. The
 * observer disconnects after the first match so we don't pay for further
 * intersection callbacks once the reveal is done.
 *
 * Honours `prefers-reduced-motion`: returns `inView=true` immediately so the
 * caller's CSS reveal transition becomes a no-op for motion-sensitive users.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(
  options?: { rootMargin?: string; threshold?: number },
): { ref: React.RefObject<T>; inView: boolean } {
  const ref = useRef<T>(null!) as React.RefObject<T>;
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Skip the observer entirely for users with reduced-motion preference —
    // they get the fully-revealed state immediately on mount.
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mq?.matches) {
      setInView(true);
      return;
    }

    // Bail out if IntersectionObserver isn't available (very old browsers,
    // jsdom in tests). Falling back to "already visible" matches reduced-
    // motion behaviour and keeps the page usable.
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      {
        rootMargin: options?.rootMargin ?? "0px 0px -10% 0px",
        threshold: options?.threshold ?? 0.1,
      },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [options?.rootMargin, options?.threshold]);

  return { ref, inView };
}
