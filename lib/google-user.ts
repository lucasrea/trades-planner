import { eq } from "drizzle-orm";
import { ensureDb } from "./db";
import { contractors, users } from "./db/schema";

function id() {
  return crypto.randomUUID();
}

export async function upsertGoogleUser(input: {
  email: string;
  name: string;
  image: string;
  googleId: string;
}) {
  const db = await ensureDb();
  const email = input.email.toLowerCase().trim();
  const now = Date.now();

  const [byGoogle] = input.googleId
    ? await db.select().from(users).where(eq(users.googleId, input.googleId)).limit(1)
    : [];
  const [byEmail] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const existing = byGoogle ?? byEmail;

  if (existing) {
    await db
      .update(users)
      .set({
        email,
        name: input.name,
        image: input.image,
        googleId: input.googleId,
      })
      .where(eq(users.id, existing.id));

    const [contractor] = await db
      .select()
      .from(contractors)
      .where(eq(contractors.userId, existing.id))
      .limit(1);

    if (contractor) {
      return { userId: existing.id, contractorId: contractor.id };
    }

    const contractorId = id();
    await db.insert(contractors).values({
      id: contractorId,
      userId: existing.id,
      email,
      plan: "free",
    });
    return { userId: existing.id, contractorId };
  }

  const userId = id();
  const contractorId = id();
  await db.insert(users).values({
    id: userId,
    email,
    name: input.name,
    image: input.image,
    googleId: input.googleId,
    passwordHash: "",
    createdAt: now,
  });
  await db.insert(contractors).values({
    id: contractorId,
    userId,
    email,
    plan: "free",
  });
  return { userId, contractorId };
}
