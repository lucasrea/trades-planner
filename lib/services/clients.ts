import { and, desc, eq } from "drizzle-orm";
import { clients } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { NotFoundError, ValidationError, type ServiceContext } from "@/lib/services/context";

export async function listClients(ctx: ServiceContext) {
  return ctx.db.select().from(clients).where(eq(clients.contractorId, ctx.contractorId)).orderBy(desc(clients.createdAt));
}

export async function getClient(ctx: ServiceContext, clientId: string) {
  const [row] = await ctx.db.select().from(clients).where(and(eq(clients.id, clientId), eq(clients.contractorId, ctx.contractorId))).limit(1);
  return row ?? null;
}

export async function saveClient(
  ctx: ServiceContext,
  input: { id?: string; name: string; email?: string; phone?: string; billingAddress?: string },
) {
  const name = input.name.trim();
  if (!name) throw new ValidationError("Client name is required.");
  const values = {
    name,
    email: input.email?.trim() ?? "",
    phone: input.phone?.trim() ?? "",
    billingAddress: input.billingAddress?.trim() ?? "",
  };
  if (input.id) {
    const [updated] = await ctx.db.update(clients).set(values).where(and(eq(clients.id, input.id), eq(clients.contractorId, ctx.contractorId))).returning({ id: clients.id });
    if (!updated) throw new NotFoundError("Client not found.");
    return updated.id;
  }
  const id = newId();
  await ctx.db.insert(clients).values({ id, contractorId: ctx.contractorId, ...values, createdAt: Date.now() });
  return id;
}
