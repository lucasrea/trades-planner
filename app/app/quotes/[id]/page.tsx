import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { DocumentForm } from "@/components/document-form";
import { DuplicateButton } from "@/components/duplicate-button";
import { StatusBadge } from "@/components/status-badge";
import { UpgradeNotice } from "@/components/upgrade-notice";
import { duplicateQuoteAction, invoiceFromQuoteAction } from "@/lib/actions/data";
import { getContractor } from "@/lib/auth";
import { canUseFeature, planLimits } from "@/lib/entitlements";
import { getClients, getJobs, getQuote } from "@/lib/queries";

export default async function QuoteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ upgrade?: string }>;
}) {
  const { id } = await params;
  const { upgrade } = await searchParams;
  const quote = await getQuote(id);
  if (!quote) notFound();
  const [contractor, clients, jobs] = await Promise.all([getContractor(), getClients(), getJobs()]);

  return (
    <div>
      <PageHeader
        title={quote.quoteNumber}
        subtitle={quote.client?.name}
        back={{ href: "/app/quotes", label: "Quotes" }}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={quote.status} />
            <Link
              href={`/app/quotes/${quote.id}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
            >
              View as PDF
            </Link>
            <DuplicateButton action={duplicateQuoteAction} id={quote.id} />
            <form action={invoiceFromQuoteAction}>
              <input type="hidden" name="quoteId" value={quote.id} />
              <button className="btn btn-navy">Create invoice</button>
            </form>
          </div>
        }
      />
      {upgrade === "duplicate" ? (
        <UpgradeNotice>Duplicating quotes is on Solo. Upgrade to copy a quote as a starting point.</UpgradeNotice>
      ) : upgrade ? (
        <UpgradeNotice>
          Free includes {planLimits.free.documentsPerMonth} quotes and invoices per month. Upgrade to
          Solo for unlimited documents.
        </UpgradeNotice>
      ) : null}
      <DocumentForm
        kind="quote"
        taxRate={contractor.taxRate}
        taxLabel={contractor.taxLabel}
        labourRate={contractor.labourRateHourly}
        markupPct={canUseFeature(contractor.plan, "material_markup") ? contractor.defaultMarkupPct : 0}
        clients={clients.map((c) => ({ id: c.id, label: c.name }))}
        jobs={jobs.map((j) => ({ id: j.id, label: `${j.title} · ${j.client?.name || ""}`, clientId: j.clientId }))}
        initial={{
          id: quote.id,
          clientId: quote.clientId,
          jobId: quote.jobId,
          status: quote.status,
          notes: quote.notes,
          date: quote.validUntil,
          lines: quote.lines,
        }}
      />
    </div>
  );
}
