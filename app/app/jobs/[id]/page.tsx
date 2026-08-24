import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, RelatedList } from "@/components/app-shell";
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
          <Link
            href={`/app/quotes/new?clientId=${job.clientId}&jobId=${job.id}`}
            className="btn btn-primary"
          >
            New quote
          </Link>
        }
      />
      <JobForm clients={clients} initial={job} />
      <div className="grid gap-4 md:grid-cols-2">
        <RelatedList
          title="Quotes"
          items={docs.quotes.map((q) => ({ href: `/app/quotes/${q.id}`, label: q.quoteNumber }))}
        />
        <RelatedList
          title="Invoices"
          items={docs.invoices.map((i) => ({ href: `/app/invoices/${i.id}`, label: i.invoiceNumber }))}
        />
      </div>
    </div>
  );
}
