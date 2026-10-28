import { and, count, eq, gte } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { captures } from "@/lib/db/schema";
import { RateLimitError } from "@/lib/services/context";

const MAX_CAPTURES_PER_HOUR = 30;

export async function assertCaptureRateLimit(db: Database, contractorId: string) {
  const since = Date.now() - 60 * 60 * 1000;
  const [row] = await db
    .select({ value: count() })
    .from(captures)
    .where(and(eq(captures.contractorId, contractorId), gte(captures.createdAt, since)));
  if ((row?.value ?? 0) >= MAX_CAPTURES_PER_HOUR) {
    throw new RateLimitError("You've hit the hourly capture limit.");
  }
}
