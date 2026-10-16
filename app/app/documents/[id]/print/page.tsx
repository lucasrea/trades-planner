import { notFound } from "next/navigation";
import { PrintDocument } from "@/components/print-document";
import { PrintToolbar } from "@/components/print-toolbar";
import { getAuthUser, getContractor } from "@/lib/auth";
import { type LineKind } from "@/lib/money";
import { getDocument } from "@/lib/queries";

function asKind(kind: string): LineKind {
  if (kind === "labour" || kind === "other") return kind;
  return "material";
}

export default async function DocumentPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const document = await getDocument(id);
  if (!document) notFound();
  const [contractor, user] = await Promise.all([getContractor(), getAuthUser()]);
  const isQuote = document.type === "quote";

  return (
    <div className="min-h-screen bg-paper print:bg-white">
      <PrintToolbar backHref={`/app/documents/${document.id}`} />
      <div className="py-8 print:py-0">
        <PrintDocument
          kind={isQuote ? "Quote" : "Invoice"}
          number={document.number}
          clientName={document.client?.name || "Client"}
          clientAddress={document.client?.billingAddress}
          siteAddress={document.job?.siteAddress}
          notes={document.notes}
          dateLabel={isQuote ? "Valid until" : "Due date"}
          dateValue={isQuote ? document.validUntil : document.dueDate}
          issueDate={document.createdAt}
          lines={document.lines.map((line) => ({
            id: line.id,
            kind: asKind(line.kind),
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            unitPrice: line.unitPrice,
          }))}
          contractor={contractor}
          logoUrl={user?.image}
        />
      </div>
    </div>
  );
}
