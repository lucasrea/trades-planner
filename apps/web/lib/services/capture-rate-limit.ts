import { and, count, eq, gte, isNotNull, ne, or } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { captures } from "@/lib/db/schema";
import { RateLimitError } from "@/lib/services/context";

export const MAX_CAPTURES_PER_HOUR = 60;

/**
 * Caps model work per contractor. A question or a greeting answered from the books without the model
 * leaves a discarded row with no extraction and no model; those rows do not count. An answer the model
 * gave records its model, so it does.
 */
export async function assertCaptureRateLimit(db: Database, contractorId: string) {
  const since = Date.now() - 60 * 60 * 1000;
  const [row] = await db
    .select({ value: count() })
    .from(captures)
    .where(
      and(
        eq(captures.contractorId, contractorId),
        gte(captures.createdAt, since),
        or(ne(captures.status, "discarded"), isNotNull(captures.extraction), isNotNull(captures.model)),
      ),
    );
  if ((row?.value ?? 0) >= MAX_CAPTURES_PER_HOUR) {
    throw new RateLimitError("You've hit the hourly capture limit.");
  }
}
