"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { api, type AdminOrgDto, type SubscriptionUpdateBody } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { DateField } from "@/components/ui/DateField";
import {
  EmptyState,
  ErrorBanner,
  Spinner,
  TableSkeleton,
} from "@/components/ui/primitives";
import { usePageTitle } from "@/hooks/usePageTitle";

function toDateInputValue(isoOrNull: string | null | undefined): string {
  if (!isoOrNull) return "";
  return isoOrNull.length >= 10 ? isoOrNull.slice(0, 10) : "";
}

function fromDateInputValue(dateInput: string): string | null {
  if (!dateInput) return null;
  return new Date(`${dateInput}T00:00:00Z`).toISOString();
}

export default function AdminBillingPage() {
  usePageTitle("Manual billing — Admin");
  const toast = useToast();
  const [orgs, setOrgs] = useState<AdminOrgDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyOrgId, setBusyOrgId] = useState<string | null>(null);
  const [updates, setUpdates] = useState<Record<string, SubscriptionUpdateBody>>({});
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const list = await api.adminOrganizations();
      setOrgs(list);
      setUpdates((prev) => {
        const next = { ...prev };
        for (const o of list) {
          next[o.organizationId] = {
            plan: o.plan,
            subscriptionStatus: o.subscriptionStatus,
            subscriptionExpiresAt: o.subscriptionExpiresAt ?? null,
            billingNotes: null,
          };
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveOrg(orgId: string) {
    const body = updates[orgId];
    if (!body) return;
    setBusyOrgId(orgId);
    try {
      await api.adminUpdateOrgSubscription(orgId, body);
      toast.success("Subscription updated.");
      const list = await api.adminOrganizations();
      setOrgs(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyOrgId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter((o) => o.name.toLowerCase().includes(q));
  }, [orgs, search]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: "Admin" }, { label: "Manual billing" }]} />
        <div>
          <h1 className="mt-3 text-2xl font-semibold text-white">Manual invoice billing</h1>
          <p className="mt-1 text-sm text-site-muted">Loading organizations…</p>
        </div>
        <TableSkeleton rows={5} cols={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Admin" }, { label: "Manual billing" }]} />
      <div>
        <h1 className="text-2xl font-semibold text-white">Manual invoice billing</h1>
        <p className="mt-1 text-sm text-site-muted">
          Platform admin screen. Set organizations to <b>Trial</b> or <b>Active</b> to enable
          predictions and simulation for everyone in that org.
        </p>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      {orgs.length === 0 ? (
        <EmptyState title="No organizations found." />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-site-muted" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search organizations…"
                className="w-72 rounded-md border border-site-border bg-site-card py-1.5 pl-9 pr-3 text-sm text-white placeholder:text-site-muted focus:border-site-accent focus:outline-none focus:ring-2 focus:ring-site-accent/20"
              />
            </div>
            <p className="text-xs text-site-muted">
              {filtered.length} of {orgs.length}
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-site-border bg-site-card shadow-card">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="border-b border-site-border bg-white/5 text-site-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Organization</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Expires</th>
                  <th className="px-4 py-3 font-medium">Notes</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-site-muted">
                      No organizations match &quot;{search}&quot;.
                    </td>
                  </tr>
                )}
                {filtered.map((o) => {
                  const up = updates[o.organizationId];
                  const expires = toDateInputValue(
                    up?.subscriptionExpiresAt ?? o.subscriptionExpiresAt,
                  );
                  return (
                    <tr
                      key={o.organizationId}
                      className="border-b border-site-border transition last:border-0 hover:bg-white/5"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{o.name}</div>
                        <div className="text-xs text-site-muted">
                          {o.memberCount} member(s) · {o.projectCount} project(s)
                        </div>
                        <div className="mt-1 text-xs">
                          {o.isEntitled ? (
                            <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                              Entitled
                            </span>
                          ) : (
                            <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-300">
                              Not entitled
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="w-full rounded-md border border-site-border bg-site-bg px-3 py-2 text-white outline-none transition focus:border-site-accent focus:ring-2 focus:ring-site-accent/20"
                          value={up?.plan ?? o.plan}
                          onChange={(e) =>
                            setUpdates((prev) => ({
                              ...prev,
                              [o.organizationId]: {
                                ...(prev[o.organizationId] ?? up),
                                plan: e.target.value,
                              },
                            }))
                          }
                        >
                          <option value="Starter" className="bg-site-card text-white">
                            Starter
                          </option>
                          <option value="Pro" className="bg-site-card text-white">
                            Pro
                          </option>
                          <option value="Enterprise" className="bg-site-card text-white">
                            Enterprise
                          </option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="w-full rounded-md border border-site-border bg-site-bg px-3 py-2 text-white outline-none transition focus:border-site-accent focus:ring-2 focus:ring-site-accent/20"
                          value={up?.subscriptionStatus ?? o.subscriptionStatus}
                          onChange={(e) =>
                            setUpdates((prev) => ({
                              ...prev,
                              [o.organizationId]: {
                                ...(prev[o.organizationId] ?? up),
                                subscriptionStatus: e.target.value,
                              },
                            }))
                          }
                        >
                          <option value="Trial" className="bg-site-card text-white">
                            Trial
                          </option>
                          <option value="Active" className="bg-site-card text-white">
                            Active
                          </option>
                          <option value="Suspended" className="bg-site-card text-white">
                            Suspended
                          </option>
                          <option value="Inactive" className="bg-site-card text-white">
                            Inactive
                          </option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <DateField
                          value={expires}
                          onChange={(v) => {
                            const iso = fromDateInputValue(v);
                            setUpdates((prev) => ({
                              ...prev,
                              [o.organizationId]: {
                                ...(prev[o.organizationId] ?? up),
                                subscriptionExpiresAt: iso,
                              },
                            }));
                          }}
                          placeholder="No expiry"
                          ariaLabel={`Subscription expiry for ${o.name}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <textarea
                          rows={2}
                          className="w-full resize-none rounded-md border border-site-border bg-site-bg px-3 py-2 text-sm text-white outline-none transition focus:border-site-accent focus:ring-2 focus:ring-site-accent/20"
                          value={up?.billingNotes ?? ""}
                          placeholder="Invoice / contract reference…"
                          onChange={(e) =>
                            setUpdates((prev) => ({
                              ...prev,
                              [o.organizationId]: {
                                ...(prev[o.organizationId] ?? up),
                                billingNotes: e.target.value,
                              },
                            }))
                          }
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={busyOrgId === o.organizationId}
                          onClick={() => void saveOrg(o.organizationId)}
                          className="inline-flex items-center gap-2 rounded-md bg-site-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busyOrgId === o.organizationId && <Spinner size="sm" />}
                          {busyOrgId === o.organizationId ? "Saving…" : "Save"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
