import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/app-shell";
import { ExpandableListTable } from "@/components/expandable-list-table";
import { UpgradeNotice } from "@/components/upgrade-notice";
import { duplicateQuoteAction } from "@/lib/actions/data";
import { formatDisplayDate, previewText } from "@/lib/format";
import { getQuotes } from "@/lib/queries";
import { cad } from "@/lib/money";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string }>;
}) {
  const { upgrade } = await searchParams;
  const rows = await getQuotes();
  return (
    <div>
      <PageHeader
        title="Quotes"
        subtitle="Draft a quote, print the PDF, then mark it sent or approved."
        action={
          <Link href="/app/quotes/new" className="btn btn-primary">
            New quote
          </Link>
        }
      />
      {upgrade === "duplicate" ? (
        <UpgradeNotice>Duplicating quotes is on Solo. Upgrade to copy a quote as a starting point.</UpgradeNotice>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState
          title="Write your first quote"
          body="Add a client first if you haven’t. Line items can be materials or labour. Print to PDF from the quote."
          href="/app/quotes/new"
          cta="New quote"
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
          rows={rows.map((q) => ({
            id: q.id,
            label: q.quoteNumber,
            href: `/app/quotes/${q.id}`,
            cells: [
              { kind: "text", value: q.client?.name || "—", className: "text-muted" },
              { kind: "status", status: q.status },
              { kind: "text", value: cad(q.total), className: "block text-right tabular-nums" },
              {
                kind: "actions",
                items: [
                  {
                    kind: "link",
                    href: `/app/quotes/${q.id}/print`,
                    label: "View as PDF",
                    external: true,
                  },
                  { kind: "form", action: duplicateQuoteAction, id: q.id, label: "Duplicate" },
                ],
              },
            ],
            details: [
              { label: "Client", value: q.client?.name || "—" },
              {
                label: "Job",
                value: q.job?.title || "—",
                href: q.job ? `/app/jobs/${q.job.id}` : undefined,
              },
              { label: "Status", value: q.status, status: q.status },
              { label: "Subtotal", value: cad(q.subtotal) },
              { label: "Tax", value: cad(q.tax) },
              { label: "Total", value: cad(q.total) },
              { label: "Valid until", value: formatDisplayDate(q.validUntil) },
              { label: "Created", value: formatDisplayDate(q.createdAt) },
              { label: "Last updated", value: formatDisplayDate(q.updatedAt) },
              { label: "Notes", value: previewText(q.notes) },
            ],
          }))}
        />
      )}
    </div>
  );
}
