import { and, count, eq, gte, inArray, lt } from "drizzle-orm";
import { ensureDb } from "@/lib/db";
import { clients, invoices, jobs, quotes } from "@/lib/db/schema";
import { monthRange, type PlanUsage } from "@/lib/entitlements";

export async function getPlanUsage(contractorId: string, now = new Date()): Promise<PlanUsage> {
  const db = await ensureDb();
  const { start, end } = monthRange(now);

  const [clientRow] = await db
    .select({ value: count() })
    .from(clients)
    .where(eq(clients.contractorId, contractorId));

  const [jobRow] = await db
    .select({ value: count() })
    .from(jobs)
    .where(
      and(eq(jobs.contractorId, contractorId), inArray(jobs.status, ["quoted", "active"])),
    );

  const [documentRow] = await db
    .select({ value: count() })
    .from(quotes)
    .where(
      and(eq(quotes.contractorId, contractorId), gte(quotes.createdAt, start), lt(quotes.createdAt, end)),
    );

  const [invoiceRow] = await db
    .select({ value: count() })
    .from(invoices)
    .where(
      and(
        eq(invoices.contractorId, contractorId),
        gte(invoices.createdAt, start),
        lt(invoices.createdAt, end),
      ),
    );

  return {
    clients: Number(clientRow?.value ?? 0),
    activeJobs: Number(jobRow?.value ?? 0),
    documentsThisMonth: Number(documentRow?.value ?? 0) + Number(invoiceRow?.value ?? 0),
  };
}
