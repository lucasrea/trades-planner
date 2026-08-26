"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogOut, Settings } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import type { AuthUser } from "@/lib/auth";

function initials(name: string, email: string) {
  const fromName = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  return (fromName || email[0] || "?").toUpperCase();
}

export function UserAvatar({
  user,
  size = 36,
}: {
  user: AuthUser;
  size?: number;
}) {
  const label = user.name || user.email || "Account";
  if (user.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.image}
        alt={label}
        width={size}
        height={size}
        className="rounded-full object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-ivory/15 text-xs font-semibold text-ivory ring-1 ring-ivory/25"
      style={{ width: size, height: size }}
    >
      {initials(user.name, user.email)}
    </span>
  );
}

export function UserMenu({ user }: { user: AuthUser }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const label = user.name || user.email || "Account";

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        className="rounded-full outline-none ring-offset-2 ring-offset-card focus-visible:ring-2 focus-visible:ring-accent"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((value) => !value)}
      >
        <UserAvatar user={user} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-card py-1 shadow-lg"
        >
          <div className="border-b border-line px-3 py-2">
            <p className="truncate text-sm font-medium">{label}</p>
            {user.email ? <p className="truncate text-xs text-muted">{user.email}</p> : null}
          </div>
          <Link
            href="/app/settings"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-paper"
            onClick={() => setOpen(false)}
          >
            <Settings size={15} />
            Settings
          </Link>
          <form action={logoutAction}>
            <button
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-paper"
            >
              <LogOut size={15} />
              Log out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
