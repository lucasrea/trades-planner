import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/app-shell";
import { ExpandableListTable } from "@/components/expandable-list-table";
import { isOverdue, type DocStatus, type DocType } from "@/lib/documents";
import { formatDisplayDate, previewText } from "@/lib/format";
import { cad } from "@/lib/money";
import { getDocuments, type DocumentListFilter } from "@/lib/queries";
import { statusLabel } from "@/lib/status";

const quoteStatuses = ["draft", "sent", "approved", "declined"] as const;
const invoiceStatuses = ["draft", "sent", "paid"] as const;
const allStatuses = ["draft", "sent", "approved", "declined", "paid"] as const;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function statusesFor(type?: DocumentListFilter["type"]) {
  if (type === "quote") return quoteStatuses;
  if (type === "invoice") return invoiceStatuses;
  return allStatuses;
}

function listHref(next: { type?: string; status?: string; cursor?: string }) {
  const params = new URLSearchParams();
  if (next.type) params.set("type", next.type);
  if (next.status) params.set("status", next.status);
  if (next.cursor) params.set("cursor", next.cursor);
  const query = params.toString();
  return query ? `/app/documents?${query}` : "/app/documents";
}

function displayStatus(
  doc: { type: string; status: string; dueDate: string | null },
  today: string,
) {
  if (doc.type !== "quote" && doc.type !== "invoice") return doc.status;
  return isOverdue(
    { type: doc.type as DocType, status: doc.status as DocStatus, dueDate: doc.dueDate },
    today,
  )
    ? "overdue"
    : doc.status;
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[]; status?: string | string[]; cursor?: string | string[] }>;
}) {
  const raw = await searchParams;
  const typeParam = one(raw.type);
  const statusParam = one(raw.status);
  const cursor = one(raw.cursor);
  const type = typeParam === "quote" || typeParam === "invoice" ? typeParam : undefined;
  const allowed = statusesFor(type);
  const status = statusParam && (allowed as readonly string[]).includes(statusParam) ? statusParam : undefined;
  const today = new Date().toISOString().slice(0, 10);
  const { items, nextCursor } = await getDocuments({ type, status }, cursor);
  const filtered = Boolean(type || status);

  return (
    <div>
      <PageHeader title="Documents" subtitle="Quotes and invoices in one list." />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Link href={listHref({ status })} className={type ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"}>
            All
          </Link>
          <Link
            href={listHref({ type: "quote", status: status && (quoteStatuses as readonly string[]).includes(status) ? status : undefined })}
            className={type === "quote" ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
          >
            Quotes
          </Link>
          <Link
            href={listHref({
              type: "invoice",
              status: status && (invoiceStatuses as readonly string[]).includes(status) ? status : undefined,
            })}
            className={type === "invoice" ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
          >
            Invoices
          </Link>
        </div>
        <form action="/app/documents" className="flex items-center gap-2">
          {type ? <input type="hidden" name="type" value={type} /> : null}
          <label className="flex items-center gap-2 text-sm text-muted">
            Status
            <select className="input" name="status" defaultValue={status ?? ""}>
              <option value="">All</option>
              {allowed.map((value) => (
                <option key={value} value={value}>
                  {statusLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-ghost btn-sm">Apply</button>
        </form>
      </div>

      {items.length === 0 ? (
        filtered ? (
          <div className="card px-8 py-14 text-center">
            <h2 className="text-lg font-semibold">No matching documents</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">Try another type or status.</p>
            <Link href="/app/documents" className="btn btn-ghost mt-6">
              Clear filters
            </Link>
          </div>
        ) : (
          <EmptyState
            title="No documents yet"
            body="Quotes and invoices are created from a job. Open a job to start a draft."
            href="/app/jobs"
            cta="Go to jobs"
          />
        )
      ) : (
        <>
          <ExpandableListTable
            columns={[
              { label: "Number" },
              { label: "Type" },
              { label: "Client" },
              { label: "Status" },
              { label: "Total", align: "right" },
            ]}
            rows={items.map((doc) => {
              const isQuote = doc.type === "quote";
              const badge = displayStatus(doc, today);
              return {
                id: doc.id,
                label: doc.number,
                href: `/app/documents/${doc.id}`,
                cells: [
                  { kind: "text" as const, value: isQuote ? "Quote" : "Invoice" },
                  { kind: "text" as const, value: doc.client?.name || "—", className: "text-muted" },
                  { kind: "status" as const, status: badge },
                  { kind: "text" as const, value: cad(doc.total), className: "block text-right tabular-nums" },
                ],
                details: [
                  { label: "Client", value: doc.client?.name || "—" },
                  {
                    label: "Job",
                    value: doc.job?.title || "—",
                    href: doc.job ? `/app/jobs/${doc.job.id}` : undefined,
                  },
                  { label: "Status", value: badge, status: badge },
                  { label: "Subtotal", value: cad(doc.subtotal) },
                  { label: "Tax", value: cad(doc.tax) },
                  { label: "Total", value: cad(doc.total) },
                  {
                    label: isQuote ? "Valid until" : "Due date",
                    value: formatDisplayDate(isQuote ? doc.validUntil : doc.dueDate),
                  },
                  { label: "Notes", value: previewText(doc.notes) },
                ],
              };
            })}
          />
          {nextCursor || cursor ? (
            <div className="mt-4 flex justify-end gap-2">
              {cursor ? (
                <Link href={listHref({ type, status })} className="btn btn-ghost btn-sm">
                  First page
                </Link>
              ) : null}
              {nextCursor ? (
                <Link href={listHref({ type, status, cursor: nextCursor })} className="btn btn-ghost btn-sm">
                  Next
                </Link>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
