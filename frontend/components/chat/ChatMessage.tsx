"use client";

import { useState } from "react";
import { Check, Copy, Sparkles, User as UserIcon, Wrench } from "lucide-react";
import type { ChatEntry } from "./useChat";

/**
 * Render one user / assistant turn. Assistant turns optionally show a row of
 * "used tool" pills so the user can see what the bot looked at, plus a copy
 * button for the reply text.
 */
export function ChatMessage({ entry }: { entry: ChatEntry }) {
  if (entry.role === "user") {
    return (
      <div className="flex items-start gap-2.5">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-site-accent/20 text-site-accent">
          <UserIcon className="h-3.5 w-3.5" aria-hidden />
        </div>
        <div className="flex-1 rounded-2xl rounded-tl-sm border border-site-accent/30 bg-site-accent/10 px-3.5 py-2 text-sm text-white">
          {entry.content}
        </div>
      </div>
    );
  }

  return <AssistantBubble entry={entry} />;
}

function AssistantBubble({ entry }: { entry: ChatEntry }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText(entry.content).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  const isError = !!entry.error;

  return (
    <div className="flex items-start gap-2.5">
      <div
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
          isError ? "bg-red-500/20 text-red-300" : "bg-emerald-500/15 text-emerald-300"
        }`}
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={`rounded-2xl rounded-tl-sm border px-3.5 py-2 text-sm ${
            isError
              ? "border-red-500/40 bg-red-500/10 text-red-200"
              : "border-site-border bg-site-card text-slate-100"
          }`}
        >
          <p className="whitespace-pre-wrap">{entry.content}</p>
        </div>

        {entry.usedTools && entry.usedTools.length > 0 && (
          <ul className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {entry.usedTools.map((t, i) => (
              <li key={`${t.name}-${i}`}>
                <span
                  title={
                    t.arguments && Object.keys(t.arguments).length > 0
                      ? JSON.stringify(t.arguments)
                      : undefined
                  }
                  className="inline-flex items-center gap-1 rounded-full border border-site-border bg-site-bg px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-site-muted"
                >
                  <Wrench className="h-2.5 w-2.5" aria-hidden />
                  {t.name}
                </span>
              </li>
            ))}
          </ul>
        )}

        {entry.truncated && (
          <p className="mt-1 text-[11px] text-amber-300">
            Reached the lookup limit — try a more specific question for a complete answer.
          </p>
        )}

        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded text-[11px] text-site-muted transition hover:text-white focus-visible:outline-none focus-visible:text-white"
            aria-label="Copy reply"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" aria-hidden />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" aria-hidden />
                Copy
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
