"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Send, Sparkles, Trash2, X } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { useChat } from "./useChat";
import { useConfirm } from "@/components/ui/ConfirmDialog";

const SUGGESTIONS_BY_LANG: Record<string, string[]> = {
  en: [
    "What's at risk this week?",
    "Show me high-risk tasks",
    "Give me a portfolio summary",
    "Which tasks are slipping in my biggest project?",
  ],
  es: [
    "¿Qué está en riesgo esta semana?",
    "Muéstrame las tareas de alto riesgo",
    "Dame un resumen del portafolio",
    "¿Qué tareas se están retrasando?",
  ],
  fr: [
    "Qu'est-ce qui est à risque cette semaine ?",
    "Montre-moi les tâches à haut risque",
    "Donne-moi un résumé du portefeuille",
    "Quelles tâches sont en retard ?",
  ],
  hi: [
    "इस हफ्ते कौन से प्रोजेक्ट जोखिम में हैं?",
    "उच्च जोखिम वाले कार्य दिखाओ",
    "पोर्टफोलियो सारांश दो",
    "मेरे सबसे बड़े प्रोजेक्ट में कौन से कार्य देरी से चल रहे हैं?",
  ],
  ta: [
    "இந்த வாரம் என்ன ஆபத்தில் உள்ளது?",
    "உயர் ஆபத்து பணிகளைக் காட்டு",
    "போர்ட்ஃபோலியோ சுருக்கம் தா",
    "எந்தப் பணிகள் தாமதமாகின்றன?",
  ],
};

function pickSuggestions(): string[] {
  if (typeof navigator === "undefined") return SUGGESTIONS_BY_LANG.en;
  const lang = (navigator.language || "en").slice(0, 2).toLowerCase();
  return SUGGESTIONS_BY_LANG[lang] ?? SUGGESTIONS_BY_LANG.en;
}

export function ChatDrawer({
  open,
  onClose,
  seedMessage,
  onSeedConsumed,
}: {
  open: boolean;
  onClose: () => void;
  /** When set as the drawer opens, pre-fills the composer (e.g. dashboard shortcuts). */
  seedMessage?: string | null;
  onSeedConsumed?: () => void;
}) {
  const { entries, sending, send, clear } = useChat();
  const confirm = useConfirm();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const suggestions = useMemo(pickSuggestions, []);

  useEffect(() => {
    if (!open || seedMessage == null || seedMessage === "") return;
    setInput(seedMessage);
    onSeedConsumed?.();
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, seedMessage, onSeedConsumed]);

  // Autoscroll to the bottom when a new entry arrives or while we're waiting.
  useEffect(() => {
    if (!open) return;
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [entries, sending, open]);

  // Close on Escape; focus input on open.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function submit(message: string) {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setInput("");
    void send(trimmed);
  }

  async function handleClear() {
    if (entries.length === 0) return;
    const ok = await confirm({
      title: "Clear conversation?",
      message: "This wipes the chat history for the active organization on this device.",
      confirmLabel: "Clear",
      variant: "danger",
    });
    if (ok) clear();
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop. Click anywhere outside to dismiss (mobile + accidental clicks). */}
      <button
        type="button"
        aria-label="Close chat"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm animate-fade-in lg:hidden"
      />

      <aside
        role="dialog"
        aria-label="Ask Simulyn AI"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-site-border bg-site-card shadow-2xl animate-drawer-in sm:w-[26rem]"
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-3 border-b border-site-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-site-accent/15 text-site-accent">
              <Sparkles className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-white">Ask Simulyn</h2>
              <p className="truncate text-[11px] text-site-muted">
                Multilingual AI copilot for your projects
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void handleClear()}
              disabled={entries.length === 0}
              aria-label="Clear conversation"
              title="Clear conversation"
              className="rounded-md p-1.5 text-site-muted transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close chat"
              className="rounded-md p-1.5 text-site-muted transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {entries.length === 0 ? (
            <EmptyState suggestions={suggestions} onPick={(s) => submit(s)} />
          ) : (
            entries.map((e) => <ChatMessage key={e.id} entry={e} />)
          )}
          {sending && <ThinkingIndicator />}
        </div>

        {/* Composer */}
        <form
          className="border-t border-site-border bg-site-bg/60 px-3 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(input);
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder="Ask in any language… (Shift+Enter for new line)"
              disabled={sending}
              className="min-h-[2.5rem] max-h-32 flex-1 resize-y rounded-lg border border-site-border bg-site-card px-3 py-2 text-sm text-white placeholder:text-site-muted focus:border-site-accent focus:outline-none focus:ring-2 focus:ring-site-accent/30 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Type your question"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-site-accent text-white transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <p className="mt-1.5 text-[10.5px] text-site-muted">
            Read-only assistant in v1 — it can only see what you can see in this organization.
          </p>
        </form>
      </aside>
    </>
  );
}

function EmptyState({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (s: string) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-site-accent/10 text-site-accent">
        <MessageSquare className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-white">Ask anything about your projects</h3>
      <p className="mt-1 max-w-xs text-xs text-site-muted">
        Type in any language. The bot calls real APIs to fetch live data from your active
        organization — never makes things up.
      </p>
      <ul className="mt-4 w-full space-y-1.5">
        {suggestions.map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="w-full rounded-lg border border-site-border bg-site-bg/40 px-3 py-2 text-left text-xs text-slate-300 transition hover:border-site-accent/50 hover:bg-site-accent/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 text-xs text-site-muted" role="status">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span className="flex items-center gap-1">
        Thinking
        <span className="inline-flex gap-0.5">
          <span className="h-1 w-1 rounded-full bg-site-muted animate-pulse-dot" />
          <span
            className="h-1 w-1 rounded-full bg-site-muted animate-pulse-dot"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="h-1 w-1 rounded-full bg-site-muted animate-pulse-dot"
            style={{ animationDelay: "300ms" }}
          />
        </span>
      </span>
    </div>
  );
}
