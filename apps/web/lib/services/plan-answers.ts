import { and, desc, eq, isNull } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { clients, documents, jobs, lineItems } from "@/lib/db/schema";
import { matchJobInText } from "@/lib/line-items";
import { asksForAllJobs, formatAllJobsUnbilled, formatJobUnbilled, unbilledSummary } from "@/lib/plan-lookup";
import { formatJobPaperwork, planChatReply } from "@/lib/plan-message";

const ASKS_UNBILLED = /\bunbilled\b/i;
const ASKS_JOBS_LIST = /\b(my\s+jobs|open\s+jobs|list\s+(?:my\s+|all\s+)?jobs|what\s+jobs|which\s+jobs)\b/i;

/** Answer a question from this contractor's jobs, unbilled work, and documents. No model, no new rows. */
export async function answerPlanQuestion(
  db: Database,
  contractorId: string,
  text: string,
  selectedJobId?: string | null,
  labourRate = 0,
) {
  const jobRows = await db
    .select({ id: jobs.id, title: jobs.title, clientName: clients.name })
    .from(jobs)
    .leftJoin(clients, and(eq(clients.id, jobs.clientId), eq(clients.contractorId, contractorId)))
    .where(eq(jobs.contractorId, contractorId))
    .orderBy(desc(jobs.updatedAt))
    .limit(50);

  const wantsAll = asksForAllJobs(text);
  const selected = !wantsAll && selectedJobId ? jobRows.find((row) => row.id === selectedJobId) : null;
  const matchedId = wantsAll ? null : (matchJobInText(text, jobRows) ?? selected?.id ?? null);
  const job = jobRows.find((row) => row.id === matchedId) ?? null;

  if (ASKS_UNBILLED.test(text)) {
    if (job) {
      const rows = await db
        .select({
          id: lineItems.id,
          kind: lineItems.kind,
          description: lineItems.description,
          quantity: lineItems.quantity,
          unit: lineItems.unit,
          unitPrice: lineItems.unitPrice,
        })
        .from(lineItems)
        .where(
          and(
            eq(lineItems.contractorId, contractorId),
            eq(lineItems.jobId, job.id),
            isNull(lineItems.documentId),
            isNull(lineItems.billedDocumentId),
          ),
        );
      return {
        reply: formatJobUnbilled(job.title, unbilledSummary(rows, labourRate)),
        jobTitle: job.title,
      };
    }

    const rows = await db
      .select({
        id: lineItems.id,
        jobId: lineItems.jobId,
        kind: lineItems.kind,
        description: lineItems.description,
        quantity: lineItems.quantity,
        unit: lineItems.unit,
        unitPrice: lineItems.unitPrice,
      })
      .from(lineItems)
      .where(
        and(
          eq(lineItems.contractorId, contractorId),
          isNull(lineItems.documentId),
          isNull(lineItems.billedDocumentId),
        ),
      );
    const byJob = new Map<string, typeof rows>();
    for (const row of rows) {
      const bucket = byJob.get(row.jobId);
      if (bucket) bucket.push(row);
      else byJob.set(row.jobId, [row]);
    }
    const entries = jobRows.map((row) => {
      const summary = unbilledSummary(byJob.get(row.id) ?? [], labourRate);
      return {
        jobTitle: row.title,
        clientName: row.clientName,
        lineCount: summary.lines.length,
        total: summary.total,
      };
    });
    return { reply: formatAllJobsUnbilled(entries), jobTitle: null };
  }

  if (!job) {
    if (ASKS_JOBS_LIST.test(text) && !/\b(quotes?|invoices?|drafts?|documents?)\b/i.test(text)) {
      if (jobRows.length === 0) {
        return { reply: "You don't have any jobs yet. Tell me the job name and I can create it.", jobTitle: null };
      }
      const list = jobRows.slice(0, 12).map((row) => (row.clientName ? `• ${row.title} (${row.clientName})` : `• ${row.title}`));
      return { reply: `Your jobs:\n${list.join("\n")}`, jobTitle: null };
    }
    return { reply: formatJobPaperwork({ jobTitle: null, jobNames: jobRows.map((row) => row.title), documents: [] }), jobTitle: null };
  }

  const docs = await db
    .select({ type: documents.type, number: documents.number, status: documents.status })
    .from(documents)
    .where(and(eq(documents.contractorId, contractorId), eq(documents.jobId, job.id)))
    .orderBy(desc(documents.updatedAt));
  return {
    reply: formatJobPaperwork({ jobTitle: job.title, jobNames: jobRows.map((row) => row.title), documents: docs }),
    jobTitle: job.title,
  };
}

export function chatPlanReply() {
  return { reply: planChatReply(), jobTitle: null as string | null };
}
