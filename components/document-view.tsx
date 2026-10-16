"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, PageHeader, TableCard } from "@/components/app-shell";
import { LineEditor } from "@/components/line-editor";
import { StatusBadge } from "@/components/status-badge";
import { ActionError } from "@/components/action-error";
import {
  addTrackedLinesToInvoiceAction,
  createInvoiceFromQuoteAction,
  deleteDraftDocumentAction,
  saveDocumentAction,
  setDocumentStatusAction,
} from "@/lib/actions/documents";
import { FormSubmitButton } from "@/components/form-submit";
import { buildMailto, type DocType } from "@/lib/documents";
import { formatDisplayDate, formatTaxRateLabel } from "@/lib/format";
import { cad, type LineKind } from "@/lib/money";

const kindLabel: Record<string, string> = {
  material: "Material",
  labour: "Labour",
  other: "Other",
};

export type DocumentViewData = {
  id: string;
  jobId: string;
  type: string;
  status: string;
  number: string;
  notes: string;
  validUntil: string | null;
  dueDate: string | null;
  subtotal: number;
  tax: number;
  total: number;
  client: { name: string; email: string } | null;
  job: { id: string; title: string } | null;
  lines: {
    id: string;
    kind: string;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    lineTotal: number;
  }[];
};

function StatusButton({
  documentId,
  next,
  label,
  className,
}: {
  documentId: string;
  next: string;
  label: string;
  className: string;
}) {
  return (
    <form action={setDocumentStatusAction}>
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="next" value={next} />
      <FormSubmitButton label={label} className={className} />
    </form>
  );
}

function DocumentMetaForm({
  documentId,
  type,
  notes,
  validUntil,
  dueDate,
}: {
  documentId: string;
  type: string;
  notes: string;
  validUntil: string | null;
  dueDate: string | null;
}) {
  const [state, action, pending] = useActionState(saveDocumentAction, null);
  const isQuote = type === "quote";

  return (
    <form action={action} className="card mt-6 space-y-4 p-6">
      <input type="hidden" name="documentId" value={documentId} />
      <Field label="Notes">
        <textarea className="input min-h-24" name="notes" defaultValue={notes} />
      </Field>
      {isQuote ? (
        <Field label="Valid until">
          <input className="input" type="date" name="validUntil" defaultValue={validUntil ?? ""} />
        </Field>
      ) : (
        <Field label="Due date">
          <input className="input" type="date" name="dueDate" defaultValue={dueDate ?? ""} />
        </Field>
      )}
      <ActionError state={state} />
      {state?.ok ? <p className="text-sm text-muted">Saved.</p> : null}
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save details"}
      </button>
    </form>
  );
}

