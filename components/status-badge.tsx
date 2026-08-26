"use client";

import { statusClass, statusLabel } from "@/lib/status";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(status)}`}>
      {statusLabel(status)}
    </span>
  );
}
