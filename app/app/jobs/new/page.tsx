import { EmptyState, PageHeader } from "@/components/app-shell";
import { JobForm } from "@/components/job-form";
import { getClients } from "@/lib/queries";

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;
  const clients = await getClients();

  if (clients.length === 0) {
    return (
      <div>
        <PageHeader title="New job" back={{ href: "/app/jobs", label: "Jobs" }} />
        <EmptyState
          title="Add a client first"
          body="Jobs belong to a client. Create a client, then come back to add the job."
          href="/app/clients/new"
          cta="Add client"
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="New job" back={{ href: "/app/jobs", label: "Jobs" }} />
      <JobForm
        clients={clients}
        initial={clientId ? { clientId, status: "quoted" } : { status: "quoted" }}
      />
    </div>
  );
}
