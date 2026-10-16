import { notFound } from "next/navigation";
import { DocumentView } from "@/components/document-view";
import { getContractor } from "@/lib/auth";
import { isOverdue, type DocStatus, type DocType } from "@/lib/documents";
import { getDocument } from "@/lib/queries";

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const document = await getDocument(id);
  if (!document) notFound();
  const contractor = await getContractor();
  const today = new Date().toISOString().slice(0, 10);
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
      displayStatus={displayStatus}
    />
  );
}
