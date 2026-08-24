import Link from "next/link";
import { EmptyState, PageHeader, TableCard } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { getQuotes } from "@/lib/queries";
import { cad } from "@/lib/money";

export default async function QuotesPage() {
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
      {rows.length === 0 ? (
        <EmptyState
          title="Write your first quote"
          body="Add a client first if you haven’t. Line items can be materials or labour. Print to PDF from the quote."
          href="/app/quotes/new"
          cta="New quote"
        />
      ) : (
        <TableCard>
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-paper text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Number</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <tr key={q.id} className="border-t border-line hover:bg-paper/70">
                  <td className="px-4 py-3">
                    <Link href={`/app/quotes/${q.id}`} className="font-medium hover:underline">
                      {q.quoteNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{q.client?.name || "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={q.status} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{cad(q.total)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/app/quotes/${q.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm"
                    >
                      View as PDF
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      )}
    </div>
  );
}
