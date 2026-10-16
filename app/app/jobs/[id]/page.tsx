import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, RelatedList } from "@/components/app-shell";
import { JobCostsForm } from "@/components/job-costs-form";
import { JobForm } from "@/components/job-form";
import { invoiceFromJobAction } from "@/lib/actions/data";
import { getContractor } from "@/lib/auth";
import { getClients, getJob, getJobCosts, getJobDocuments } from "@/lib/queries";

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const job = await getJob(id);
  if (!job) notFound();
  const [contractor, clients, docs, costs] = await Promise.all([
    getContractor(),
    getClients(),
    getJobDocuments(id),
    getJobCosts(id),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={job.title}
        subtitle={job.client?.name}
        back={{ href: "/app/jobs", label: "Jobs" }}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <form action={invoiceFromJobAction}>
              <input type="hidden" name="jobId" value={job.id} />
              <button className="btn btn-navy">Create invoice</button>
            </form>
            <Link
              href={`/app/quotes/new?clientId=${job.clientId}&jobId=${job.id}`}
              className="btn btn-primary"
            >
              New quote
            </Link>
          </div>
        }
      />
      {error === "costs" ? (
        <p className="mb-0 text-sm text-accent" role="alert">
          Add a material, expense, or labour line before creating an invoice.
        </p>
      ) : null}
      <JobForm clients={clients} initial={job} />
      <JobCostsForm
        jobId={job.id}
        costs={costs}
        labourRate={contractor.labourRateHourly}
        markupPct={contractor.defaultMarkupPct}
      />
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
