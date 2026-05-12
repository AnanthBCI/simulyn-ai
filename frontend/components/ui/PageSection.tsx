"use client";

import { useId } from "react";

/**
 * Groups dashboard / list content under a consistent heading so scans flow
 * top → bottom: eyebrow (optional), title, description, optional actions, body.
 */
export function PageSection({
  eyebrow,
  title,
  description,
  actions,
  children,
  className = "",
  sectionId,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Optional stable id for deep links / landmarks (heading id is derived). */
  sectionId?: string;
}) {
  const uid = useId();
  const headingId = `${uid}-heading`;
  return (
    <section id={sectionId} className={`space-y-4 ${className}`} aria-labelledby={headingId}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-site-muted">
              {eyebrow}
            </p>
          )}
          <h2
            id={headingId}
            className={`font-semibold text-white ${eyebrow ? "mt-1" : ""} text-lg sm:text-xl`}
          >
            {title}
          </h2>
          {description && (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-site-muted">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