export function DocumentView({
  document,
  taxLabel,
  taxRate,
  labourRate,
  businessName,
  etransferEmail,
  etransferNote,
  displayStatus,
  unbilledCount,
}: {
  document: DocumentViewData;
  taxLabel: string;
  taxRate: number;
  labourRate: number;
  businessName: string;
  etransferEmail: string;
  etransferNote: string;
  displayStatus: string;
  unbilledCount: number;
}) {
  const isQuote = document.type === "quote";
  const typeLabel = isQuote ? "Quote" : "Invoice";
  const draft = document.status === "draft";
  const dateLabel = isQuote ? "Valid until" : "Due date";
  const dateValue = isQuote ? document.validUntil : document.dueDate;
  const showTax = taxRate > 0;
  const clientEmail = document.client?.email.trim() ?? "";
  const etransferInstructions = etransferEmail.trim()
    ? `Pay by e-transfer to ${etransferEmail.trim()}${etransferNote.trim() ? `. ${etransferNote.trim()}` : "."}`
    : "";
  const mailto = clientEmail
    ? buildMailto({
        businessName,
        type: (isQuote ? "quote" : "invoice") as DocType,
        number: document.number,
        clientEmail,
        total: document.total,
        dueOrValid: dateValue,
        etransferInstructions,
      })
    : null;

  return (
    <div>
      <PageHeader
        title={document.number}
        subtitle={typeLabel}
        back={{ href: "/app/documents", label: "Documents" }}
        action={<StatusBadge status={displayStatus} />}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {draft ? <StatusButton documentId={document.id} next="sent" label="Mark sent" className="btn btn-navy" /> : null}
        {isQuote && document.status === "sent" ? (
          <>
            <StatusButton documentId={document.id} next="approved" label="Approve" className="btn btn-primary" />
            <StatusButton documentId={document.id} next="declined" label="Decline" className="btn btn-ghost" />
          </>
        ) : null}
        {isQuote && document.status === "approved" ? (
          <form action={createInvoiceFromQuoteAction}>
            <input type="hidden" name="quoteId" value={document.id} />
            <FormSubmitButton label="Create invoice" pendingLabel="Creating…" className="btn btn-primary" />
          </form>
        ) : null}
        {!isQuote && draft && unbilledCount > 0 ? (
          <form action={addTrackedLinesToInvoiceAction}>
            <input type="hidden" name="documentId" value={document.id} />
            <FormSubmitButton
              label={`Add unbilled job lines (${unbilledCount})`}
              pendingLabel="Adding…"
              className="btn btn-navy"
            />
          </form>
        ) : null}
        {!isQuote && document.status === "sent" ? (
          <StatusButton documentId={document.id} next="paid" label="Mark paid" className="btn btn-primary" />
        ) : null}
        {draft ? (
          <form action={deleteDraftDocumentAction}>
            <input type="hidden" name="documentId" value={document.id} />
            <FormSubmitButton label="Delete draft" pendingLabel="Deleting…" className="btn btn-ghost" />
          </form>
        ) : null}
        {mailto ? (
          <a href={mailto} className="btn btn-ghost">
            Email
          </a>
        ) : (
          <span className="self-center text-sm text-muted">No client email</span>
        )}
        <Link
          href={`/app/documents/${document.id}/print`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost"
        >
          Print
        </Link>
      </div>

      <div className="card mb-6 grid gap-4 p-6 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Client</p>
          <p className="mt-1 font-medium">{document.client?.name || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Job</p>
          {document.job ? (
            <Link href={`/app/jobs/${document.job.id}`} className="mt-1 inline-block font-medium hover:underline">
              {document.job.title}
            </Link>
          ) : (
            <p className="mt-1 text-muted">—</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{dateLabel}</p>
          <p className="mt-1">{formatDisplayDate(dateValue)}</p>
        </div>
      </div>

      {draft ? (
        <LineEditor
          lines={document.lines.map((line) => ({
            id: line.id,
            kind: (line.kind === "labour" || line.kind === "other" ? line.kind : "material") as LineKind,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            unitPrice: line.unitPrice,
          }))}
          taxRate={taxRate}
          taxLabel={taxLabel}
          labourRate={labourRate}
          persist={{ jobId: document.jobId, documentId: document.id }}
        />
      ) : (
        <>
          <TableCard>
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-paper text-left text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Unit</th>
                  <th className="px-4 py-3 text-right font-medium">Price</th>
                  <th className="px-4 py-3 text-right font-medium">Line</th>
                </tr>
              </thead>
              <tbody>
                {document.lines.length === 0 ? (
                  <tr className="border-t border-line">
                    <td colSpan={6} className="px-4 py-8 text-center text-muted">
                      No line items yet.
                    </td>
                  </tr>
                ) : (
                  document.lines.map((line) => (
                    <tr key={line.id} className="border-t border-line">
                      <td className="px-4 py-3">{kindLabel[line.kind] ?? line.kind}</td>
                      <td className="px-4 py-3">{line.description || "—"}</td>
                      <td className="px-4 py-3 tabular-nums">{line.quantity}</td>
                      <td className="px-4 py-3">{line.unit}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{cad(line.unitPrice)}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{cad(line.lineTotal)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableCard>
          <dl className="ml-auto mt-4 w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{cad(document.subtotal)}</dd>
            </div>
            {showTax ? (
              <div className="flex justify-between text-muted">
                <dt>{formatTaxRateLabel(taxLabel, document.subtotal, document.tax, taxRate)}</dt>
                <dd className="tabular-nums">{cad(document.tax)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{cad(document.total)}</dd>
            </div>
          </dl>
        </>
      )}

      {draft ? (
        <DocumentMetaForm
          documentId={document.id}
          type={document.type}
          notes={document.notes}
          validUntil={document.validUntil}
          dueDate={document.dueDate}
        />
      ) : (
        <div className="card mt-6 p-6">
          <h2 className="text-sm font-semibold">Notes</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-muted">{document.notes.trim() || "No notes."}</p>
        </div>
      )}
    </div>
  );
}
