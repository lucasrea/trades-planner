import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { CaptureBar } from "@/components/capture-bar";
import { ReceiptUpload } from "@/components/receipt-upload";
import { JobEditForm, JobStatusForm } from "@/components/job-form";
import { LineEditor } from "@/components/line-editor";
import { JobDocumentActions } from "@/components/job-document-actions";
import { StatusBadge } from "@/components/status-badge";
import { actionErrorNotice } from "@/lib/action-errors";
import { getContractor } from "@/lib/auth";
import { isOverdue, type DocStatus, type DocType } from "@/lib/documents";
import { calendarDateInTimeZone } from "@/lib/format";
import { cad, computeTotals, type LineKind } from "@/lib/money";
import { getClients, getJob, getJobDocuments, getTrackedLines } from "@/lib/queries";

function asKind(kind: string): LineKind {
  if (kind === "labour" || kind === "other") return kind;
  return "material";
}

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { id } = await params;
  const raw = await searchParams;
  const notice = actionErrorNotice(Array.isArray(raw.error) ? raw.error[0] : raw.error);
  const job = await getJob(id);
  if (!job) notFound();
  const [contractor, tracked, docs, clients] = await Promise.all([
    getContractor(),
    getTrackedLines(id),
    getJobDocuments(id),
    getClients(),
  ]);

  const unbilled = tracked.filter((line) => !line.billedDocumentId);
  const unbilledTotal = computeTotals(
    unbilled.map((line) => ({
      id: line.id,
      kind: asKind(line.kind),
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: line.unitPrice,
    })),
    0,
  ).subtotal;

  const today = calendarDateInTimeZone();

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title={job.title}
        subtitle={job.client?.name}
        back={{ href: "/app/jobs", label: "Jobs" }}
        action={<StatusBadge status={job.status} />}
      />
      <JobDocumentActions jobId={job.id} unbilledCount={unbilled.length} unbilledTotal={cad(unbilledTotal)} />
      {notice ? (
        <p className="text-sm text-danger" role="alert">
          {notice}
        </p>
      ) : null}
      <div className="space-y-2.5">
        <CaptureBar
          lockedJob={{ id: job.id, title: job.title, clientName: job.client?.name ?? null }}
        />
        <ReceiptUpload lockedJob={{ id: job.id, title: job.title, clientName: job.client?.name ?? null }} compact />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <JobEditForm
          job={{
            id: job.id,
            title: job.title,
            clientId: job.clientId,
            siteAddress: job.siteAddress,
            notes: job.notes,
          }}
          clients={clients}
        />
        <div className="space-y-4">
          <div className="card p-5">
            <JobStatusForm jobId={job.id} status={job.status} />
          </div>
          <div className="card p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">Documents</h2>
              <span className="rounded-full bg-elevated px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted">
                {docs.length}
              </span>
            </div>
            {docs.length === 0 ? (
              <p className="mt-2 text-sm text-muted">None yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {docs.map((doc) => {
                  const badge =
                    (doc.type === "quote" || doc.type === "invoice") &&
                    isOverdue(
                      { type: doc.type as DocType, status: doc.status as DocStatus, dueDate: doc.dueDate },
                      today,
                    )
                      ? "overdue"
                      : doc.status;
                  return (
                    <li key={doc.id}>
                      <Link
                        href={`/app/documents/${doc.id}`}
                        className="-mx-2 flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-elevated"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">
                            {doc.type === "quote" ? "Quote" : "Invoice"} {doc.number}
                          </p>
                          <div className="mt-1">
                            <StatusBadge status={badge} />
                          </div>
                        </div>
                        <span className="shrink-0 tabular-nums text-muted">{cad(doc.total)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
      <section>
        <h2 className="text-lg font-semibold">Tracked lines</h2>
        <p className="mb-3 mt-1 text-sm text-muted">
          These stay unbilled until you create an invoice from them. A line marked “On an invoice” was copied onto an invoice and can no longer be edited.
        </p>
        <LineEditor
          lines={tracked.map((line) => ({
            id: line.id,
            kind: asKind(line.kind),
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            unitPrice: line.unitPrice,
          }))}
          taxRate={contractor.taxRate}
          taxLabel={contractor.taxLabel}
          labourRate={contractor.labourRateHourly}
          persist={{
            jobId: job.id,
            lockedIds: tracked.filter((line) => line.billedDocumentId).map((line) => line.id),
          }}
        />
      </section>
    </div>
  );
}
