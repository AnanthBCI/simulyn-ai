"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  Sparkles,
  Building2,
  ShieldCheck,
  LogOut,
  Menu,
  MessageSquare,
  X,
} from "lucide-react";
import { api, clearToken, getToken, type MeDto } from "@/lib/api";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { ChatDrawer } from "@/components/chat/ChatDrawer";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  match: (pathname: string) => boolean;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    match: (p) => p === "/dashboard",
  },
  {
    href: "/projects",
    label: "Projects",
    icon: FolderKanban,
    // Highlights for /projects, /projects/new, and /projects/[id]
    match: (p) => p.startsWith("/projects"),
  },
  {
    href: "/simulation",
    label: "What-if simulator",
    icon: Sparkles,
    match: (p) => p === "/simulation",
  },
  {
    href: "/organizations",
    label: "Organizations",
    icon: Building2,
    match: (p) => p.startsWith("/organizations"),
  },
  {
    href: "/admin/billing",
    label: "Admin",
    icon: ShieldCheck,
    match: (p) => p.startsWith("/admin"),
    adminOnly: true,
  },
];

export function Sidebar({
  me,
  open,
  onClose,
  onLogout,
}: {
  me: MeDto | null;
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname() ?? "";
  const items = NAV_ITEMS.filter((i) => !i.adminOnly || me?.isPlatformAdmin);
  const initials = (me?.name ?? "")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-site-sidebar text-slate-100 transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between border-b border-site-sidebar-border px-5 py-5">
          <Link
            href="/dashboard"
            onClick={onClose}
            aria-label="Simulyn AI — Dashboard"
            className="group flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/50"
          >
            <Image
              src="/logo-mark.png"
              alt="Simulyn AI"
              width={40}
              height={40}
              priority
              className="h-10 w-10 shrink-0 object-contain"
            />
            <span className="flex flex-col leading-tight">
              <span className="text-lg font-semibold tracking-tight text-white">
                Simulyn <span className="text-site-accent">AI</span>
              </span>
              <span className="text-[10.5px] tracking-wide text-site-sidebar-muted">
                Predict. Explain. Act.
              </span>
            </span>
          </Link>
          <button
            type="button"
            className="rounded-md p-1 text-site-sidebar-muted transition hover:bg-site-sidebar-hover hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/50 lg:hidden"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {/* Workspace (org) switcher */}
        <div className="border-b border-site-sidebar-border">
          <OrgSwitcher />
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {items.map((item) => {
              const active = item.match(pathname);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/50 ${
                      active
                        ? "bg-site-accent text-white"
                        : "text-site-sidebar-muted hover:bg-site-sidebar-hover hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User profile + logout */}
        {me && (
          <div className="border-t border-site-sidebar-border p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-site-sidebar-hover text-sm font-semibold text-white">
                {initials || "U"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{me.name}</p>
                <p className="truncate text-xs text-site-sidebar-muted">{me.email}</p>
              </div>
              <button
                type="button"
                onClick={onLogout}
                title="Log out"
                aria-label="Log out"
                className="rounded-md p-2 text-site-sidebar-muted transition hover:bg-site-sidebar-hover hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/50"
              >
                <LogOut className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

export function MobileMenuButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-md border border-site-border bg-site-card p-2 text-slate-300 shadow-sm transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/50 lg:hidden"
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" aria-hidden />
    </button>
  );
}

/**
 * Top-level shell: dark sidebar on the left, light main area on the right.
 * Hides itself entirely on auth/landing pages so login/register/landing keep
 * their own full-bleed layout.
 *
 * Always wraps children in <ToastProvider> + <ConfirmProvider> so every page
 * (including the public ones) can `useToast()` / `useConfirm()`.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <ShellInner>{children}</ShellInner>
      </ConfirmProvider>
    </ToastProvider>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [me, setMe] = useState<MeDto | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Pages that render their own layout (no sidebar).
  const isPublic = pathname === "/" || pathname === "/login" || pathname === "/register";

  // Close mobile drawer whenever the route changes. Chat stays open across
  // navigations on purpose — a user might want to ask follow-ups while jumping
  // between projects.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    setAuthed(!!getToken());
  }, [pathname]);

  useEffect(() => {
    if (!authed) {
      setMe(null);
      return;
    }
    let cancelled = false;
    api
      .me()
      .then((m) => {
        if (!cancelled) setMe(m);
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      });
    return () => {
      cancelled = true;
    };
  }, [authed, pathname]);

  function logout() {
    clearToken();
    setAuthed(false);
    router.push("/");
  }

  if (isPublic || !authed) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-site-bg">
      <Sidebar
        me={me}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onLogout={logout}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile-only top bar (the sidebar is off-screen on mobile). */}
        <div className="flex items-center gap-3 border-b border-site-border bg-site-card px-4 py-3 lg:hidden">
          <MobileMenuButton onOpen={() => setMobileOpen(true)} />
          <Image
            src="/logo-mark.png"
            alt="Simulyn AI"
            width={32}
            height={32}
            priority
            className="h-8 w-8 object-contain"
          />
          <span className="text-base font-semibold tracking-tight">
            Simulyn <span className="text-site-accent">AI</span>
          </span>
        </div>
        <main className="flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>

      {/* Floating "Ask Simulyn" launcher. Hidden while drawer is open so it doesn't
          stack on top of the close button. */}
      {!chatOpen && (
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          aria-label="Ask Simulyn AI"
          className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full bg-site-accent px-4 py-3 text-sm font-medium text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-600 hover:shadow-blue-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-site-bg"
        >
          <MessageSquare className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Ask Simulyn</span>
        </button>
      )}
      <ChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
