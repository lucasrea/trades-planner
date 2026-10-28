import { contractors, clients, jobs, users } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { getTestDb } from "./db";

export type TenantSeed = { userId: string; contractorId: string; clientId: string; jobId: string };

export async function seedTenant(label: string): Promise<TenantSeed> {
  const db = getTestDb();
  const now = Date.now();
  const userId = newId();
  const contractorId = newId();
  const clientId = newId();
  const jobId = newId();
  await db.insert(users).values({ id: userId, email: `${label}-${userId}@example.com`, name: label, createdAt: now });
  await db.insert(contractors).values({ id: contractorId, userId, businessName: label, email: `${label}@example.com`, nextQuoteNumber: 1, nextInvoiceNumber: 1 });
  await db.insert(clients).values({ id: clientId, contractorId, name: `Client ${label}`, createdAt: now });
  await db.insert(jobs).values({ id: jobId, contractorId, clientId, title: `Job ${label}`, status: "quoted", createdAt: now, updatedAt: now });
  return { userId, contractorId, clientId, jobId };
}

export async function seedTwoContractors() {
  return { a: await seedTenant("A"), b: await seedTenant("B") };
}
