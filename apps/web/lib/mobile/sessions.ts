import { createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { contractors, mobileSessions } from "@/lib/db/schema";
import { newId, newToken } from "@/lib/id";

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export function hashMobileBearer(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createMobileSession(db: Database, input: { userId: string; contractorId: string }) {
  const now = Date.now();
  const token = newToken();
  const id = newId();
  await db.insert(mobileSessions).values({
    id,
    contractorId: input.contractorId,
    userId: input.userId,
    tokenHash: hashMobileBearer(token),
    createdAt: now,
    expiresAt: now + SESSION_MS,
  });
  return { token };
}

export async function resolveMobileSession(db: Database, bearer: string) {
  const trimmed = bearer.trim();
  if (!trimmed) return null;
  const tokenHash = hashMobileBearer(trimmed);
  const now = Date.now();
  const [row] = await db
    .select()
    .from(mobileSessions)
    .where(and(eq(mobileSessions.tokenHash, tokenHash), gt(mobileSessions.expiresAt, now)))
    .limit(1);
  if (!row) return null;
  const [contractor] = await db
    .select({ id: contractors.id, labourRateHourly: contractors.labourRateHourly })
    .from(contractors)
    .where(eq(contractors.id, row.contractorId))
    .limit(1);
  if (!contractor) return null;
  return { contractor, contractorId: row.contractorId, userId: row.userId, sessionId: row.id };
}
