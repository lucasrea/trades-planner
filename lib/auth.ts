import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { ensureDb } from "./db";
import { contractors } from "./db/schema";

export type AuthUser = {
  name: string;
  email: string;
  image: string;
};

export async function getSession() {
  const session = await auth();
  if (!session?.userId || !session.contractorId) return null;
  return { userId: session.userId, contractorId: session.contractorId };
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return {
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    image: session.user.image ?? "",
  };
}

export async function getContractor() {
  const session = await requireSession();
  const db = await ensureDb();
  const [row] = await db
    .select()
    .from(contractors)
    .where(eq(contractors.id, session.contractorId))
    .limit(1);
  if (!row) redirect("/login");
  return row;
}
