import { notFound } from "next/navigation";
import { PrintDocument } from "@/components/print-document";
import { PrintToolbar } from "@/components/print-toolbar";
import { getAuthUser, getContractor } from "@/lib/auth";
import { getInvoice, getJob } from "@/lib/queries";

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  const [contractor, user] = await Promise.all([getContractor(), getAuthUser()]);
  const job = invoice.jobId ? await getJob(invoice.jobId) : null;
  return (
    <div className="min-h-screen bg-stone-100 print:bg-white">
      <PrintToolbar backHref={`/app/invoices/${invoice.id}`} />
      <div className="py-8 print:py-0">
        <PrintDocument
          kind="Invoice"
          number={invoice.invoiceNumber}
          clientName={invoice.client?.name || "Client"}
          clientAddress={invoice.client?.billingAddress}
          siteAddress={job?.siteAddress}
          notes={invoice.notes}
          dateLabel="Due date"
          dateValue={invoice.dueDate}
          issueDate={invoice.createdAt}
          lines={invoice.lines}
          contractor={contractor}
          logoUrl={user?.image}
        />
      </div>
    </div>
  );
}
