import { cache } from "react";
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

/** One JWT decode per request — layout + pages share this. */
const getAuthSession = cache(async () => auth());

export const getSession = cache(async () => {
  const session = await getAuthSession();
  if (!session?.userId || !session.contractorId) return null;
  return { userId: session.userId, contractorId: session.contractorId };
});

export const requireSession = cache(async () => {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
});

export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const session = await getAuthSession();
  if (!session?.user) return null;
  return {
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    image: session.user.image ?? "",
  };
});

export const getContractor = cache(async () => {
  const session = await requireSession();
  const db = await ensureDb();
  const [row] = await db
    .select()
    .from(contractors)
    .where(eq(contractors.id, session.contractorId))
    .limit(1);
  if (!row) redirect("/login");
  return row;
});

/** Layout helper — one auth round-trip, contractor row, and user display fields. */
export const getAppShellContext = cache(async () => {
  const contractor = await getContractor();
  const user = await getAuthUser();
  if (!user) redirect("/login");
  return { contractor, user };
});
