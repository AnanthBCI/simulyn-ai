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
import { AlertTriangle, X } from "lucide-react";

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  /**
   * If provided, the user must type this string into a confirmation field
   * before the confirm button enables. Used for destructive actions.
   */
  requireText?: string;
};

type ConfirmContextValue = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm(): ConfirmContextValue["confirm"] {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx.confirm;
}

type Pending = {
  opts: ConfirmOptions;
  resolve: (v: boolean) => void;
};

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [typed, setTyped] = useState("");
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setTyped("");
        setPending({ opts, resolve });
      }),
    [],
  );

  const close = useCallback(
    (result: boolean) => {
      pending?.resolve(result);
      setPending(null);
      setTyped("");
    },
    [pending],
  );

  // Focus the cancel button on open + ESC to close.
  useEffect(() => {
    if (!pending) return;
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, close]);

  const value = useMemo(() => ({ confirm }), [confirm]);
  const isDanger = pending?.opts.variant === "danger";
  const requireText = pending?.opts.requireText;
  const canConfirm = !requireText || typed.trim() === requireText;

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
        >
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
            onClick={() => close(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-md rounded-xl border border-site-border bg-site-card p-6 shadow-card animate-dialog-in">
            <button
              type="button"
              onClick={() => close(false)}
              aria-label="Close dialog"
              className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3">
              {isDanger && (
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-500/15 text-red-400 ring-1 ring-red-500/30">
                  <AlertTriangle className="h-5 w-5" aria-hidden />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 id="confirm-title" className="text-base font-semibold text-white">
                  {pending.opts.title ?? (isDanger ? "Are you sure?" : "Please confirm")}
                </h2>
                <p className="mt-2 text-sm text-slate-300">{pending.opts.message}</p>
                {requireText && (
                  <div className="mt-4">
                    <label className="text-xs font-medium text-slate-400">
                      Type <span className="font-mono text-white">{requireText}</span> to confirm
                    </label>
                    <input
                      autoFocus
                      type="text"
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      className="mt-1 w-full rounded-md border border-site-border bg-site-bg px-3 py-2 text-sm text-white outline-none focus:border-site-accent focus:ring-2 focus:ring-site-accent/20"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => close(false)}
                className="rounded-md border border-site-border bg-site-card px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
              >
                {pending.opts.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                disabled={!canConfirm}
                onClick={() => close(true)}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                  isDanger
                    ? "bg-red-600 hover:bg-red-500 focus-visible:ring-red-500/40"
                    : "bg-site-accent hover:bg-blue-600 focus-visible:ring-site-accent/40"
                }`}
              >
                {pending.opts.confirmLabel ?? (isDanger ? "Delete" : "Confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
