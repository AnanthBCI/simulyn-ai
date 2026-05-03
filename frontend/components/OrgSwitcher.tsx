"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Building2 } from "lucide-react";
import { api, getActiveOrgId, setActiveOrgId, type OrganizationDto } from "@/lib/api";

/**
 * Compact org switcher designed to live inside the dark sidebar.
 * Renders the active org name + a native <select> for switching, plus a link
 * to the full Organizations management page. No floating dropdown so it works
 * cleanly inside the constrained sidebar width.
 */
export function OrgSwitcher() {
  const [orgs, setOrgs] = useState<OrganizationDto[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const list = await api.myOrganizations();
      setOrgs(list);
      const stored = getActiveOrgId();
      if (stored && list.some((o) => o.id === stored)) {
        setActiveId(stored);
      } else if (list[0]) {
        setActiveOrgId(list[0].id);
        setActiveId(list[0].id);
      } else {
        setActiveId(null);
      }
    } catch {
      // not authed yet, ignore
    }
  }, []);

  useEffect(() => {
    void reload();
    const onChange = () => void reload();
    window.addEventListener("simulyn:org-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("simulyn:org-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [reload]);

  if (orgs.length === 0) return null;
  const active = orgs.find((o) => o.id === activeId) ?? orgs[0];

  function pick(id: string) {
    setActiveOrgId(id);
    setActiveId(id);
  }

  return (
    <div className="px-4 py-3">
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-site-sidebar-muted">
        <Building2 className="h-3 w-3" />
        Workspace
      </p>
      <div className="relative mt-2">
        <select
          value={active.id}
          onChange={(e) => pick(e.target.value)}
          aria-label="Switch active workspace"
          className="w-full appearance-none rounded-md border border-site-sidebar-border bg-site-sidebar-hover py-2 pl-3 pr-8 text-sm font-medium text-white outline-none transition focus:border-site-accent focus-visible:ring-2 focus-visible:ring-site-accent/40"
        >
          {orgs.map((o) => (
            <option key={o.id} value={o.id} className="bg-site-sidebar text-white">
              {o.name} {o.isEntitled ? "" : "(not entitled)"}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-site-sidebar-muted"
          aria-hidden
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-site-sidebar-muted">
        <span>
          {active.myRole} · {active.plan}
        </span>
        <Link
          href="/organizations"
          className="rounded text-site-accent transition hover:underline focus-visible:outline-none focus-visible:underline"
        >
          Manage
        </Link>
      </div>
    </div>
  );
}
