import { PageHeader } from "@/components/app-shell";
import { JobForm } from "@/components/job-form";
import { getClients } from "@/lib/queries";

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string | string[] }>;
}) {
  const raw = await searchParams;
  const clientId = Array.isArray(raw.clientId) ? raw.clientId[0] : raw.clientId;
  const clients = await getClients();

  return (
    <div>
      <PageHeader
        title="New job"
        subtitle="Pick a client or add one with the job."
        back={{ href: "/app/jobs", label: "Jobs" }}
      />
      <JobForm clients={clients} initial={clientId ? { clientId } : undefined} />
    </div>
  );
}
