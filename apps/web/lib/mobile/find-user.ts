import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { contractors, users } from "@/lib/db/schema";

export async function findContractorForEmail(db: Database, email: string) {
  const normalized = email.toLowerCase().trim();
  const [user] = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  if (!user) return null;
  const [contractor] = await db.select().from(contractors).where(eq(contractors.userId, user.id)).limit(1);
  if (!contractor) return null;
  return { userId: user.id, contractorId: contractor.id };
}
