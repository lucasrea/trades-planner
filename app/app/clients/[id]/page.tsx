import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, RelatedList } from "@/components/app-shell";
import { ClientForm } from "@/components/client-form";
import { getClient, getClientHistory } from "@/lib/queries";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  const { jobs, quotes, invoices } = await getClientHistory(id);

  return (
    <div className="space-y-8">
      <PageHeader
        title={client.name}
        subtitle={client.email || client.phone || undefined}
        back={{ href: "/app/clients", label: "Clients" }}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={`/app/jobs/new?clientId=${client.id}`} className="btn btn-ghost">
              New job
            </Link>
            <Link href={`/app/quotes/new?clientId=${client.id}`} className="btn btn-primary">
              New quote
            </Link>
          </div>
        }
      />
      <ClientForm initial={client} />
      <div className="grid gap-4 md:grid-cols-3">
        <RelatedList title="Jobs" items={jobs.map((j) => ({ href: `/app/jobs/${j.id}`, label: j.title }))} />
        <RelatedList
          title="Quotes"
          items={quotes.map((q) => ({ href: `/app/quotes/${q.id}`, label: q.quoteNumber }))}
        />
        <RelatedList
          title="Invoices"
          items={invoices.map((i) => ({ href: `/app/invoices/${i.id}`, label: i.invoiceNumber }))}
        />
      </div>
    </div>
  );
}
