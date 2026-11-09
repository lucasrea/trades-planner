import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintDocument } from "@/components/print-document";
import { respondToSharedQuoteAction } from "@/lib/actions/share";
import { actionErrorNotice } from "@/lib/action-errors";
import { ensureDb } from "@/lib/db";
import { formatDisplayDate } from "@/lib/format";
import { cad, type LineKind } from "@/lib/money";
import { getSharedDocument } from "@/lib/services/document-links";

// The link is the only credential: keep it out of search results and referrers.
export const metadata: Metadata = {
  title: "Quote or invoice",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function asKind(kind: string): LineKind {
  if (kind === "labour" || kind === "other") return kind;
  return "material";
}

export default async function SharedDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { token } = await params;
  const raw = await searchParams;
  const notice = actionErrorNotice(Array.isArray(raw.error) ? raw.error[0] : raw.error);
  const shared = await getSharedDocument(await ensureDb(), token);
  if (!shared) notFound();
  const { document, client, job, lines, business } = shared;
  const isQuote = document.type === "quote";
  const dueDate = formatDisplayDate(document.dueDate, { month: "long" });

  return (
    <div className="min-h-screen bg-paper py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-6 max-w-[820px] px-4">
        {notice ? (
          <p className="card mb-4 p-4 text-sm font-medium text-red-700" role="alert">
            {notice}
          </p>
        ) : null}
        {isQuote ? (
          document.status === "approved" ? (
            <p className="card p-4 text-sm font-medium" role="status">
              You approved this quote.
            </p>
          ) : document.status === "declined" ? (
            <p className="card p-4 text-sm font-medium" role="status">
              You declined this quote.
            </p>
          ) : (
            <form action={respondToSharedQuoteAction} className="card flex flex-wrap items-center gap-3 p-4">
              <input type="hidden" name="token" value={token} />
              <p className="mr-auto text-sm font-medium">Quote total {cad(document.total)}</p>
              <button type="submit" name="response" value="declined" className="btn btn-ghost">
                Decline
              </button>
              <button type="submit" name="response" value="approved" className="btn btn-primary">
                Approve
              </button>
            </form>
          )
        ) : (
          <div className="card p-4" role="status">
            {document.status === "paid" ? (
              <p className="text-sm font-medium">Paid. Thank you.</p>
            ) : (
              <>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Amount due</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{cad(document.total)}</p>
                {dueDate !== "—" ? <p className="mt-1 text-sm text-muted">Due {dueDate}</p> : null}
              </>
            )}
          </div>
        )}
      </div>
      <PrintDocument
        kind={isQuote ? "Quote" : "Invoice"}
        number={document.number}
        clientName={client?.name || "Client"}
        clientAddress={client?.billingAddress}
        siteAddress={job?.siteAddress}
        notes={document.notes}
        dateLabel={isQuote ? "Valid until" : "Due date"}
        dateValue={isQuote ? document.validUntil : document.dueDate}
        issueDate={document.createdAt}
        lines={lines.map((line) => ({
          id: line.id,
          kind: asKind(line.kind),
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unitPrice: line.unitPrice,
        }))}
        contractor={business}
        storedTotals={{ subtotal: document.subtotal, tax: document.tax, total: document.total }}
      />
    </div>
  );
}
