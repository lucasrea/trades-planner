import { padNumber } from "@/lib/money";

export type DocType = "quote" | "invoice";
export type QuoteStatus = "draft" | "sent" | "approved" | "declined";
export type InvoiceStatus = "draft" | "sent" | "paid";
export type DocStatus = QuoteStatus | InvoiceStatus;

export function statusesFor(type: DocType): readonly DocStatus[] {
  return type === "quote"
    ? (["draft", "sent", "approved", "declined"] as const)
    : (["draft", "sent", "paid"] as const);
}

export function canTransition(type: DocType, from: DocStatus, to: DocStatus): boolean {
  if (type === "quote") {
    if (from === "draft" && to === "sent") return true;
    if (from === "sent" && (to === "approved" || to === "declined")) return true;
    return false;
  }
  if (from === "draft" && to === "sent") return true;
  if (from === "sent" && to === "paid") return true;
  return false;
}

export function isLocked(status: DocStatus): boolean {
  return status !== "draft";
}

export function isOverdue(
  doc: { type: DocType; status: DocStatus; dueDate?: string | null },
  today: string,
): boolean {
  return (
    doc.type === "invoice" &&
    doc.status === "sent" &&
    Boolean(doc.dueDate) &&
    doc.dueDate! < today
  );
}

function addDaysIso(now: Date, days: number): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function defaultValidUntil(now: Date): string {
  return addDaysIso(now, 30);
}

export function defaultDueDate(now: Date): string {
  return addDaysIso(now, 14);
}

export function documentNumber(type: DocType, n: number): string {
  return padNumber(n, type === "quote" ? "Q" : "INV");
}

export type DocumentAction =
  | "mark-sent"
  | "approve"
  | "decline"
  | "create-invoice"
  | "add-unbilled"
  | "mark-paid"
  | "delete-draft"
  | "email"
  | "print";

export function documentActions(doc: {
  type: DocType;
  status: DocStatus;
  unbilledCount?: number;
  hasClientEmail?: boolean;
}): DocumentAction[] {
  const actions: DocumentAction[] = [];
  if (doc.status === "draft") actions.push("mark-sent");
  if (doc.type === "quote" && doc.status === "sent") actions.push("approve", "decline");
  if (doc.type === "quote" && doc.status === "approved") actions.push("create-invoice");
  if (doc.type === "invoice" && doc.status === "draft" && (doc.unbilledCount ?? 0) > 0) {
    actions.push("add-unbilled");
  }
  if (doc.type === "invoice" && doc.status === "sent") actions.push("mark-paid");
  if (doc.status === "draft") actions.push("delete-draft");
  if (doc.hasClientEmail) actions.push("email");
  actions.push("print");
  return actions;
}

export function buildMailto(input: {
  businessName: string;
  type: DocType;
  number: string;
  clientEmail: string;
  total: number;
  dueOrValid: string | null;
  etransferInstructions: string;
}): string {
  const docLabel = input.type === "quote" ? "Quote" : "Invoice";
  const subject = `${input.businessName} ${docLabel} ${input.number}`;
  const dateLabel = input.type === "quote" ? "Valid until" : "Due date";
  const dateLine = input.dueOrValid ? `${dateLabel}: ${input.dueOrValid}\n` : "";
  const etransfer =
    input.type === "invoice" && input.etransferInstructions
      ? `\n${input.etransferInstructions}`
      : "";
  const body = `Hi,\n\nPlease find your ${docLabel.toLowerCase()} ${input.number} for $${input.total.toFixed(2)} CAD.\n${dateLine}${etransfer}\n\nThank you,\n${input.businessName}`;
  const params = new URLSearchParams();
  params.set("subject", subject);
  params.set("body", body);
  return `mailto:${encodeURIComponent(input.clientEmail)}?${params.toString()}`;
}
