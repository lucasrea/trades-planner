import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ensureDb } from "./db";
import { contractors, users } from "./db/schema";
import { decodeSession, encodeSession, sessionCookie } from "./session";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 64);
  const prev = Buffer.from(hash, "hex");
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}

export async function getSession() {
  const jar = await cookies();
  return decodeSession(jar.get(sessionCookie.name)?.value);
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
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

export async function setSessionCookie(userId: string, contractorId: string) {
  const token = await encodeSession({ userId, contractorId });
  const jar = await cookies();
  jar.set(sessionCookie.name, token, sessionCookie.options);
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(sessionCookie.name, "", { ...sessionCookie.options, maxAge: 0 });
}

export async function findUserByEmail(email: string) {
  const db = await ensureDb();
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);
  return row;
}
