import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/app-shell";
import { ExpandableListTable } from "@/components/expandable-list-table";
import { formatDisplayDate, previewText } from "@/lib/format";
import { getInvoices } from "@/lib/queries";
import { cad } from "@/lib/money";

export default async function InvoicesPage() {
  const rows = await getInvoices();
  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Create from a quote or from scratch. Mark paid when the e-transfer lands."
        action={
          <Link href="/app/invoices/new" className="btn btn-primary">
            New invoice
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          body="Open a quote and hit Create invoice, or start a blank one."
          href="/app/invoices/new"
          cta="New invoice"
        />
      ) : (
        <ExpandableListTable
          columns={[
            { label: "Number" },
            { label: "Client" },
            { label: "Status" },
            { label: "Total", align: "right" },
            { label: "Actions", align: "right" },
          ]}
          rows={rows.map((inv) => ({
            id: inv.id,
            label: inv.invoiceNumber,
            href: `/app/invoices/${inv.id}`,
            cells: [
              { kind: "text", value: inv.client?.name || "—", className: "text-muted" },
              { kind: "status", status: inv.status },
              { kind: "text", value: cad(inv.total), className: "block text-right tabular-nums" },
              {
                kind: "action",
                href: `/app/invoices/${inv.id}/print`,
                label: "View as PDF",
                external: true,
              },
            ],
            details: [
              { label: "Client", value: inv.client?.name || "—" },
              {
                label: "Source quote",
                value: inv.quote?.quoteNumber || "—",
                href: inv.quote ? `/app/quotes/${inv.quote.id}` : undefined,
              },
              {
                label: "Job",
                value: inv.job?.title || "—",
                href: inv.job ? `/app/jobs/${inv.job.id}` : undefined,
              },
              { label: "Status", value: inv.status, status: inv.status },
              { label: "Subtotal", value: cad(inv.subtotal) },
              { label: "Tax", value: cad(inv.tax) },
              { label: "Total", value: cad(inv.total) },
              { label: "Due date", value: formatDisplayDate(inv.dueDate) },
              { label: "Created", value: formatDisplayDate(inv.createdAt) },
              { label: "Last updated", value: formatDisplayDate(inv.updatedAt) },
              { label: "Notes", value: previewText(inv.notes) },
            ],
          }))}
        />
      )}
    </div>
  );
}
