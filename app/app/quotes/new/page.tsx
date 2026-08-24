import { PageHeader } from "@/components/app-shell";
import { DocumentForm } from "@/components/document-form";
import { getContractor } from "@/lib/auth";
import { getClients, getJobs } from "@/lib/queries";

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;
  const [contractor, clients, jobs] = await Promise.all([getContractor(), getClients(), getJobs()]);
  return (
    <div>
      <PageHeader title="New quote" subtitle="Unit price is what the client pays. Tax is added on the subtotal." />
      <DocumentForm
        kind="quote"
        taxRate={contractor.taxRate}
        taxLabel={contractor.taxLabel}
        labourRate={contractor.labourRateHourly}
        clients={clients.map((c) => ({ id: c.id, label: c.name }))}
        jobs={jobs.map((j) => ({ id: j.id, label: `${j.title} · ${j.client?.name || ""}` }))}
        initial={{ clientId }}
      />
    </div>
  );
}
