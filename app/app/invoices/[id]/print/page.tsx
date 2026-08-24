import { notFound } from "next/navigation";
import { PrintDocument } from "@/components/print-document";
import { PrintToolbar } from "@/components/print-toolbar";
import { getContractor } from "@/lib/auth";
import { getInvoice, getJob } from "@/lib/queries";

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  const contractor = await getContractor();
  const job = invoice.jobId ? await getJob(invoice.jobId) : null;
  return (
    <div>
      <PrintToolbar backHref={`/app/invoices/${invoice.id}`} />
      <PrintDocument
        kind="Invoice"
        number={invoice.invoiceNumber}
        clientName={invoice.client?.name || "Client"}
        clientAddress={invoice.client?.billingAddress}
        siteAddress={job?.siteAddress}
        notes={invoice.notes}
        dateLabel="Due"
        dateValue={invoice.dueDate}
        lines={invoice.lines}
        contractor={contractor}
      />
    </div>
  );
}
