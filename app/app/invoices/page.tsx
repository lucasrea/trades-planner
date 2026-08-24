import Link from "next/link";
import { EmptyState, PageHeader, TableCard } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
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
              {rows.map((inv) => (
                <tr key={inv.id} className="border-t border-line hover:bg-paper/70">
                  <td className="px-4 py-3">
                    <Link href={`/app/invoices/${inv.id}`} className="font-medium hover:underline">
                      {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{inv.client?.name || "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{cad(inv.total)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/app/invoices/${inv.id}/print`}
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
