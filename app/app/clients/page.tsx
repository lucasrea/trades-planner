import Link from "next/link";
import { EmptyState, PageHeader, TableCard } from "@/components/app-shell";
import { UpgradeNotice } from "@/components/upgrade-notice";
import { getClients } from "@/lib/queries";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string }>;
}) {
  const { upgrade } = await searchParams;
  const rows = await getClients();

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="People you quote and invoice."
        action={
          <>
            {rows.length > 0 ? (
              <a href="/api/clients/export" className="btn btn-ghost">
                Export CSV
              </a>
            ) : null}
            <Link href="/app/clients/new" className="btn btn-primary">
              Add client
            </Link>
          </>
        }
      />
      {upgrade === "export" ? (
        <UpgradeNotice>Client CSV export is on Solo. Upgrade to download your list.</UpgradeNotice>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState
          title="Add your first client"
          body="A client is a name and how to reach them. Job site addresses live on the job."
          href="/app/clients/new"
          cta="Add client"
        />
      ) : (
        <TableCard>
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-paper text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-line hover:bg-paper/70">
                  <td className="px-4 py-3">
                    <Link href={`/app/clients/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{c.email || "—"}</td>
                  <td className="px-4 py-3 text-muted">{c.phone || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/app/quotes/new?clientId=${c.id}`} className="btn btn-ghost btn-sm">
                      New quote
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
