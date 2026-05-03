"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  getActiveOrgId,
  type ChatMessage,
  type ChatReply,
  type ChatUsedTool,
} from "@/lib/api";

/**
 * Local-only conversation entry. We never persist `tool` or assistant-with-tool_calls
 * turns: those are produced server-side and exposed to the UI via `usedTools`.
 *
 * Persistence is per (user-token, active-org) so switching orgs gives a fresh
 * conversation without leaking context between tenants.
 */
export type ChatEntry = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
  usedTools?: ChatUsedTool[];
  truncated?: boolean;
  /** Filled in when an entry represents a failed turn (network/server error). */
  error?: string;
};

const MAX_PERSISTED_TURNS = 50;

function storageKey(orgId: string | null): string | null {
  if (!orgId) return null;
  return `simulyn_chat_${orgId}`;
}

function loadHistory(orgId: string | null): ChatEntry[] {
  const key = storageKey(orgId);
  if (!key || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveHistory(orgId: string | null, entries: ChatEntry[]) {
  const key = storageKey(orgId);
  if (!key || typeof window === "undefined") return;
  try {
    const trimmed = entries.slice(-MAX_PERSISTED_TURNS);
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch {
    /* ignore quota errors — chat is best-effort */
  }
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Convert local entries back into the wire format the API expects. We only
 * pass through `user` / final-answer `assistant` turns (no tool plumbing — the
 * orchestrator rebuilds that fresh each request).
 */
function entriesToWire(entries: ChatEntry[]): ChatMessage[] {
  return entries
    .filter((e) => !e.error && (e.role === "user" || e.role === "assistant"))
    .map<ChatMessage>((e) => ({
      role: e.role,
      content: e.content,
    }));
}

export function useChat() {
  const [orgId, setOrgId] = useState<string | null>(() => getActiveOrgId());
  const [entries, setEntries] = useState<ChatEntry[]>(() => loadHistory(orgId));
  const [sending, setSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // React to org switches: reload the conversation tied to the new active org.
  useEffect(() => {
    function onOrgChanged() {
      const next = getActiveOrgId();
      setOrgId(next);
      setEntries(loadHistory(next));
    }
    if (typeof window === "undefined") return;
    window.addEventListener("simulyn:org-changed", onOrgChanged);
    return () => window.removeEventListener("simulyn:org-changed", onOrgChanged);
  }, []);

  // Persist on every change so refreshing the tab keeps the chat alive.
  useEffect(() => {
    saveHistory(orgId, entries);
  }, [orgId, entries]);

  const send = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed || sending) return;

      // Cancel any in-flight request (defensive — UI also disables the button).
      abortRef.current?.abort();

      const userEntry: ChatEntry = {
        id: genId(),
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      };

      // Snapshot history-as-of-now to send with the request, then optimistically
      // add the user turn.
      const wireHistory = entriesToWire(entries);
      setEntries((prev) => [...prev, userEntry]);
      setSending(true);

      try {
        const reply: ChatReply = await api.chat({
          message: trimmed,
          history: wireHistory,
        });
        const assistantEntry: ChatEntry = {
          id: genId(),
          role: "assistant",
          content: reply.reply,
          createdAt: Date.now(),
          usedTools: reply.usedTools,
          truncated: reply.truncated,
        };
        setEntries((prev) => [...prev, assistantEntry]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Chat request failed.";
        setEntries((prev) => [
          ...prev,
          {
            id: genId(),
            role: "assistant",
            content: msg.length > 240 ? "Couldn't reach the AI service. Try again." : msg,
            createdAt: Date.now(),
            error: msg,
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [entries, sending],
  );

  const clear = useCallback(() => {
    setEntries([]);
    saveHistory(orgId, []);
  }, [orgId]);

  return {
    entries,
    sending,
    send,
    clear,
    /** Active organization id this conversation is bound to (used for the empty state). */
    orgId,
  };
}
