"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  api,
  canManageMembers,
  getToken,
  ROLES,
  type OrganizationMemberDto,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import {
  ErrorBanner,
  Spinner,
  TableSkeleton,
} from "@/components/ui/primitives";
import { usePageTitle } from "@/hooks/usePageTitle";

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export default function OrganizationDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [members, setMembers] = useState<OrganizationMemberDto[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("Member");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");

  usePageTitle(orgName || "Organization");

  async function reload() {
    setError(null);
    try {
      const orgs = await api.myOrganizations();
      const me = orgs.find((o) => o.id === id);
      if (!me) {
        setError("You don't have access to this organization.");
        setLoading(false);
        return;
      }
      setMyRole(me.myRole);
      setOrgName(me.name);
      setNewName(me.name);
      const list = await api.organizationMembers(id);
      setMembers(list);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    if (!inviteEmail.trim()) {
      setInviteError("Email is required.");
      return;
    }
    if (!isValidEmail(inviteEmail)) {
      setInviteError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const m = await api.addOrganizationMember(id, inviteEmail.trim(), inviteRole);
      toast.success(`Added ${m.name || m.email} as ${m.role}.`);
      setInviteEmail("");
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Add failed";
      setInviteError(
        msg.toLowerCase().includes("not found")
          ? "No registered user with that email. They need to sign up first."
          : msg.length > 200
            ? "Couldn't add the member. Please try again."
            : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(userId: string, role: string, name: string) {
    setBusy(true);
    try {
      await api.updateMemberRole(id, userId, role);
      toast.success(`${name} is now ${role}.`);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(member: OrganizationMemberDto) {
    const ok = await confirm({
      title: "Remove this member?",
      message: `${member.name || member.email} will lose access to "${orgName}".`,
      confirmLabel: "Remove",
      variant: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.removeMember(id, member.userId);
      toast.success(`Removed ${member.name || member.email}.`);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  async function rename() {
    if (!newName.trim() || newName === orgName) {
      setRenaming(false);
      return;
    }
    setBusy(true);
    try {
      await api.updateOrganization(id, newName.trim());
      setOrgName(newName.trim());
      setRenaming(false);
      toast.success("Organization renamed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rename failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Breadcrumbs
            items={[
              { label: "Organizations", href: "/organizations" },
              { label: "Loading…" },
            ]}
          />
          <p className="mt-3 text-site-muted">Loading…</p>
        </div>
        <TableSkeleton rows={4} cols={4} />
      </div>
    );
  }
  if (error && members.length === 0) {
    return (
      <div className="space-y-4">
        <Breadcrumbs
          items={[
            { label: "Organizations", href: "/organizations" },
            { label: "Not found" },
          ]}
        />
        <ErrorBanner message={error} onRetry={() => void reload()} />
      </div>
    );
  }

  const canAdmin = canManageMembers(myRole);
  const isOwner = myRole === "Owner";

  return (
    <div className="space-y-8">
      <div>
        <Breadcrumbs
          items={[
            { label: "Organizations", href: "/organizations" },
            { label: orgName || "Organization" },
          ]}
        />
        {renaming ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              className="rounded-md border border-site-border bg-site-bg px-3 py-2 text-lg text-white outline-none focus:border-site-accent focus:ring-2 focus:ring-site-accent/20"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={busy}
              autoFocus
            />
            <button
              type="button"
              onClick={() => void rename()}
              disabled={busy}
              className="rounded-md bg-site-accent px-3 py-2 text-sm text-white transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setRenaming(false);
                setNewName(orgName);
              }}
              className="rounded-md border border-site-border px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-white">{orgName}</h1>
            {canAdmin && (
              <button
                type="button"
                onClick={() => setRenaming(true)}
                className="rounded-md border border-site-border px-2 py-1 text-xs text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
              >
                Rename
              </button>
            )}
          </div>
        )}
        <p className="mt-1 text-site-muted">Your role: {myRole}</p>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => void reload()} />}

      {canAdmin && (
        <section className="rounded-xl border border-site-border bg-site-card p-6 shadow-card">
          <h2 className="text-lg font-medium text-white">Add member</h2>
          <p className="mt-1 text-sm text-site-muted">
            Add an existing registered user by email. (Email-invite for new
            users is on the roadmap.)
          </p>
          <form onSubmit={invite} noValidate className="mt-3 flex flex-wrap gap-3">
            <input
              type="email"
              placeholder="user@example.com"
              className={`flex-1 rounded-md border bg-site-bg px-3 py-2 text-sm text-white outline-none transition focus:ring-2 ${
                inviteError
                  ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/30"
                  : "border-site-border focus:border-site-accent focus:ring-site-accent/20"
              }`}
              value={inviteEmail}
              onChange={(e) => {
                setInviteEmail(e.target.value);
                if (inviteError) setInviteError(null);
              }}
              disabled={busy}
              aria-invalid={!!inviteError}
              required
            />
            <select
              className="rounded-md border border-site-border bg-site-bg px-3 py-2 text-sm text-white outline-none transition focus:border-site-accent focus:ring-2 focus:ring-site-accent/20"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              disabled={busy}
            >
              {ROLES.filter((r) => isOwner || r !== "Owner").map((r) => (
                <option key={r} value={r} className="bg-site-card text-white">
                  {r}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={busy || !inviteEmail.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-site-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <Spinner size="sm" />}
              Add
            </button>
          </form>
          {inviteError && (
            <p
              role="alert"
              className="mt-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
            >
              {inviteError}
            </p>
          )}
        </section>
      )}

      <section>
        <h2 className="text-lg font-medium text-white">Members</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-site-border bg-site-card shadow-card">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-site-border bg-white/5 text-site-muted">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr
                  key={m.userId}
                  className="border-b border-site-border transition last:border-0 hover:bg-white/5"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{m.name}</div>
                    <div className="text-xs text-site-muted">{m.email}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {isOwner ? (
                      <select
                        className="rounded-md border border-site-border bg-site-bg px-2 py-1 text-sm text-white outline-none transition focus:border-site-accent focus:ring-2 focus:ring-site-accent/20"
                        value={m.role}
                        disabled={busy}
                        onChange={(e) =>
                          void changeRole(m.userId, e.target.value, m.name || m.email)
                        }
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r} className="bg-site-card text-white">
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      m.role
                    )}
                  </td>
                  <td className="px-4 py-3 text-site-muted">
                    {new Date(m.joinedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canAdmin && (
                      <button
                        type="button"
                        onClick={() => void remove(m)}
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-300 transition hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={`Remove ${m.name || m.email}`}
                      >
                        <Trash2 className="h-3 w-3" aria-hidden />
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
