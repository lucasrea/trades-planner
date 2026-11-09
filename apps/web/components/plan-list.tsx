"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { PlanSummary } from "@/lib/services/plans";

function PlanRows({ plans, currentId, onPick }: { plans: PlanSummary[]; currentId: string | null; onPick?: () => void }) {
  if (plans.length === 0) return <p className="px-3 py-2 text-sm text-muted">No plans yet.</p>;
  return (
    <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
      {plans.map((plan) => (
        <li key={plan.id}>
          <Link
            href={`/app?plan=${encodeURIComponent(plan.id)}`}
            onClick={onPick}
            className={`block rounded-lg px-3 py-2 hover:bg-elevated ${plan.id === currentId ? "bg-elevated" : ""}`}
            aria-current={plan.id === currentId ? "page" : undefined}
          >
            <span className="block truncate text-sm">{plan.title}</span>
            {plan.jobTitle ? (
              <span className="mt-1 inline-block max-w-full truncate rounded-full bg-paper px-2 py-0.5 text-xs text-muted">
                {plan.jobTitle}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Chat list beside the Plan thread. A drawer on a phone, a column on a wide screen. */
export function PlanSidebar({
  plans,
  currentId,
  children,
}: {
  plans: PlanSummary[];
  currentId: string | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const heading = (
    <div className="flex items-center justify-between gap-2 px-3 py-3">
      <p className="text-sm font-medium">Plans</p>
      <Link href="/app" onClick={() => setOpen(false)} className="btn btn-primary btn-sm">
        <Plus className="mr-1 inline h-4 w-4" aria-hidden />
        New plan
      </Link>
    </div>
  );

  return (
    <div className="-mx-4 -my-6 flex min-h-0 flex-1 sm:-mx-6 sm:-my-8">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line lg:flex">
        {heading}
        <PlanRows plans={plans} currentId={currentId} />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2 lg:hidden">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
            Plans ({plans.length})
          </button>
          <Link href="/app" className="btn btn-primary btn-sm">
            <Plus className="mr-1 inline h-4 w-4" aria-hidden />
            New plan
          </Link>
        </div>
        {open ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close plans" onClick={() => setOpen(false)} />
            <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-card">
              {heading}
              <PlanRows plans={plans} currentId={currentId} onPick={() => setOpen(false)} />
            </aside>
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6">{children}</div>
      </div>
    </div>
  );
}
