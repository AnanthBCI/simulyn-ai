"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { DayPicker, type ClassNames } from "react-day-picker";
import "react-day-picker/style.css";

/**
 * Convert a `YYYY-MM-DD` ISO date string into a `Date` (in local time so the
 * displayed day matches what the user picked).
 */
function parseISO(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Render a `Date` as `YYYY-MM-DD` (local). */
function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplay(date: Date | undefined): string {
  if (!date) return "";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* react-day-picker v9 uses className tokens. We map them onto our dark theme. */
const calendarClassNames: Partial<ClassNames> = {
  root: "rdp-root text-sm",
  months: "flex flex-col gap-3",
  month: "space-y-2",
  month_caption: "flex items-center justify-center pt-1 relative",
  caption_label: "text-sm font-semibold text-white",
  nav: "flex items-center gap-1",
  button_previous:
    "absolute left-1 grid h-7 w-7 place-items-center rounded-md text-site-muted transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40",
  button_next:
    "absolute right-1 grid h-7 w-7 place-items-center rounded-md text-site-muted transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40",
  month_grid: "w-full border-collapse",
  weekdays: "flex",
  weekday:
    "w-9 text-center text-[10px] font-medium uppercase tracking-wider text-site-muted",
  week: "flex w-full mt-1",
  day: "h-9 w-9 p-0 text-center",
  day_button:
    "h-9 w-9 rounded-md text-sm text-slate-200 transition hover:bg-site-accent/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40",
  selected:
    "[&_button]:bg-site-accent [&_button]:text-white [&_button]:hover:bg-blue-600",
  today: "[&_button]:ring-1 [&_button]:ring-site-accent/50",
  outside: "[&_button]:text-site-border",
  disabled: "[&_button]:cursor-not-allowed [&_button]:opacity-30",
  hidden: "invisible",
};

export type DateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** ISO `YYYY-MM-DD`, inclusive */
  min?: string;
  /** ISO `YYYY-MM-DD`, inclusive */
  max?: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  placeholder?: string;
  /** Controls the visible width of the trigger; defaults to "w-full" */
  className?: string;
  id?: string;
  /** ARIA describedby for inline error text */
  describedBy?: string;
  /** ARIA label when no visible label exists */
  ariaLabel?: string;
};

export function DateField({
  value,
  onChange,
  min,
  max,
  disabled,
  required,
  invalid,
  placeholder = "Pick a date",
  className = "w-full",
  id,
  describedBy,
  ariaLabel,
}: DateFieldProps) {
  const reactId = useId();
  const fieldId = id ?? reactId;
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const selected = useMemo(() => parseISO(value), [value]);
  const minDate = useMemo(() => parseISO(min), [min]);
  const maxDate = useMemo(() => parseISO(max), [max]);

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const target = e.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setOpen(false);
  }

  function pick(date: Date | undefined) {
    if (!date) return;
    onChange(toISO(date));
    setOpen(false);
    // Return focus to the trigger so keyboard flow continues.
    triggerRef.current?.focus();
  }

  const triggerCls = [
    "flex w-full items-center justify-between gap-2 rounded-md border bg-site-bg px-3 py-2 text-left text-sm outline-none transition focus-visible:ring-2",
    invalid
      ? "border-red-500/60 focus-visible:border-red-500 focus-visible:ring-red-500/30"
      : "border-site-border focus-visible:border-site-accent focus-visible:ring-site-accent/30",
    disabled ? "cursor-not-allowed opacity-60" : "hover:border-site-accent/50",
    selected ? "text-white" : "text-site-muted",
    className,
  ].join(" ");

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        id={fieldId}
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={describedBy}
        aria-label={ariaLabel}
        data-invalid={invalid || undefined}
        data-required={required || undefined}
        className={triggerCls}
      >
        <span className="flex items-center gap-2 truncate">
          <CalendarIcon className="h-4 w-4 shrink-0 text-site-muted" aria-hidden />
          {selected ? formatDisplay(selected) : placeholder}
        </span>
        {selected && !disabled && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear date"
            className="rounded p-0.5 text-site-muted transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </button>

      {open && !disabled && (
        <div
          role="dialog"
          aria-label="Choose a date"
          className="absolute left-0 z-40 mt-1 w-fit rounded-xl border border-site-border bg-site-card p-3 shadow-card animate-dialog-in"
        >
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={pick}
            defaultMonth={selected ?? minDate ?? new Date()}
            disabled={(date) => {
              if (minDate && date < minDate) return true;
              if (maxDate && date > maxDate) return true;
              return false;
            }}
            classNames={calendarClassNames}
            showOutsideDays={false}
          />
        </div>
      )}
    </div>
  );
}
