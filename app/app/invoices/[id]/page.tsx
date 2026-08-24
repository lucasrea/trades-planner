import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { DocumentForm } from "@/components/document-form";
import { StatusBadge } from "@/components/status-badge";
import { getContractor } from "@/lib/auth";
import { getClients, getInvoice, getJobs } from "@/lib/queries";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  const [contractor, clients, jobs] = await Promise.all([getContractor(), getClients(), getJobs()]);

  return (
    <div>
      <PageHeader
        title={invoice.invoiceNumber}
        subtitle={invoice.client?.name}
        back={{ href: "/app/invoices", label: "Invoices" }}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={invoice.status} />
            <Link
              href={`/app/invoices/${invoice.id}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
            >
              View as PDF
            </Link>
          </div>
        }
      />
      <DocumentForm
        kind="invoice"
        taxRate={contractor.taxRate}
        taxLabel={contractor.taxLabel}
        labourRate={contractor.labourRateHourly}
        clients={clients.map((c) => ({ id: c.id, label: c.name }))}
        jobs={jobs.map((j) => ({ id: j.id, label: `${j.title} · ${j.client?.name || ""}`, clientId: j.clientId }))}
        initial={{
          id: invoice.id,
          clientId: invoice.clientId,
          jobId: invoice.jobId,
          quoteId: invoice.quoteId,
          status: invoice.status,
          notes: invoice.notes,
          date: invoice.dueDate,
          lines: invoice.lines,
        }}
      />
    </div>
  );
}
