import { EmptyState, PageHeader } from "@/components/app-shell";
import { DocumentForm } from "@/components/document-form";
import { getContractor } from "@/lib/auth";
import { getClients, getJobs } from "@/lib/queries";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;
  const [contractor, clients, jobs] = await Promise.all([getContractor(), getClients(), getJobs()]);

  if (clients.length === 0) {
    return (
      <div>
        <PageHeader title="New invoice" back={{ href: "/app/invoices", label: "Invoices" }} />
        <EmptyState
          title="Add a client first"
          body="Invoices are billed to a client. Create one, then come back here."
          href="/app/clients/new"
          cta="Add client"
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="New invoice" back={{ href: "/app/invoices", label: "Invoices" }} />
      <DocumentForm
        kind="invoice"
        taxRate={contractor.taxRate}
        taxLabel={contractor.taxLabel}
        labourRate={contractor.labourRateHourly}
        clients={clients.map((c) => ({ id: c.id, label: c.name }))}
        jobs={jobs.map((j) => ({ id: j.id, label: `${j.title} · ${j.client?.name || ""}`, clientId: j.clientId }))}
        initial={clientId ? { clientId } : undefined}
      />
    </div>
  );
}
