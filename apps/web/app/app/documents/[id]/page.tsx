import { notFound } from "next/navigation";
import { DocumentView } from "@/components/document-view";
import { actionErrorNotice } from "@/lib/action-errors";
import { getContractor } from "@/lib/auth";
import { isOverdue, type DocStatus, type DocType } from "@/lib/documents";
import { calendarDateInTimeZone } from "@/lib/format";
import { ensureDb } from "@/lib/db";
import { getDocument, getTrackedLines } from "@/lib/queries";
import { isEmailProviderConfigured } from "@/lib/email";
import { getActiveLinkToken } from "@/lib/services/document-links";

export default async function DocumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { id } = await params;
  const raw = await searchParams;
  const notice = actionErrorNotice(Array.isArray(raw.error) ? raw.error[0] : raw.error);
  const [document, contractor] = await Promise.all([getDocument(id), getContractor()]);
  if (!document) notFound();
  const ctx = { db: await ensureDb(), contractorId: contractor.id };
  const [tracked, shareToken] = await Promise.all([
    document.type === "invoice" ? getTrackedLines(document.jobId) : Promise.resolve([]),
    getActiveLinkToken(ctx, document.id),
  ]);
  const unbilledCount = tracked.filter((line) => !line.billedDocumentId).length;
  const today = calendarDateInTimeZone();
  const displayStatus = isOverdue(
    {
      type: document.type as DocType,
      status: document.status as DocStatus,
      dueDate: document.dueDate,
    },
    today,
  )
    ? "overdue"
    : document.status;

  return (
    <DocumentView
      document={document}
      taxLabel={contractor.taxLabel}
      taxRate={contractor.taxRate}
      labourRate={contractor.labourRateHourly}
      businessName={contractor.businessName}
      etransferEmail={contractor.etransferEmail}
      etransferNote={contractor.etransferNote}
      displayStatus={displayStatus}
      unbilledCount={unbilledCount}
      shareToken={shareToken}
      emailClientEnabled={isEmailProviderConfigured()}
      notice={notice ?? undefined}
    />
  );
}
