import { and, eq, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureDb } from "@/lib/db";
import { contractors, jobs as jobsTable, clients } from "@/lib/db/schema";
import { jobIdForPlanTitle } from "@/lib/plans";
import { getPlanThread } from "@/lib/services/plans";
import { NotFoundError } from "@/lib/services/context";

export const runtime = "nodejs";

async function contractorForSession() {
  const session = await getSession();
  if (!session) return null;
  const db = await ensureDb();
  const [contractor] = await db.select().from(contractors).where(eq(contractors.id, session.contractorId)).limit(1);
  if (!contractor) return null;
  return { db, contractor };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await contractorForSession();
  if (!auth) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  const ctx = { db: auth.db, contractorId: auth.contractor.id };
  try {
    const thread = await getPlanThread(ctx, id);
    const jobRows = await auth.db
      .select({ id: jobsTable.id, title: jobsTable.title, clientName: clients.name })
      .from(jobsTable)
      .leftJoin(clients, and(eq(clients.id, jobsTable.clientId), eq(clients.contractorId, auth.contractor.id)))
      .where(and(eq(jobsTable.contractorId, auth.contractor.id), inArray(jobsTable.status, ["quoted", "active"])));
    const jobs = jobRows
      .filter((row) => row.title)
      .map((row) => ({ id: row.id, title: row.title, clientName: row.clientName }));
    return Response.json({
      id: thread.plan.id,
      messages: thread.messages,
      jobId: jobIdForPlanTitle(thread.plan.jobTitle, jobs),
    });
  } catch (error) {
    if (error instanceof NotFoundError) return Response.json({ error: "Plan not found." }, { status: 404 });
    throw error;
  }
}