"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info" | "warning";

export type Toast = {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
  /** ms before auto-dismiss; 0 = sticky */
  duration: number;
  action?: { label: string; onClick: () => void };
};

type ToastInput = Partial<Omit<Toast, "id">> & Pick<Toast, "message">;

type ToastContextValue = {
  show: (toast: ToastInput) => string;
  success: (message: string, opts?: Omit<ToastInput, "message" | "variant">) => string;
  error: (message: string, opts?: Omit<ToastInput, "message" | "variant">) => string;
  info: (message: string, opts?: Omit<ToastInput, "message" | "variant">) => string;
  warning: (message: string, opts?: Omit<ToastInput, "message" | "variant">) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const DEFAULTS: Record<ToastVariant, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 7000,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const handle = timers.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (input: ToastInput): string => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `t-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const variant: ToastVariant = input.variant ?? "info";
      const duration = input.duration ?? DEFAULTS[variant];
      const toast: Toast = {
        id,
        title: input.title,
        message: input.message,
        variant,
        duration,
        action: input.action,
      };
      setToasts((prev) => [...prev, toast]);
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      dismiss,
      success: (message, opts) => show({ ...opts, message, variant: "success" }),
      error: (message, opts) => show({ ...opts, message, variant: "error" }),
      info: (message, opts) => show({ ...opts, message, variant: "info" }),
      warning: (message, opts) => show({ ...opts, message, variant: "warning" }),
    }),
    [show, dismiss],
  );

  useEffect(() => {
    const timersSnapshot = timers.current;
    return () => {
      timersSnapshot.forEach((h) => clearTimeout(h));
      timersSnapshot.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const ICON_BY_VARIANT: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const TONE_BY_VARIANT: Record<ToastVariant, string> = {
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  error: "border-red-500/40 bg-red-500/10 text-red-300",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  info: "border-site-accent/40 bg-site-accent/10 text-site-accent",
};

const ICON_TONE: Record<ToastVariant, string> = {
  success: "text-emerald-400",
  error: "text-red-400",
  warning: "text-amber-400",
  info: "text-site-accent",
};

function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 pb-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end sm:px-0"
    >
      {toasts.map((t) => {
        const Icon = ICON_BY_VARIANT[t.variant];
        return (
          <div
            key={t.id}
            role={t.variant === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-site-card p-3 pr-2 shadow-card backdrop-blur ${TONE_BY_VARIANT[t.variant]} animate-toast-in`}
          >
            <Icon
              className={`mt-0.5 h-5 w-5 shrink-0 ${ICON_TONE[t.variant]}`}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              {t.title && (
                <p className="text-sm font-semibold text-white">{t.title}</p>
              )}
              <p className="text-sm leading-snug text-slate-100/90">{t.message}</p>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action?.onClick();
                    onDismiss(t.id);
                  }}
                  className={`mt-2 inline-block text-xs font-semibold underline-offset-2 hover:underline ${ICON_TONE[t.variant]}`}
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="rounded-md p-1 text-slate-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
