"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { PanelLeft, Plus } from "lucide-react";
import { groupPlansByJob } from "@/lib/plans";
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

function PlanRows({
  plans,
  currentId,
  onPick,
  onSelectPlan,
}: {
  plans: PlanSummary[];
  currentId: string | null;
  onPick?: () => void;
  onSelectPlan?: (planId: string) => void;
}) {
  if (plans.length === 0) return <p className="px-4 py-3 text-sm text-muted">No plans yet.</p>;
  const groups = groupPlansByJob(plans);
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-3">
      {groups.map((group) => (
        <section key={group.jobTitle ?? ""}>
          <h2 className="truncate px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted/80">
            {group.jobTitle ?? "No job"}
          </h2>
          <ul className="space-y-0.5">
            {group.plans.map((plan) => {
              const active = plan.id === currentId;
              return (
                <li key={plan.id}>
                  {onSelectPlan ? (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectPlan(plan.id);
                        onPick?.();
                      }}
                      className={`block w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        active
                          ? "bg-elevated font-medium text-ink"
                          : "text-muted hover:bg-elevated/60 hover:text-ink"
                      }`}
                      aria-current={active ? "page" : undefined}
                    >
                      {plan.title}
                    </button>
                  ) : (
                    <Link
                      href={`/app?plan=${encodeURIComponent(plan.id)}`}
                      scroll={false}
                      onClick={onPick}
                      className={`block truncate rounded-lg px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-elevated font-medium text-ink"
                          : "text-muted hover:bg-elevated/60 hover:text-ink"
                      }`}
                      aria-current={active ? "page" : undefined}
                    >
                      {plan.title}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function NewPlanLink({ onPick, onNewPlan }: { onPick?: () => void; onNewPlan?: () => void }) {
  if (onNewPlan) {
    return (
      <button type="button" onClick={() => { onNewPlan(); onPick?.(); }} className="btn btn-primary btn-sm">
        <Plus className="h-4 w-4" aria-hidden />
        New plan
      </button>
    );
  }
  return (
    <Link href="/app" onClick={onPick} className="btn btn-primary btn-sm">
      <Plus className="h-4 w-4" aria-hidden />
      New plan
    </Link>
  );
}

/** Chat list beside the Plan thread. Open by default on a wide screen, and it can be closed. */
export function PlanSidebar({
  plans,
  currentId,
  children,
  onSelectPlan,
}: {
  plans: PlanSummary[];
  currentId: string | null;
  children: ReactNode;
  /** Client-side plan switch without reloading the Plan page. */
  onSelectPlan?: (planId: string | null) => void;
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

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && window.matchMedia("(max-width: 1023px)").matches) {
        setOverride(false);
        try {
          sessionStorage.setItem(STORAGE_KEY, "closed");
        } catch {
          // ignore storage errors
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function sidebar(closeOnPick: boolean) {
    const close = closeOnPick ? () => setSidebar(false) : undefined;
    return (
      <>
        <div className="flex items-center justify-between gap-2 px-3 py-3">
          <button type="button" className="btn btn-ghost btn-sm" aria-label="Hide plans" onClick={() => setSidebar(false)}>
            <PanelLeft className="h-4 w-4" aria-hidden />
          </button>
          <NewPlanLink onPick={close} onNewPlan={onSelectPlan ? () => onSelectPlan(null) : undefined} />
        </div>
        <PlanRows
          plans={plans}
          currentId={currentId}
          onPick={close}
          onSelectPlan={onSelectPlan ? (id) => onSelectPlan(id) : undefined}
        />
      </>
    );
  }

  return (
    <div className="-mx-4 -my-6 flex min-h-0 flex-1 sm:-mx-6 sm:-my-8">
      {open ? (
        <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-navy/50 lg:flex">{sidebar(false)}</aside>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className={`flex items-center gap-2 border-b border-line px-4 py-2 ${open ? "lg:hidden" : ""}`}>
          <button type="button" className="btn btn-ghost btn-sm" aria-label="Show plans" onClick={() => setSidebar(true)}>
            <PanelLeft className="h-4 w-4" aria-hidden />
          </button>
          {open ? null : (
            <NewPlanLink onNewPlan={onSelectPlan ? () => onSelectPlan(null) : undefined} />
          )}
        </div>
        {open ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
              aria-label="Close plans"
              onClick={() => setSidebar(false)}
            />
            <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-navy shadow-2xl">
              {sidebar(true)}
            </aside>
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6">{children}</div>
      </div>
    </div>
  );
}
