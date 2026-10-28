import { notFound } from "next/navigation";
import { PageHeader, RelatedList } from "@/components/app-shell";
import { CaptureBar } from "@/components/capture-bar";
import { JobEditForm, JobStatusForm } from "@/components/job-form";
import { LineEditor } from "@/components/line-editor";
import { JobDocumentActions } from "@/components/job-document-actions";
import { actionErrorNotice } from "@/lib/action-errors";
import { getContractor } from "@/lib/auth";
import { type LineKind } from "@/lib/money";
import { getClients, getJob, getJobDocuments, getTrackedLines } from "@/lib/queries";

function asKind(kind: string): LineKind {
  if (kind === "labour" || kind === "other") return kind;
  return "material";
}

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { id } = await params;
  const raw = await searchParams;
  const notice = actionErrorNotice(Array.isArray(raw.error) ? raw.error[0] : raw.error);
  const job = await getJob(id);
  if (!job) notFound();
  const [contractor, tracked, docs, clients] = await Promise.all([
    getContractor(),
    getTrackedLines(id),
    getJobDocuments(id),
    getClients(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={job.title}
        subtitle={job.client?.name}
        back={{ href: "/app/jobs", label: "Jobs" }}
        action={<JobDocumentActions jobId={job.id} />}
      />
      {notice ? (
        <p className="text-sm text-accent" role="alert">
          {notice}
        </p>
      ) : null}
      <CaptureBar
        lockedJob={{ id: job.id, title: job.title, clientName: job.client?.name ?? null }}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
        <JobEditForm
          job={{
            id: job.id,
            title: job.title,
            clientId: job.clientId,
            siteAddress: job.siteAddress,
            notes: job.notes,
          }}
          clients={clients}
        />
        <div className="card p-6">
          <JobStatusForm jobId={job.id} status={job.status} />
        </div>
      </div>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Tracked lines</h2>
        <LineEditor
          lines={tracked.map((line) => ({
            id: line.id,
            kind: asKind(line.kind),
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            unitPrice: line.unitPrice,
          }))}
          taxRate={contractor.taxRate}
          taxLabel={contractor.taxLabel}
          labourRate={contractor.labourRateHourly}
          persist={{
            jobId: job.id,
            lockedIds: tracked.filter((line) => line.billedDocumentId).map((line) => line.id),
          }}
        />
      </section>
      <RelatedList
        title="Documents"
        items={docs.map((doc) => ({
          href: `/app/documents/${doc.id}`,
          label: `${doc.type === "quote" ? "Quote" : "Invoice"} ${doc.number}`,
        }))}
      />
    </div>
  );
}
