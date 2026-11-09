import Link from "next/link";
import { Plus } from "lucide-react";
import { formatDisplayDate } from "@/lib/format";
import type { PlanSummary } from "@/lib/services/plans";

export function PlanList({ plans, currentId }: { plans: PlanSummary[]; currentId: string | null }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <details className="relative min-w-0">
        <summary className="btn btn-ghost btn-sm cursor-pointer list-none">Plans ({plans.length})</summary>
        <ul className="absolute left-0 top-full z-20 mt-1 max-h-72 w-80 max-w-[85vw] overflow-y-auto rounded-xl border border-line bg-card py-1 shadow-lg">
          {plans.length === 0 ? <li className="px-3 py-2 text-sm text-muted">No plans yet.</li> : null}
          {plans.map((plan) => (
            <li key={plan.id}>
              <Link
                href={`/app?plan=${encodeURIComponent(plan.id)}`}
                className={`block px-3 py-2 hover:bg-elevated ${plan.id === currentId ? "bg-elevated" : ""}`}
                aria-current={plan.id === currentId ? "page" : undefined}
              >
                <span className="block truncate text-sm">{plan.title}</span>
                <span className="block text-xs text-muted">{formatDisplayDate(plan.updatedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </details>
      <Link href="/app" className="btn btn-primary btn-sm">
        <Plus className="mr-1 inline h-4 w-4" aria-hidden />
        New plan
      </Link>
    </div>
  );
}
