import { EmptyState, PageHeader } from "@/components/app-shell";
import { DocumentForm } from "@/components/document-form";
import { getContractor } from "@/lib/auth";
import { getClients, getJobs } from "@/lib/queries";

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; jobId?: string }>;
}) {
  const { clientId, jobId } = await searchParams;
  const [contractor, clients, jobs] = await Promise.all([getContractor(), getClients(), getJobs()]);

  if (clients.length === 0) {
    return (
      <div>
        <PageHeader title="New quote" back={{ href: "/app/quotes", label: "Quotes" }} />
        <EmptyState
          title="Add a client first"
          body="Quotes are billed to a client. Create one, then you can write the quote."
          href="/app/clients/new"
          cta="Add client"
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="New quote"
        subtitle="Unit price is what the client pays. Tax is added on the subtotal."
        back={{ href: "/app/quotes", label: "Quotes" }}
      />
      <DocumentForm
        kind="quote"
        taxRate={contractor.taxRate}
        taxLabel={contractor.taxLabel}
        labourRate={contractor.labourRateHourly}
        clients={clients.map((c) => ({ id: c.id, label: c.name }))}
        jobs={jobs.map((j) => ({ id: j.id, label: `${j.title} · ${j.client?.name || ""}`, clientId: j.clientId }))}
        initial={{ clientId, jobId }}
      />
    </div>
  );
}
