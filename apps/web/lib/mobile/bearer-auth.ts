import { ensureDb } from "@/lib/db";
import { resolveMobileSession } from "@/lib/mobile/sessions";

export function parseBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match?.[1]?.trim();
  return token || null;
}

export async function contractorFromBearer(request: Request) {
  const token = parseBearerToken(request);
  if (!token) return null;
  const db = await ensureDb();
  const session = await resolveMobileSession(db, token);
  if (!session) return null;
  return { db, contractor: session.contractor, contractorId: session.contractorId, userId: session.userId };
}
