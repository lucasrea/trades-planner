import { notFound } from "next/navigation";
import { PrintDocument } from "@/components/print-document";
import { PrintToolbar } from "@/components/print-toolbar";
import { getAuthUser, getContractor } from "@/lib/auth";
import { getJob, getQuote } from "@/lib/queries";

export default async function QuotePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await getQuote(id);
  if (!quote) notFound();
  const [contractor, user] = await Promise.all([getContractor(), getAuthUser()]);
  const job = quote.jobId ? await getJob(quote.jobId) : null;
  return (
    <div className="min-h-screen bg-stone-100 print:bg-white">
      <PrintToolbar backHref={`/app/quotes/${quote.id}`} />
      <div className="py-8 print:py-0">
        <PrintDocument
          kind="Quote"
          number={quote.quoteNumber}
          clientName={quote.client?.name || "Client"}
          clientAddress={quote.client?.billingAddress}
          siteAddress={job?.siteAddress}
          notes={quote.notes}
          dateLabel="Valid until"
          dateValue={quote.validUntil}
          issueDate={quote.createdAt}
          lines={quote.lines}
          contractor={contractor}
          logoUrl={user?.image}
        />
      </div>
    </div>
  );
}
