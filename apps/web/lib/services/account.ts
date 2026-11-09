import { and, eq, notExists } from "drizzle-orm";
import {
  captures,
  clients,
  contractors,
  documentLinks,
  documents,
  jobs,
  lineItems,
  planMessages,
  plans,
  users,
} from "@/lib/db/schema";
import { NotFoundError, ValidationError, type ServiceContext } from "@/lib/services/context";
import { receiptPathBelongsTo, type ReceiptStorage } from "@/lib/storage/receipts";

/**
 * Everything this contractor owns, as plain rows. No audio is stored, and receipt rows carry the
 * storage path (captures.imagePath), never image bytes. Every query is scoped by contractor_id.
 */
export async function exportAccountData({ db, contractorId }: ServiceContext) {
  const [contractor] = await db.select().from(contractors).where(eq(contractors.id, contractorId)).limit(1);
  if (!contractor) throw new NotFoundError("Contractor not found.");
  // Internal billing id is not the contractor's business data.
  const { stripeCustomerId: _stripeCustomerId, ...contractorRow } = contractor;
  void _stripeCustomerId;

  const [clientRows, jobRows, documentRows, lineRows, captureRows, planRows, planMessageRows, linkRows] = await Promise.all([
    db.select().from(clients).where(eq(clients.contractorId, contractorId)),
    db.select().from(jobs).where(eq(jobs.contractorId, contractorId)),
    db.select().from(documents).where(eq(documents.contractorId, contractorId)),
    db.select().from(lineItems).where(eq(lineItems.contractorId, contractorId)),
    db.select().from(captures).where(eq(captures.contractorId, contractorId)),
    db.select().from(plans).where(eq(plans.contractorId, contractorId)),
    db.select().from(planMessages).where(eq(planMessages.contractorId, contractorId)),
    db.select().from(documentLinks).where(eq(documentLinks.contractorId, contractorId)),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    contractor: contractorRow,
    clients: clientRows,
    jobs: jobRows,
    documents: documentRows,
    lineItems: lineRows,
    captures: captureRows,
    plans: planRows,
    planMessages: planMessageRows,
    documentLinks: linkRows,
  };
}

/** The typed confirmation must equal the business name, ignoring case and surrounding space. */
export function businessNameMatches(businessName: string, typed: string) {
  const expected = businessName.trim().toLowerCase();
  return expected.length > 0 && typed.trim().toLowerCase() === expected;
}

export type DeleteAccountResult = { receiptsRemoved: number; receiptsFailed: number };

/**
 * Deletes this contractor's rows in one transaction, then their receipt objects. A wrong business
 * name throws ValidationError and deletes nothing. Storage failures after the rows are gone are
 * counted, not thrown: the account is already deleted and the user is signed out regardless.
 */
export async function deleteAccount(
  { db, contractorId }: ServiceContext,
  input: { confirmBusinessName: string; storage: Pick<ReceiptStorage, "remove"> },
): Promise<DeleteAccountResult> {
  const receiptPaths = await db.transaction(async (tx) => {
    const [contractor] = await tx.select().from(contractors).where(eq(contractors.id, contractorId)).limit(1);
    if (!contractor) throw new NotFoundError("Contractor not found.");
    if (!businessNameMatches(contractor.businessName, input.confirmBusinessName)) {
      throw new ValidationError("Business name does not match.");
    }

    const captureRows = await tx
      .select({ imagePath: captures.imagePath })
      .from(captures)
      .where(eq(captures.contractorId, contractorId));

    await tx.delete(planMessages).where(eq(planMessages.contractorId, contractorId));
    await tx.delete(plans).where(eq(plans.contractorId, contractorId));
    await tx.delete(documentLinks).where(eq(documentLinks.contractorId, contractorId));
    await tx.delete(lineItems).where(eq(lineItems.contractorId, contractorId));
    await tx.delete(documents).where(eq(documents.contractorId, contractorId));
    await tx.delete(captures).where(eq(captures.contractorId, contractorId));
    await tx.delete(jobs).where(eq(jobs.contractorId, contractorId));
    await tx.delete(clients).where(eq(clients.contractorId, contractorId));
    await tx.delete(contractors).where(eq(contractors.id, contractorId));
    await tx.delete(users).where(
      and(
        eq(users.id, contractor.userId),
        notExists(tx.select({ id: contractors.id }).from(contractors).where(eq(contractors.userId, users.id))),
      ),
    );

    return captureRows
      .map((row) => row.imagePath)
      .filter((path): path is string => !!path && receiptPathBelongsTo(path, contractorId));
  });

  const results = await Promise.allSettled(receiptPaths.map((path) => input.storage.remove(path)));
  const failedPaths = results.flatMap((result, index) => (result.status === "rejected" ? [receiptPaths[index]] : []));
  if (failedPaths.length > 0) {
    console.error("Receipt objects left after account deletion", failedPaths);
  }
  return { receiptsRemoved: results.length - failedPaths.length, receiptsFailed: failedPaths.length };
}
