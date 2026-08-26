"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  FileText,
  HardHat,
  LayoutDashboard,
  Menu,
  Receipt,
  Settings,
  Users,
  X,
} from "lucide-react";
import type { AuthUser } from "@/lib/auth";
import { UserAvatar, UserMenu } from "@/components/user-menu";

const links = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/clients", label: "Clients", icon: Users },
  { href: "/app/jobs", label: "Jobs", icon: HardHat },
  { href: "/app/quotes", label: "Quotes", icon: FileText },
  { href: "/app/invoices", label: "Invoices", icon: Receipt },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {links.map((link) => {
        const active = pathname === link.href || (link.href !== "/app" && pathname.startsWith(link.href));
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon size={16} />
            {link.label}
          </Link>
        );
      })}
    </>
  );
}

export function AppShell({
  businessName,
  user,
  children,
}: {
  businessName: string;
  user: AuthUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPrint = pathname.endsWith("/print");
  const [menuOpen, setMenuOpen] = useState(false);

  if (isPrint) return <>{children}</>;

  return (
    <div className="flex min-h-screen">
      <aside className="no-print hidden w-60 flex-col border-r border-line bg-navy text-white lg:flex">
        <div className="px-5 py-5">
          <Link href="/app" className="text-base font-semibold tracking-tight">
            Trades Planner
          </Link>
          <p className="mt-1 truncate text-xs text-white/70">{businessName || "Your business"}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          <NavLinks pathname={pathname} />
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
            <UserAvatar user={user} size={32} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name || "Your account"}</p>
              <p className="truncate text-xs text-white/60">{user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {menuOpen ? (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative flex h-full w-64 flex-col bg-navy text-white shadow-xl">
            <div className="flex items-center justify-between px-5 py-4">
              <Link href="/app" className="text-base font-semibold" onClick={() => setMenuOpen(false)}>
                Trades Planner
              </Link>
              <button
                type="button"
                className="rounded-lg p-1.5 hover:bg-white/10"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 px-3">
              <NavLinks pathname={pathname} onNavigate={() => setMenuOpen(false)} />
            </nav>
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="no-print flex items-center justify-between gap-3 border-b border-line bg-card px-4 py-2 lg:justify-end lg:px-6">
          <div className="flex items-center lg:hidden">
            <button
              type="button"
              className="rounded-lg p-2 text-ink hover:bg-paper lg:hidden"
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={18} />
            </button>
          </div>
          <UserMenu user={user} />
        </div>
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  back,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {back ? (
          <Link href={back.href} className="mb-1 inline-block text-sm text-muted hover:text-ink">
            ← {back.label}
          </Link>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="card px-8 py-14 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{body}</p>
      <Link href={href} className="btn btn-primary mt-6">
        {cta}
      </Link>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

export function TableCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function RelatedList({
  title,
  items,
}: {
  title: string;
  items: { href: string; label: string }[];
}) {
  return (
    <div className="card p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {items.length === 0 ? <li className="text-muted">None yet</li> : null}
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="text-ink hover:underline">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
