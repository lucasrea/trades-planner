"use client";

import { createDraftDocumentAction, createInvoiceFromTrackedLinesAction } from "@/lib/actions/documents";
import { FormSubmitButton } from "@/components/form-submit";

export function JobDocumentActions({
  jobId,
  unbilledCount = 0,
  unbilledTotal,
}: {
  jobId: string;
  unbilledCount?: number;
  /** Formatted by the server with lib/money.ts. */
  unbilledTotal?: string;
}) {
  const hasUnbilled = unbilledCount > 0;
  const newDocs = (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap [&>*]:w-full sm:[&>*]:w-auto">
      <form action={createDraftDocumentAction}>
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="type" value="quote" />
        <FormSubmitButton
          label="New quote"
          pendingLabel="Creating…"
          className={hasUnbilled ? "btn btn-ghost w-full" : "btn btn-primary w-full"}
        />
      </form>
      <form action={createDraftDocumentAction}>
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="type" value="invoice" />
        <FormSubmitButton
          label="New invoice"
          pendingLabel="Creating…"
          className={hasUnbilled ? "btn btn-ghost w-full" : "btn btn-navy w-full"}
        />
      </form>
    </div>
  );

  if (!hasUnbilled) return newDocs;

  return (
    <div className="card space-y-4 p-4 sm:p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Unbilled</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{unbilledTotal}</p>
        <p className="text-sm text-muted">
          {unbilledCount} tracked {unbilledCount === 1 ? "line" : "lines"}, before tax
        </p>
      </div>
      <form action={createInvoiceFromTrackedLinesAction}>
        <input type="hidden" name="jobId" value={jobId} />
        <FormSubmitButton
          label="Create invoice from tracked lines"
          pendingLabel="Creating…"
          className="btn btn-primary w-full sm:w-auto"
        />
      </form>
      {newDocs}
    </div>
  );
}
