import { notFound } from "next/navigation";
import { PrintDocument } from "@/components/print-document";
import { PrintToolbar } from "@/components/print-toolbar";
import { getContractor } from "@/lib/auth";
import { getJob, getQuote } from "@/lib/queries";

export default async function QuotePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await getQuote(id);
  if (!quote) notFound();
  const contractor = await getContractor();
  const job = quote.jobId ? await getJob(quote.jobId) : null;
  return (
    <div>
      <PrintToolbar backHref={`/app/quotes/${quote.id}`} />
      <PrintDocument
        kind="Quote"
        number={quote.quoteNumber}
        clientName={quote.client?.name || "Client"}
        clientAddress={quote.client?.billingAddress}
        siteAddress={job?.siteAddress}
        notes={quote.notes}
        dateLabel="Valid until"
        dateValue={quote.validUntil}
        lines={quote.lines}
        contractor={contractor}
      />
    </div>
  );
}
