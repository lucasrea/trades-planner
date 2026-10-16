import { and, eq, gte } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { captures } from "@/lib/db/schema";

const MAX_CAPTURES_PER_HOUR = 30;

export async function assertCaptureRateLimit(db: Database, contractorId: string) {
  const since = Date.now() - 60 * 60 * 1000;
  const rows = await db
    .select({ id: captures.id })
    .from(captures)
    .where(and(eq(captures.contractorId, contractorId), gte(captures.createdAt, since)));
  if (rows.length >= MAX_CAPTURES_PER_HOUR) {
    throw new Response(JSON.stringify({ error: { code: "rate_limited", message: "You've hit the hourly capture limit." } }), {
      status: 429,
      headers: { "content-type": "application/json" },
    });
  }
}
