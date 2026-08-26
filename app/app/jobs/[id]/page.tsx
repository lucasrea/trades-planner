import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, RelatedList } from "@/components/app-shell";
import { DuplicateButton } from "@/components/duplicate-button";
import { JobForm } from "@/components/job-form";
import { UpgradeNotice } from "@/components/upgrade-notice";
import { duplicateJobAction } from "@/lib/actions/data";
import { getClients, getJob, getJobDocuments } from "@/lib/queries";
import { planLimits } from "@/lib/entitlements";

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ upgrade?: string }>;
}) {
  const { id } = await params;
  const { upgrade } = await searchParams;
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
          <div className="flex flex-wrap items-center gap-2">
            <DuplicateButton action={duplicateJobAction} id={job.id} />
            <Link
              href={`/app/quotes/new?clientId=${job.clientId}&jobId=${job.id}`}
              className="btn btn-primary"
            >
              New quote
            </Link>
          </div>
        }
      />
      {upgrade === "duplicate" ? (
        <UpgradeNotice>Duplicating jobs is on Solo. Upgrade to copy a job as a starting point.</UpgradeNotice>
      ) : upgrade ? (
        <UpgradeNotice>
          Free includes {planLimits.free.activeJobs} active jobs. Completed and archived jobs don’t
          count. Upgrade to Solo for unlimited jobs.
        </UpgradeNotice>
      ) : null}
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
