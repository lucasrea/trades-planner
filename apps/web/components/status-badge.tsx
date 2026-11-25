"use client";

import { statusClass, statusDotClass, statusLabel } from "@/lib/status";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(status)}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClass(status)}`} aria-hidden />
      {statusLabel(status)}
    </span>
  );
}
