import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/app-shell";
import { getQuotes } from "@/lib/queries";
import { cad } from "@/lib/money";

export default async function QuotesPage() {
  const rows = await getQuotes();
  return (
    <div>
      <PageHeader
        title="Quotes"
        subtitle="Draft, send (download PDF), then mark approved yourself for now."
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
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Number</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <tr key={q.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <Link href={`/app/quotes/${q.id}`} className="font-medium hover:underline">
                      {q.quoteNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{q.client?.name || "—"}</td>
                  <td className="px-4 py-3 capitalize">{q.status}</td>
                  <td className="px-4 py-3">{cad(q.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
