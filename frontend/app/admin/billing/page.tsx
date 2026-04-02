"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type AdminUserDto, type SubscriptionUpdateBody } from "@/lib/api";

function toDateInputValue(isoOrNull: string | null | undefined): string {
  if (!isoOrNull) return "";
  return isoOrNull.length >= 10 ? isoOrNull.slice(0, 10) : "";
}

function fromDateInputValue(dateInput: string): string | null {
  if (!dateInput) return null;
  // Interpret as UTC midnight to avoid timezone shifting.
  return new Date(`${dateInput}T00:00:00Z`).toISOString();
}

export default function AdminBillingPage() {
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const [updates, setUpdates] = useState<Record<string, SubscriptionUpdateBody>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const list = await api.adminUsers();
        if (cancelled) return;
        setUsers(list);

        setUpdates((prev) => {
          const next = { ...prev };
          for (const u of list) {
            next[u.userId] = {
              plan: u.plan,
              subscriptionStatus: u.subscriptionStatus,
              subscriptionExpiresAt: u.subscriptionExpiresAt ?? null,
              billingNotes: null,
            };
          }
          return next;
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const canRender = useMemo(() => !loading, [loading]);

  async function saveUser(userId: string) {
    const body = updates[userId];
    if (!body) return;
    setBusyUserId(userId);
    setError(null);
    try {
      await api.adminUpdateSubscription(userId, body);
      const list = await api.adminUsers();
      setUsers(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyUserId(null);
    }
  }

  if (loading) return <p className="text-site-muted">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Manual invoice billing</h1>
        <p className="mt-1 text-sm text-site-muted">
          Platform admin screen. Set users to <b>Trial</b> or <b>Active</b> to enable prediction/simulation.
        </p>
      </div>

      {error && <p className="text-red-400">{error}</p>}

      {canRender && (
        <div className="overflow-x-auto rounded-xl border border-site-border bg-site-card">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-site-border bg-site-bg/80 text-site-muted">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-site-muted">
                    No users found.
                  </td>
                </tr>
              )}
              {users.map((u) => {
                const up = updates[u.userId];
                const expires = toDateInputValue(up?.subscriptionExpiresAt ?? u.subscriptionExpiresAt);
                return (
                  <tr key={u.userId} className="border-b border-site-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{u.name}</div>
                      <div className="text-xs text-site-muted">{u.email}</div>
                      <div className="mt-1 text-xs">
                        {u.isEntitled ? (
                          <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">
                            Entitled
                          </span>
                        ) : (
                          <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-200">
                            Not entitled
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="w-full rounded-md border border-site-border bg-site-bg px-3 py-2"
                        value={up?.plan ?? u.plan}
                        onChange={(e) =>
                          setUpdates((prev) => ({
                            ...prev,
                            [u.userId]: {
                              ...(prev[u.userId] ?? up),
                              plan: e.target.value,
                            },
                          }))
                        }
                      >
                        <option value="Starter">Starter</option>
                        <option value="Pro">Pro</option>
                        <option value="Enterprise">Enterprise</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="w-full rounded-md border border-site-border bg-site-bg px-3 py-2"
                        value={up?.subscriptionStatus ?? u.subscriptionStatus}
                        onChange={(e) =>
                          setUpdates((prev) => ({
                            ...prev,
                            [u.userId]: {
                              ...(prev[u.userId] ?? up),
                              subscriptionStatus: e.target.value,
                            },
                          }))
                        }
                      >
                        <option value="Trial">Trial</option>
                        <option value="Active">Active</option>
                        <option value="Suspended">Suspended</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="date"
                        className="w-full rounded-md border border-site-border bg-site-bg px-3 py-2"
                        value={expires}
                        onChange={(e) => {
                          const iso = fromDateInputValue(e.target.value);
                          setUpdates((prev) => ({
                            ...prev,
                            [u.userId]: {
                              ...(prev[u.userId] ?? up),
                              subscriptionExpiresAt: iso,
                            },
                          }));
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <textarea
                        rows={2}
                        className="w-full resize-none rounded-md border border-site-border bg-site-bg px-3 py-2 text-sm"
                        value={up?.billingNotes ?? ""}
                        placeholder="Invoice / contract reference…"
                        onChange={(e) =>
                          setUpdates((prev) => ({
                            ...prev,
                            [u.userId]: {
                              ...(prev[u.userId] ?? up),
                              billingNotes: e.target.value,
                            },
                          }))
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={busyUserId === u.userId}
                        onClick={() => void saveUser(u.userId)}
                        className="rounded-md bg-site-accent px-3 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                      >
                        {busyUserId === u.userId ? "Saving…" : "Save"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

