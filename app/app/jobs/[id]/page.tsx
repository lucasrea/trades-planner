import { notFound } from "next/navigation";
import { PageHeader, RelatedList } from "@/components/app-shell";
import { JobStatusForm } from "@/components/job-form";
import { LineEditor } from "@/components/line-editor";
import { JobDocumentActions } from "@/components/job-document-actions";
import { getContractor } from "@/lib/auth";
import { type LineKind } from "@/lib/money";
import { getJob, getJobDocuments, getTrackedLines } from "@/lib/queries";

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
  const error = Array.isArray(raw.error) ? raw.error[0] : raw.error;
  const job = await getJob(id);
  if (!job) notFound();
  const [contractor, tracked, docs] = await Promise.all([
    getContractor(),
    getTrackedLines(id),
    getJobDocuments(id),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={job.title}
        subtitle={job.client?.name}
        back={{ href: "/app/jobs", label: "Jobs" }}
        action={<JobDocumentActions jobId={job.id} />}
      />
      {error ? (
        <p className="text-sm text-accent" role="alert">
          {error === "nothing-to-bill" ? "Add unbilled tracked lines before creating an invoice from them." : error}
        </p>
      ) : null}
      <div className="card grid gap-6 p-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Client</p>
          <p className="mt-1 font-medium">{job.client?.name || "—"}</p>
        </div>
        <JobStatusForm jobId={job.id} status={job.status} />
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Site</p>
          <p className="mt-1 whitespace-pre-line">{job.siteAddress.trim() || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Notes</p>
          <p className="mt-1 whitespace-pre-line">{job.notes.trim() || "—"}</p>
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
