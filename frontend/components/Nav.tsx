"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearToken, getToken } from "@/lib/api";

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(!!getToken());
  }, [pathname]);

  const hideNav = pathname === "/login" || pathname === "/register";
  if (hideNav) return null;

  return (
    <header className="border-b border-site-border bg-site-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          Simulyn AI
        </Link>
        <nav className="flex items-center gap-4 text-sm text-site-muted">
          <Link
            href="/dashboard"
            className={pathname === "/dashboard" ? "text-white" : "hover:text-white"}
          >
            Dashboard
          </Link>
          <Link
            href="/simulation"
            className={pathname === "/simulation" ? "text-white" : "hover:text-white"}
          >
            Simulation
          </Link>
          {authed && (
            <Link
              href="/admin/billing"
              className={pathname === "/admin/billing" ? "text-white" : "hover:text-white"}
            >
              Admin Billing
            </Link>
          )}
          {authed ? (
            <button
              type="button"
              className="rounded-md border border-site-border px-3 py-1 text-white hover:bg-white/5"
              onClick={() => {
                clearToken();
                setAuthed(false);
                router.push("/login");
              }}
            >
              Log out
            </button>
          ) : (
            <Link href="/login" className="text-site-accent">
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
