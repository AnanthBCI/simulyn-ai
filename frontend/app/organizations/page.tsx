"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, Trash2 } from "lucide-react";
import {
  api,
  getActiveOrgId,
  getToken,
  setActiveOrgId,
  type OrganizationDto,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  EmptyState,
  ErrorBanner,
  Spinner,
  TableSkeleton,
} from "@/components/ui/primitives";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function OrganizationsPage() {
  usePageTitle("Organizations");
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [orgs, setOrgs] = useState<OrganizationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  async function reload() {
    setError(null);
    try {
      const list = await api.myOrganizations();
      setOrgs(list);
      setActiveId(getActiveOrgId());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void reload();
  }, [router]);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const o = await api.createOrganization(newName.trim());
      toast.success(`Created "${o.name}". You're the Owner.`);
      setNewName("");
      setActiveOrgId(o.id);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  function makeActive(o: OrganizationDto) {
    setActiveOrgId(o.id);
    setActiveId(o.id);
    toast.info(`Switched to "${o.name}".`);
  }

  async function deleteOrg(o: OrganizationDto) {
    const ok = await confirm({
      title: "Delete this organization?",
      message: `"${o.name}" and ${o.projectCount} project(s) will be permanently deleted. Members will lose access.`,
      requireText: o.name,
      confirmLabel: "Delete organization",
      variant: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.deleteOrganization(o.id);
      if (activeId === o.id) setActiveOrgId(null);
      toast.success(`Deleted "${o.name}".`);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Organizations</h1>
          <p className="mt-1 text-site-muted">Loading your workspaces…</p>
        </div>
        <TableSkeleton rows={4} cols={6} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Organizations</h1>
        <p className="mt-1 text-site-muted">
          Each organization is a separate workspace with its own projects, members and billing.
        </p>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => void reload()} />}

      <section className="rounded-xl border border-site-border bg-site-card p-6 shadow-card">
        <h2 className="text-lg font-medium text-white">Create a new organization</h2>
        <form onSubmit={createOrg} className="mt-3 flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="e.g. Acme Construction Pty Ltd"
            className="flex-1 rounded-md border border-site-border bg-site-bg px-3 py-2 text-sm text-white outline-none transition focus:border-site-accent focus:ring-2 focus:ring-site-accent/20"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={busy}
            maxLength={120}
            required
          />
          <button
            type="submit"
            disabled={busy || !newName.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-site-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy && <Spinner size="sm" />}
            Create
          </button>
        </form>
        <p className="mt-2 text-xs text-site-muted">
          You become the Owner. New orgs start with a 30-day Trial.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-medium text-white">Your organizations</h2>
        {orgs.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              Icon={Building2}
              title="You don't belong to any organizations yet."
              description="Create one above to start tracking projects."
            />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-site-border bg-site-card shadow-card">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-site-border bg-white/5 text-site-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Your role</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Members</th>
                  <th className="px-4 py-3 font-medium">Projects</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-site-border transition last:border-0 hover:bg-white/5"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{o.name}</div>
                      {activeId === o.id && (
                        <div className="text-xs font-medium text-emerald-400">Active</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{o.myRole}</td>
                    <td className="px-4 py-3 text-slate-300">{o.plan}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {o.subscriptionStatus}
                      {!o.isEntitled && (
                        <span className="ml-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-300">
                          Not entitled
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{o.memberCount}</td>
                    <td className="px-4 py-3 text-slate-300">{o.projectCount}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {activeId !== o.id && (
                          <button
                            type="button"
                            onClick={() => makeActive(o)}
                            className="rounded-md border border-site-border px-2 py-1 text-xs text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
                          >
                            Set active
                          </button>
                        )}
                        <Link
                          href={`/organizations/${o.id}`}
                          className="rounded-md border border-site-border px-2 py-1 text-xs text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
                        >
                          Manage
                        </Link>
                        {o.myRole === "Owner" && (
                          <button
                            type="button"
                            onClick={() => void deleteOrg(o)}
                            disabled={busy}
                            className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-300 transition hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Delete ${o.name}`}
                          >
                            <Trash2 className="h-3 w-3" aria-hidden />
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
