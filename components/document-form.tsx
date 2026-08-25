"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { LineEditor } from "@/components/line-editor";
import { Field } from "@/components/app-shell";
import { useActionRedirect } from "@/components/use-action-redirect";
import { saveInvoiceAction, saveQuoteAction } from "@/lib/actions/data";
import type { DraftLine } from "@/lib/money";

type Option = { id: string; label: string; clientId?: string };

export function DocumentForm({
  kind,
  clients,
  jobs,
  taxRate,
  taxLabel,
  labourRate,
  initial,
}: {
  kind: "quote" | "invoice";
  clients: Option[];
  jobs: Option[];
  taxRate: number;
  taxLabel: string;
  labourRate: number;
  initial?: {
    id?: string;
    clientId?: string;
    jobId?: string | null;
    status?: string;
    notes?: string;
    date?: string | null;
    quoteId?: string | null;
    lines?: DraftLine[];
  };
}) {
  const action = kind === "quote" ? saveQuoteAction : saveInvoiceAction;
  const [state, formAction, pending] = useActionState(action, null);
  useActionRedirect(state);
  const [clientId, setClientId] = useState(initial?.clientId || "");
  const visibleJobs = useMemo(
    () => jobs.filter((j) => !clientId || !j.clientId || j.clientId === clientId),
    [jobs, clientId],
  );
  const editing = Boolean(initial?.id);
  const listHref = kind === "quote" ? "/app/quotes" : "/app/invoices";
  const cancelHref =
    editing && initial?.id ? `${listHref}/${initial.id}` : listHref;
  const saveLabel = kind === "quote" ? (editing ? "Save quote" : "Create quote") : editing ? "Save invoice" : "Create invoice";

  return (
    <form action={formAction} className="space-y-6">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      {kind === "invoice" && initial?.quoteId ? (
        <input type="hidden" name="quoteId" value={initial.quoteId} />
      ) : null}

      <div className="card grid gap-4 p-6 sm:grid-cols-2">
        <Field label="Client">
          <select
            className="input"
            name="clientId"
            required
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">Select client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Job (optional)">
          <select className="input" name="jobId" defaultValue={initial?.jobId || ""} key={clientId}>
            <option value="">No job yet</option>
            {visibleJobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select className="input" name="status" defaultValue={initial?.status || "draft"}>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            {kind === "quote" ? (
              <>
                <option value="approved">Approved</option>
                <option value="declined">Declined</option>
              </>
            ) : (
              <>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </>
            )}
          </select>
        </Field>
        <Field label={kind === "quote" ? "Valid until" : "Due date"}>
          <input
            className="input"
            type="date"
            name={kind === "quote" ? "validUntil" : "dueDate"}
            defaultValue={initial?.date || ""}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes (shown on the PDF)">
            <textarea className="input min-h-20" name="notes" defaultValue={initial?.notes || ""} />
          </Field>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold">Line items</h2>
        <LineEditor
          initial={initial?.lines}
          taxRate={taxRate}
          taxLabel={taxLabel}
          labourRate={labourRate}
        />
      </div>

      {state?.error ? (
        <p className="text-sm text-accent" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : saveLabel}
        </button>
        <Link href={cancelHref} className="btn btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}
