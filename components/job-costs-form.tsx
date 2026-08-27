"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ActionError } from "@/components/action-error";
import { deleteJobCostAction, saveJobCostAction } from "@/lib/actions/data";
import { defaultSellPrice, jobCostKinds, type JobCostKind } from "@/lib/job-costs";
import { cad } from "@/lib/money";
import type { ActionState } from "@/components/use-action-redirect";

export type JobCostRow = {
  id: string;
  kind: string;
  description: string;
  quantity: number;
  unit: string;
  cost: number;
  unitPrice: number;
  lineTotal: number;
};

const kindLabel: Record<string, string> = {
  material: "Material",
  expense: "Expense",
  labour: "Labour",
};

export function JobCostsForm({
  jobId,
  costs,
  labourRate,
  markupPct,
}: {
  jobId: string;
  costs: JobCostRow[];
  labourRate: number;
  markupPct: number;
}) {
  const [state, formAction, pending] = useActionState(saveJobCostAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold">Materials & expenses</h2>
      <p className="mt-1 text-sm text-muted">
        What you used on this job. Create an invoice from these lines when you’re ready to bill.
      </p>

      {costs.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-paper text-left text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium">Qty</th>
                <th className="px-3 py-2 font-medium">Cost</th>
                <th className="px-3 py-2 font-medium">Price</th>
                <th className="px-3 py-2 font-medium">Line</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {costs.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-3 py-2 text-muted">{kindLabel[row.kind] || row.kind}</td>
                  <td className="px-3 py-2">
                    {row.description}{" "}
                    <span className="text-muted">
                      ({row.quantity} {row.unit})
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{row.quantity}</td>
                  <td className="px-3 py-2 tabular-nums">{cad(row.cost)}</td>
                  <td className="px-3 py-2 tabular-nums">{cad(row.unitPrice)}</td>
                  <td className="px-3 py-2 font-medium tabular-nums">{cad(row.lineTotal)}</td>
                  <td className="px-2 py-2">
                    <form action={deleteJobCostAction}>
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name="jobId" value={jobId} />
                      <button
                        type="submit"
                        className="rounded-lg p-2 text-muted hover:bg-paper hover:text-accent"
                        aria-label={`Remove ${row.description}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">No costs yet. Add a material, expense, or labour line.</p>
      )}

      <AddCostForm
        key={costs.length}
        jobId={jobId}
        labourRate={labourRate}
        markupPct={markupPct}
        formAction={formAction}
        pending={pending}
        state={state}
      />
    </div>
  );
}

function AddCostForm({
  jobId,
  labourRate,
  markupPct,
  formAction,
  pending,
  state,
}: {
  jobId: string;
  labourRate: number;
  markupPct: number;
  formAction: (formData: FormData) => void;
  pending: boolean;
  state: ActionState;
}) {
  const [kind, setKind] = useState<JobCostKind>("material");
  const [cost, setCost] = useState("0");
  const [unitPrice, setUnitPrice] = useState("0");
  const [unit, setUnit] = useState("ea");
  const shouldMarkup = markupPct > 0;

  function applyKind(next: JobCostKind) {
    setKind(next);
    if (next === "labour") {
      setUnit("hr");
      setUnitPrice(String(labourRate));
      return;
    }
    setUnit("ea");
    setUnitPrice(
      String(
        defaultSellPrice(next, Number(cost) || 0, {
          markupPct,
          labourRate,
          applyMarkup: shouldMarkup,
        }),
      ),
    );
  }

  function applyCost(value: string) {
    setCost(value);
    if (kind === "labour") return;
    setUnitPrice(
      String(
        defaultSellPrice(kind, Number(value) || 0, {
          markupPct,
          labourRate,
          applyMarkup: shouldMarkup,
        }),
      ),
    );
  }

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <input type="hidden" name="jobId" value={jobId} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Type</span>
          <select
            className="input"
            name="kind"
            value={kind}
            onChange={(e) => applyKind(e.target.value as JobCostKind)}
          >
            {jobCostKinds.map((value) => (
              <option key={value} value={value}>
                {kindLabel[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2 lg:col-span-2">
          <span className="mb-1.5 block text-sm font-medium">Description</span>
          <input
            className="input"
            name="description"
            required
            placeholder={kind === "labour" ? "Rough-in, 3 hours" : "1/2 in PEX, dump fee"}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Qty</span>
          <input className="input" name="quantity" type="number" step="0.01" defaultValue={1} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Unit</span>
          <input className="input" name="unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Your cost</span>
          <input
            className="input"
            name="cost"
            type="number"
            step="0.01"
            value={cost}
            onChange={(e) => applyCost(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Client price</span>
          <input
            className="input"
            name="unitPrice"
            type="number"
            step="0.01"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
          {shouldMarkup && kind !== "labour" ? (
            <span className="mt-1 block text-[11px] text-muted">
              Includes {markupPct}% markup. You can edit it.
            </span>
          ) : null}
        </label>
      </div>
      <div className="flex justify-end">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Adding…" : "Add to job"}
        </button>
      </div>
      <ActionError state={state} />
    </form>
  );
}
