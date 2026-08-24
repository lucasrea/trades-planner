import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { JobForm } from "@/components/job-form";
import { getClients, getJob, getJobDocuments } from "@/lib/queries";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();
  const [clients, docs] = await Promise.all([getClients(), getJobDocuments(id)]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={job.title}
        subtitle={job.client?.name}
        back={{ href: "/app/jobs", label: "Jobs" }}
        action={
          <Link href={`/app/quotes/new?clientId=${job.clientId}`} className="btn btn-primary">
            New quote
          </Link>
        }
      />
      <JobForm clients={clients} initial={job} />
      <div className="grid gap-4 md:grid-cols-2">
        <Related title="Quotes" items={docs.quotes.map((q) => ({ href: `/app/quotes/${q.id}`, label: q.quoteNumber }))} />
        <Related
          title="Invoices"
          items={docs.invoices.map((i) => ({ href: `/app/invoices/${i.id}`, label: i.invoiceNumber }))}
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
