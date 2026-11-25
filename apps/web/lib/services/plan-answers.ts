import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { documents, jobs } from "@/lib/db/schema";
import { matchJobInText } from "@/lib/line-items";
import { formatJobPaperwork, planChatReply } from "@/lib/plan-message";

/** Answer a question from this contractor's jobs and documents. No model, no new rows. */
export async function answerPlanQuestion(db: Database, contractorId: string, text: string) {
  const jobRows = await db
    .select({ id: jobs.id, title: jobs.title })
    .from(jobs)
    .where(eq(jobs.contractorId, contractorId))
    .orderBy(desc(jobs.updatedAt))
    .limit(50);
  const jobId = matchJobInText(text, jobRows);
  const job = jobRows.find((row) => row.id === jobId) ?? null;
  if (!job) {
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
