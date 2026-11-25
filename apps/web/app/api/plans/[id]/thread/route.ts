import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureDb } from "@/lib/db";
import { contractors } from "@/lib/db/schema";
import { NotFoundError } from "@/lib/services/context";
import { planThreadPayload } from "@/lib/services/plan-thread-payload";

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
    const payload = await planThreadPayload(ctx, id);
    return Response.json(payload);
  } catch (error) {
    if (error instanceof NotFoundError) return Response.json({ error: "Plan not found." }, { status: 404 });
    throw error;
  }
}