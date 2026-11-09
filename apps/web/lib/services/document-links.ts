import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { clients, contractors, documentLinks, documents, jobs, lineItems } from "@/lib/db/schema";
import type { DocStatus } from "@/lib/documents";
import { isTokenShape, newId, newToken } from "@/lib/id";
import {
  advanceShareAttemptWindow,
  SHARE_ATTEMPT_HOUR_MS,
  SHARE_ATTEMPT_MAX,
} from "@/lib/share-attempt-window";
import { ConflictError, NotFoundError, ValidationError, type ServiceContext } from "@/lib/services/context";
import { setDocumentStatus } from "@/lib/services/documents";
import { requireDocument } from "@/lib/services/internal";

export const SHARE_ATTEMPT_LIMIT_MESSAGE =
  "Too many approve or decline attempts on this link. Wait an hour and try again.";

/** Only drafts and sent documents can get a new link. */
const SHAREABLE_STATUSES: readonly string[] = ["draft", "sent"];

// ---- Signed-in side: scoped by contractor_id ----

export async function getActiveLinkToken(ctx: ServiceContext, documentId: string) {
  const [row] = await ctx.db
    .select({ token: documentLinks.token })
    .from(documentLinks)
    .where(
      and(
        eq(documentLinks.documentId, documentId),
        eq(documentLinks.contractorId, ctx.contractorId),
        isNull(documentLinks.revokedAt),
      ),
    )
    .limit(1);
  return row?.token ?? null;
}

/** Returns the active link token, creating one if needed. */
export async function createDocumentLink(ctx: ServiceContext, documentId: string) {
  return ctx.db.transaction(async (tx) => {
    const [doc] = await tx
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.contractorId, ctx.contractorId)))
      .for("update");
    if (!doc) throw new NotFoundError("Document not found.");
    const [existing] = await tx
      .select({ token: documentLinks.token })
      .from(documentLinks)
      .where(
        and(
          eq(documentLinks.documentId, doc.id),
          eq(documentLinks.contractorId, ctx.contractorId),
          isNull(documentLinks.revokedAt),
        ),
      )
      .limit(1);
    if (existing) return existing.token;
    if (!SHAREABLE_STATUSES.includes(doc.status)) throw new ConflictError("Document is locked.");
    const token = newToken();
    await tx.insert(documentLinks).values({
      id: newId(),
      contractorId: ctx.contractorId,
      documentId: doc.id,
      token,
      revokedAt: null,
      createdAt: Date.now(),
    });
    return token;
  });
}

export async function revokeDocumentLink(ctx: ServiceContext, documentId: string) {
  await requireDocument(ctx.db, ctx.contractorId, documentId);
  await ctx.db
    .update(documentLinks)
    .set({ revokedAt: Date.now() })
    .where(
      and(
        eq(documentLinks.documentId, documentId),
        eq(documentLinks.contractorId, ctx.contractorId),
        isNull(documentLinks.revokedAt),
      ),
    );
}

// ---- Public side: token only ----

async function findActiveLink(db: Database, token: string) {
  if (!isTokenShape(token)) return null;
  const [link] = await db
    .select()
    .from(documentLinks)
    .where(and(eq(documentLinks.token, token), isNull(documentLinks.revokedAt)))
    .limit(1);
  return link ?? null;
}

/** Everything the public page shows. The document comes from the link, never from a browser-supplied id. */
export async function getSharedDocument(db: Database, token: string) {
  const link = await findActiveLink(db, token);
  if (!link) return null;
  const [row] = await db
    .select({ document: documents, client: clients, job: jobs, contractor: contractors })
    .from(documents)
    .innerJoin(contractors, eq(contractors.id, documents.contractorId))
    .leftJoin(clients, and(eq(clients.id, documents.clientId), eq(clients.contractorId, link.contractorId)))
    .leftJoin(jobs, and(eq(jobs.id, documents.jobId), eq(jobs.contractorId, link.contractorId)))
    .where(and(eq(documents.id, link.documentId), eq(documents.contractorId, link.contractorId)))
    .limit(1);
  if (!row) return null;
  const lines = await db
    .select()
    .from(lineItems)
    .where(and(eq(lineItems.documentId, row.document.id), eq(lineItems.contractorId, link.contractorId)));
  const { contractor } = row;
  return {
    document: row.document,
    client: row.client,
    job: row.job,
    lines: lines.slice().sort((a, b) => a.sortOrder - b.sortOrder),
    // Only what is printed on the document. No ids, user links or billing counters.
    business: {
      businessName: contractor.businessName,
      businessAddress: contractor.businessAddress,
      phone: contractor.phone,
      email: contractor.email,
      gstHstNumber: contractor.gstHstNumber,
      taxLabel: contractor.taxLabel,
      taxRate: contractor.taxRate,
      etransferEmail: contractor.etransferEmail,
      etransferNote: contractor.etransferNote,
    },
  };
}

export type SharedQuoteResponse = "approved" | "declined";

/**
 * A client approves or declines a quote from its link. Applies the existing status rules
 * (setDocumentStatus), so approving moves the job from quoted to active. Repeating either,
 * or switching after the first answer, changes nothing and returns the stored result.
 */
async function recordShareAttempt(db: Database, linkId: string) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        attemptCount: documentLinks.attemptCount,
        attemptWindowStart: documentLinks.attemptWindowStart,
      })
      .from(documentLinks)
      .where(eq(documentLinks.id, linkId))
      .for("update");
    if (!row) throw new NotFoundError("Document not found.");
    const now = Date.now();
    const next = advanceShareAttemptWindow({
      now,
      windowStart: row.attemptWindowStart,
      count: row.attemptCount,
      max: SHARE_ATTEMPT_MAX,
      hourMs: SHARE_ATTEMPT_HOUR_MS,
    });
    if (!next.allow) throw new ValidationError(SHARE_ATTEMPT_LIMIT_MESSAGE);
    await tx
      .update(documentLinks)
      .set({ attemptCount: next.count, attemptWindowStart: next.windowStart })
      .where(eq(documentLinks.id, linkId));
  });
}

export async function respondToSharedQuote(db: Database, token: string, response: SharedQuoteResponse) {
  const link = await findActiveLink(db, token);
  if (!link) throw new NotFoundError("Document not found.");
  await recordShareAttempt(db, link.id);
  const ctx: ServiceContext = { db, contractorId: link.contractorId };
  const doc = await requireDocument(db, link.contractorId, link.documentId);
  if (doc.type !== "quote") throw new ValidationError("Document is not a quote.");
  const settled = (status: string) => status === "approved" || status === "declined";
  if (settled(doc.status)) return { documentId: doc.id, jobId: doc.jobId, status: doc.status as DocStatus, changed: false };

  try {
    // A draft shared before "Mark sent" is treated as sent the moment the client answers.
    if (doc.status === "draft") {
      try {
        await setDocumentStatus(ctx, doc.id, "sent");
      } catch (error) {
        if (!(error instanceof ValidationError)) throw error; // someone else already moved it
      }
    }
    await setDocumentStatus(ctx, doc.id, response);
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    // Lost a race with another answer: report what is stored.
    const latest = await requireDocument(db, link.contractorId, link.documentId);
    if (!settled(latest.status)) throw error;
    return { documentId: latest.id, jobId: latest.jobId, status: latest.status as DocStatus, changed: false };
  }
  return { documentId: doc.id, jobId: doc.jobId, status: response as DocStatus, changed: true };
}
