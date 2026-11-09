"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { PanelLeft, Plus } from "lucide-react";
import type { PlanSummary } from "@/lib/services/plans";

const STORAGE_KEY = "tp-plans-sidebar";

function readSidebarOpen() {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored === "open" || stored === "closed") return stored === "open";
    return window.matchMedia("(min-width: 1024px)").matches;
  } catch {
    return false;
  }
}

function subscribeSidebar() {
  return () => {};
}

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

function NewPlanLink({ onPick }: { onPick?: () => void }) {
  return (
    <Link href="/app" onClick={onPick} className="btn btn-primary btn-sm">
      <Plus className="mr-1 inline h-4 w-4" aria-hidden />
      New plan
    </Link>
  );
}

/** Chat list beside the Plan thread. Open by default on a wide screen, and it can be closed. */
export function PlanSidebar({
  plans,
  currentId,
  children,
}: {
  plans: PlanSummary[];
  currentId: string | null;
  children: ReactNode;
}) {
  const persisted = useSyncExternalStore(subscribeSidebar, readSidebarOpen, () => false);
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? persisted;

  function setSidebar(next: boolean) {
    setOverride(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, next ? "open" : "closed");
    } catch {
      // Private mode can block storage. The sidebar still toggles for this view.
    }
  }

  function sidebar(closeOnPick: boolean) {
    const close = closeOnPick ? () => setSidebar(false) : undefined;
    return (
      <>
        <div className="flex items-center justify-between gap-2 px-3 py-3">
          <button type="button" className="btn btn-ghost btn-sm" aria-label="Hide plans" onClick={() => setSidebar(false)}>
            <PanelLeft className="h-4 w-4" aria-hidden />
          </button>
          <NewPlanLink onPick={close} />
        </div>
        <PlanRows plans={plans} currentId={currentId} onPick={close} />
      </>
    );
  }

  return (
    <div className="-mx-4 -my-6 flex min-h-0 flex-1 sm:-mx-6 sm:-my-8">
      {open ? <aside className="hidden w-64 shrink-0 flex-col border-r border-line lg:flex">{sidebar(false)}</aside> : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className={`flex items-center gap-2 border-b border-line px-4 py-2 ${open ? "lg:hidden" : ""}`}>
          <button type="button" className="btn btn-ghost btn-sm" aria-label="Show plans" onClick={() => setSidebar(true)}>
            <PanelLeft className="h-4 w-4" aria-hidden />
          </button>
          {open ? null : <NewPlanLink />}
        </div>
        {open ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close plans" onClick={() => setSidebar(false)} />
            <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-card">{sidebar(true)}</aside>
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6">{children}</div>
      </div>
    </div>
  );
}
