"use client";

import Link from "next/link";

export function PrintToolbar({ backHref }: { backHref: string }) {
  return (
    <div className="no-print flex items-center justify-between border-b border-line bg-paper px-6 py-3">
      <Link href={backHref} className="text-sm text-muted hover:text-ink">
        ← Back to document
      </Link>
      <button type="button" className="btn btn-primary" onClick={() => window.print()}>
        Print / Save as PDF
      </button>
    </div>
  );
}
