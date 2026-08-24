import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { ClientForm } from "@/components/client-form";
import { getClient } from "@/lib/queries";
import { ensureDb } from "@/lib/db";
import { getContractor } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { jobs, quotes, invoices } from "@/lib/db/schema";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  const contractor = await getContractor();
  const db = await ensureDb();
  const [jobRows, quoteRows, invoiceRows] = await Promise.all([
    db.select().from(jobs).where(and(eq(jobs.clientId, id), eq(jobs.contractorId, contractor.id))),
    db.select().from(quotes).where(and(eq(quotes.clientId, id), eq(quotes.contractorId, contractor.id))),
    db.select().from(invoices).where(and(eq(invoices.clientId, id), eq(invoices.contractorId, contractor.id))),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={client.name}
        action={
          <Link href={`/app/quotes/new?clientId=${client.id}`} className="btn btn-primary">
            Quote this client
          </Link>
        }
      />
      <ClientForm initial={client} />
      <div className="grid gap-4 md:grid-cols-3">
        <Related title="Jobs" items={jobRows.map((j) => ({ href: `/app/jobs/${j.id}`, label: j.title }))} />
        <Related title="Quotes" items={quoteRows.map((q) => ({ href: `/app/quotes/${q.id}`, label: q.quoteNumber }))} />
        <Related
          title="Invoices"
          items={invoiceRows.map((i) => ({ href: `/app/invoices/${i.id}`, label: i.invoiceNumber }))}
        />
      </div>
    </div>
  );
}

function Related({ title, items }: { title: string; items: { href: string; label: string }[] }) {
  return (
    <div className="card p-4">
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {items.length === 0 ? <li className="text-muted">None yet</li> : null}
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="hover:underline">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
