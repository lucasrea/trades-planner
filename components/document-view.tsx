import Link from "next/link";
import { PageHeader, TableCard } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { formatDisplayDate } from "@/lib/format";
import { cad } from "@/lib/money";

const kindLabel: Record<string, string> = {
  material: "Material",
  labour: "Labour",
  other: "Other",
};

export type DocumentViewData = {
  id: string;
  type: string;
  number: string;
  notes: string;
  validUntil: string | null;
  dueDate: string | null;
  subtotal: number;
  tax: number;
  total: number;
  client: { name: string } | null;
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

export function DocumentView({
  document,
  taxLabel,
  taxRate,
  displayStatus,
}: {
  document: DocumentViewData;
  taxLabel: string;
  taxRate: number;
  displayStatus: string;
}) {
  const isQuote = document.type === "quote";
  const typeLabel = isQuote ? "Quote" : "Invoice";
  const dateLabel = isQuote ? "Valid until" : "Due date";
  const dateValue = isQuote ? document.validUntil : document.dueDate;
  const showTax = taxRate > 0;

  return (
    <div>
      <PageHeader
        title={document.number}
        subtitle={typeLabel}
        back={{ href: "/app/documents", label: "Documents" }}
        action={<StatusBadge status={displayStatus} />}
      />

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
            <dt>
              {taxLabel} ({Math.round(taxRate * 1000) / 10}%)
            </dt>
            <dd className="tabular-nums">{cad(document.tax)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{cad(document.total)}</dd>
        </div>
      </dl>

      <div className="card mt-6 p-6">
        <h2 className="text-sm font-semibold">Notes</h2>
        <p className="mt-2 whitespace-pre-line text-sm text-muted">{document.notes.trim() || "No notes."}</p>
      </div>
    </div>
  );
}
