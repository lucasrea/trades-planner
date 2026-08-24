import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { DocumentForm } from "@/components/document-form";
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
        action={
          <Link href={`/app/invoices/${invoice.id}/print`} className="btn btn-ghost">
            Print / PDF
          </Link>
        }
      />
      <DocumentForm
        kind="invoice"
        taxRate={contractor.taxRate}
        taxLabel={contractor.taxLabel}
        labourRate={contractor.labourRateHourly}
        clients={clients.map((c) => ({ id: c.id, label: c.name }))}
        jobs={jobs.map((j) => ({ id: j.id, label: `${j.title} · ${j.client?.name || ""}` }))}
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
