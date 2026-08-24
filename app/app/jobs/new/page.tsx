import { PageHeader } from "@/components/app-shell";
import { JobForm } from "@/components/job-form";
import { getClients } from "@/lib/queries";

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;
  const clients = await getClients();
  return (
    <div>
      <PageHeader title="New job" />
      <JobForm
        clients={clients}
        initial={
          clientId
            ? {
                id: "",
                title: "",
                clientId,
                status: "quoted",
                siteAddress: "",
                notes: "",
                targetDate: null,
              }
            : undefined
        }
      />
    </div>
  );
}
