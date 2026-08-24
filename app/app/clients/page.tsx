import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/app-shell";
import { getClients } from "@/lib/queries";

export default async function ClientsPage() {
  const rows = await getClients();
  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="People you quote and invoice."
        action={
          <Link href="/app/clients/new" className="btn btn-primary">
            Add client
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="Add your first client"
          body="A client is just a name and how to reach them. Job site addresses live on the job."
          href="/app/clients/new"
          cta="Add client"
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <Link href={`/app/clients/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{c.email || "—"}</td>
                  <td className="px-4 py-3 text-muted">{c.phone || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
