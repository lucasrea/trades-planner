import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/app-shell";
import { ExpandableListTable } from "@/components/expandable-list-table";
import { duplicateJobAction } from "@/lib/actions/data";
import { formatDisplayDate, previewText } from "@/lib/format";
import { getJobs } from "@/lib/queries";

export default async function JobsPage() {
  const rows = await getJobs();
  return (
    <div>
      <PageHeader
        title="Jobs"
        subtitle="Active work and quoted jobs."
        action={
          <Link href="/app/jobs/new" className="btn btn-primary">
            New job
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No jobs yet"
          body="A job is a site and a client. You can also start from a quote and attach a job later."
          href="/app/jobs/new"
          cta="New job"
        />
      ) : (
        <ExpandableListTable
          columns={[
            { label: "Job" },
            { label: "Client" },
            { label: "Status" },
            { label: "Site" },
            { label: "Actions", align: "right" },
          ]}
          rows={rows.map((job) => ({
            id: job.id,
            label: job.title,
            href: `/app/jobs/${job.id}`,
            cells: [
              { kind: "text", value: job.client?.name || "—", className: "text-muted" },
              { kind: "status", status: job.status },
              {
                kind: "text",
                value: job.siteAddress || "—",
                className: "block max-w-[220px] truncate text-muted",
              },
              {
                kind: "actions",
                items: [
                  {
                    kind: "link",
                    href: `/app/quotes/new?clientId=${job.clientId}&jobId=${job.id}`,
                    label: "New quote",
                  },
                  { kind: "form", action: duplicateJobAction, id: job.id, label: "Duplicate" },
                ],
              },
            ],
            details: [
              { label: "Client", value: job.client?.name || "—" },
              { label: "Client email", value: job.client?.email || "—" },
              { label: "Client phone", value: job.client?.phone || "—" },
              { label: "Status", value: job.status, status: job.status },
              { label: "Site address", value: job.siteAddress || "—" },
              { label: "Target date", value: formatDisplayDate(job.targetDate) },
              { label: "Created", value: formatDisplayDate(job.createdAt) },
              { label: "Notes", value: previewText(job.notes) },
            ],
          }))}
        />
      )}
    </div>
  );
}
