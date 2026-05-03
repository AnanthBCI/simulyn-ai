"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Loader2, AlertTriangle } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Spinner                                                                   */
/* -------------------------------------------------------------------------- */

export function Spinner({
  size = "md",
  className = "",
  label = "Loading",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}) {
  const sizeClass =
    size === "sm" ? "h-4 w-4" : size === "lg" ? "h-8 w-8" : "h-5 w-5";
  return (
    <Loader2
      role="status"
      aria-label={label}
      className={`animate-spin ${sizeClass} ${className}`}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Inline page-level loading                                                 */
/* -------------------------------------------------------------------------- */

export function PageLoader({ message = "Loading…" }: { message?: string }) {
  return (
    <div
      role="status"
      className="flex items-center gap-3 py-12 text-sm text-site-muted"
    >
      <Spinner size="md" />
      <span>{message}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Skeleton primitives                                                       */
/* -------------------------------------------------------------------------- */

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-white/10 ${className}`}
      aria-hidden
    />
  );
}

export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}

export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-site-border bg-site-card p-5 shadow-card ${className}`}
      aria-hidden
    >
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="mt-3 h-6 w-1/2" />
      <Skeleton className="mt-2 h-3 w-1/3" />
    </div>
  );
}

export function TableSkeleton({
  rows = 5,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-site-border bg-site-card shadow-card"
      aria-hidden
    >
      <div className="divide-y divide-site-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className={`grid gap-3 px-4 py-3`}
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-3" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  EmptyState                                                                */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className = "",
}: {
  Icon?: LucideIcon;
  title: string;
  description?: string;
  primaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
    disabled?: boolean;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
    disabled?: boolean;
  };
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-site-border bg-site-card p-10 text-center shadow-card ${className}`}
    >
      {Icon && (
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-site-accent/10 text-site-accent ring-1 ring-site-accent/30">
          <Icon className="h-6 w-6" aria-hidden />
        </div>
      )}
      <p className={`text-base font-medium text-white ${Icon ? "mt-4" : ""}`}>
        {title}
      </p>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm text-site-muted">
          {description}
        </p>
      )}
      {(primaryAction || secondaryAction) && (
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {primaryAction && <ActionButton {...primaryAction} primary />}
          {secondaryAction && <ActionButton {...secondaryAction} />}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  label,
  href,
  onClick,
  disabled,
  primary,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const cls = primary
    ? "rounded-md bg-site-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 disabled:opacity-50"
    : "rounded-md border border-site-border bg-site-card px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 disabled:opacity-50";
  if (href && !disabled) {
    return (
      <Link href={href} className={cls}>
        {label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  ErrorBanner — for inline page-load failures (not toasts)                  */
/* -------------------------------------------------------------------------- */

export function ErrorBanner({
  message,
  onRetry,
  className = "",
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300 ${className}`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
      <span className="flex-1 leading-snug">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-red-500/40 bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-200 transition hover:bg-red-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
        >
          Retry
        </button>
      )}
    </div>
  );
}
