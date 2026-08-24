import Link from "next/link";
import { EmptyState, PageHeader, TableCard } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
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
        <TableCard>
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-paper text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Site</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((job) => (
                <tr key={job.id} className="border-t border-line hover:bg-paper/70">
                  <td className="px-4 py-3">
                    <Link href={`/app/jobs/${job.id}`} className="font-medium hover:underline">
                      {job.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{job.client?.name || "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-muted">{job.siteAddress || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/app/quotes/new?clientId=${job.clientId}&jobId=${job.id}`}
                      className="btn btn-ghost btn-sm"
                    >
                      New quote
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      )}
    </div>
  );
}
