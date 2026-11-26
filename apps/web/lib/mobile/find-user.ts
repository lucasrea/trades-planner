import { and, eq, isNull, or } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { contractors, users } from "@/lib/db/schema";
import type { VerifiedAppleIdToken } from "@/lib/mobile/apple-id-token";

async function findContractorForUser(db: Database, userId: string) {
  const [contractor] = await db.select().from(contractors).where(eq(contractors.userId, userId)).limit(1);
  if (!contractor) return null;
  return { userId, contractorId: contractor.id };
}

export async function findContractorForEmail(db: Database, email: string) {
  const normalized = email.toLowerCase().trim();
  const [user] = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  if (!user) return null;
  return findContractorForUser(db, user.id);
}

export type AppleAccount =
  | { userId: string; contractorId: string }
  | { kind: "no_account" }
  | { kind: "apple_mismatch" };

/**
 * An Apple id that is already linked finds its account whatever the email says. Otherwise the first
 * sign-in links it to the account with the same verified email. It never creates an account, and
 * never replaces an Apple id that is already on one.
 */
export async function findOrLinkContractorForApple(
  db: Database,
  identity: VerifiedAppleIdToken,
): Promise<AppleAccount> {
  const [linked] = await db.select().from(users).where(eq(users.appleId, identity.appleId)).limit(1);
  if (linked) return (await findContractorForUser(db, linked.id)) ?? { kind: "no_account" };

  if (!identity.email) return { kind: "no_account" };
  const account = await findContractorForEmail(db, identity.email);
  if (!account) return { kind: "no_account" };

  // One conditional write, so two different Apple ids cannot both claim the account.
  const claimed = await db
    .update(users)
    .set({ appleId: identity.appleId })
    .where(and(eq(users.id, account.userId), or(isNull(users.appleId), eq(users.appleId, identity.appleId))))
    .returning({ id: users.id });
  return claimed.length > 0 ? account : { kind: "apple_mismatch" };
}
