import { PageHeader } from "@/components/app-shell";
import { DocumentForm } from "@/components/document-form";
import { getContractor } from "@/lib/auth";
import { getClients, getJobs } from "@/lib/queries";

export default async function NewInvoicePage() {
  const [contractor, clients, jobs] = await Promise.all([getContractor(), getClients(), getJobs()]);
  return (
    <div>
      <PageHeader title="New invoice" />
      <DocumentForm
        kind="invoice"
        taxRate={contractor.taxRate}
        taxLabel={contractor.taxLabel}
        labourRate={contractor.labourRateHourly}
        clients={clients.map((c) => ({ id: c.id, label: c.name }))}
        jobs={jobs.map((j) => ({ id: j.id, label: `${j.title} · ${j.client?.name || ""}` }))}
      />
    </div>
  );
}
