"use client";

import { createDraftDocumentAction, createInvoiceFromTrackedLinesAction } from "@/lib/actions/documents";
import { FormSubmitButton } from "@/components/form-submit";

export function JobDocumentActions({ jobId }: { jobId: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={createDraftDocumentAction}>
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="type" value="quote" />
        <FormSubmitButton label="New quote" pendingLabel="Creating…" className="btn btn-primary" />
      </form>
      <form action={createDraftDocumentAction}>
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="type" value="invoice" />
        <FormSubmitButton label="New invoice" pendingLabel="Creating…" className="btn btn-navy" />
      </form>
      <form action={createInvoiceFromTrackedLinesAction}>
        <input type="hidden" name="jobId" value={jobId} />
        <FormSubmitButton
          label="Create invoice from tracked lines"
          pendingLabel="Creating…"
          className="btn btn-ghost"
        />
      </form>
    </div>
  );
}
