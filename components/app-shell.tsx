"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  HardHat,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings,
  Users,
} from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";

const links = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/clients", label: "Clients", icon: Users },
  { href: "/app/jobs", label: "Jobs", icon: HardHat },
  { href: "/app/quotes", label: "Quotes", icon: FileText },
  { href: "/app/invoices", label: "Invoices", icon: Receipt },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  businessName,
  children,
}: {
  businessName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPrint = pathname.endsWith("/print");

  if (isPrint) return <>{children}</>;

  return (
    <div className="flex min-h-screen">
      <aside className="no-print flex w-60 flex-col border-r border-line bg-navy text-white">
        <div className="px-5 py-5">
          <Link href="/app" className="text-base font-semibold tracking-tight">
            Trades Planner
          </Link>
          <p className="mt-1 truncate text-xs text-white/70">{businessName || "Your business"}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {links.map((link) => {
            const active = pathname === link.href || (link.href !== "/app" && pathname.startsWith(link.href));
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  active ? "bg-white/15" : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={16} />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <form action={logoutAction} className="p-3">
          <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/70 hover:bg-white/10 hover:text-white">
            <LogOut size={16} />
            Log out
          </button>
        </form>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="no-print border-b border-line bg-amber-50 px-6 py-2 text-xs text-amber-950">
          Local mode — data lives in <code>data/sitebook.db</code>. Stripe is stubbed; every account is Pro.
        </div>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action}
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
    <div className="card px-8 py-12 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>
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
