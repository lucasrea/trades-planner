import { and, eq } from "drizzle-orm";
import { clients, contractors } from "@/lib/db/schema";
import { buildDocumentClientEmail, type DocType } from "@/lib/documents";
import { sendEmail, type EmailMessage } from "@/lib/email";
import { NotFoundError, ValidationError, type ServiceContext } from "@/lib/services/context";
import { createDocumentLink, getActiveLinkToken } from "@/lib/services/document-links";
import { requireDocument } from "@/lib/services/internal";

const SENDABLE_STATUSES = new Set(["draft", "sent"]);

export async function sendDocumentEmailToClient(
  ctx: ServiceContext,
  documentId: string,
  input: {
    authUrl: string;
    send?: (message: EmailMessage) => Promise<void>;
  },
): Promise<void> {
  const doc = await requireDocument(ctx.db, ctx.contractorId, documentId);
  if (!SENDABLE_STATUSES.has(doc.status)) {
    throw new ValidationError("This document cannot be emailed.");
  }
  if (!doc.clientId) throw new ValidationError("No client email.");
  const [client] = await ctx.db
    .select({ email: clients.email })
    .from(clients)
    .where(and(eq(clients.id, doc.clientId), eq(clients.contractorId, ctx.contractorId)))
    .limit(1);
  const to = client?.email?.trim() ?? "";
  if (!to) throw new ValidationError("No client email.");

  const [contractor] = await ctx.db
    .select({
      businessName: contractors.businessName,
      etransferEmail: contractors.etransferEmail,
      etransferNote: contractors.etransferNote,
    })
    .from(contractors)
    .where(eq(contractors.id, ctx.contractorId))
    .limit(1);
  if (!contractor) throw new NotFoundError("Contractor not found.");

  let token = await getActiveLinkToken(ctx, documentId);
  if (!token) {
    token = await createDocumentLink(ctx, documentId);
  }
  const base = input.authUrl.replace(/\/$/, "");
  const link = `${base}/d/${token}`;
  const dueOrValid = doc.type === "quote" ? doc.validUntil : doc.dueDate;
  const etransferEmail = contractor.etransferEmail?.trim() ?? "";
  const etransferInstructions = etransferEmail
    ? `Pay by e-transfer to ${etransferEmail}${contractor.etransferNote?.trim() ? `. ${contractor.etransferNote.trim()}` : "."}`
    : "";

  const { subject, text } = buildDocumentClientEmail({
    businessName: contractor.businessName,
    type: doc.type as DocType,
    number: doc.number,
    total: doc.total,
    dueOrValid,
    etransferInstructions,
    link,
  });

  const deliver = input.send ?? sendEmail;
  await deliver({ to, subject, text });
}
