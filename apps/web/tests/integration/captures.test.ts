import { and, eq, isNull } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { captures, documents, lineItems } from "@/lib/db/schema";
import { NotFoundError, ValidationError } from "@/lib/services/context";
import { confirmCapture, discardCapture } from "@/lib/services/captures";
import { getTestDb } from "../helpers/db";
import { seedTenant, seedTwoContractors } from "../helpers/seed";
import { newId } from "@/lib/id";

async function seedCapture(
  ctx: { db: ReturnType<typeof getTestDb>; contractorId: string },
  type: string,
  extra: Partial<{ jobId: string | null; status: string }> = {},
) {
  const id = newId();
  await ctx.db.insert(captures).values({
    id,
    contractorId: ctx.contractorId,
    jobId: extra.jobId ?? null,
    type,
    status: extra.status ?? "needs_review",
    transcript: "test",
    extraction: {},
    createdAt: Date.now(),
  });
  return id;
}

describe("captures service", () => {
  it("confirms describe capture as quote draft", async () => {
    const tenant = await seedTenant("cq");
    const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
    const captureId = await seedCapture(ctx, "text");
    const result = await confirmCapture(ctx, {
      captureId,
      createAs: "quote",
      client: { id: tenant.clientId },
      job: { id: tenant.jobId },
      notes: "Scope",
      lines: [{ kind: "labour", description: "Work", quantity: 2, unit: "hr", unitPrice: 50 }],
    });
    expect(result.kind).toBe("document");
    if (result.kind !== "document") return;
    const [doc] = await ctx.db.select().from(documents).where(eq(documents.id, result.documentId)).limit(1);
    expect(doc?.type).toBe("quote");
    expect(doc?.total).toBeGreaterThan(0);
    const lines = await ctx.db.select().from(lineItems).where(eq(lineItems.captureId, captureId));
    expect(lines).toHaveLength(1);
  });

  it("confirms log capture as tracked lines", async () => {
    const tenant = await seedTenant("cl");
    const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
    const captureId = await seedCapture(ctx, "text");
    const result = await confirmCapture(ctx, {
      captureId,
      createAs: "log",
      client: { id: tenant.clientId },
      job: { id: tenant.jobId },
      lines: [{ kind: "material", description: "Part", quantity: 1, unit: "ea", unitPrice: 10 }],
    });
    expect(result).toEqual({ kind: "log", jobIds: [tenant.jobId] });
    const [line] = await ctx.db
      .select()
      .from(lineItems)
      .where(and(eq(lineItems.captureId, captureId), isNull(lineItems.documentId)));
    expect(line?.unitPrice).toBe(10);
  });

  it("rejects receipt confirm when createAs is not log", async () => {
    const tenant = await seedTenant("cr");
    const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
    const captureId = await seedCapture(ctx, "receipt");
    await expect(
      confirmCapture(ctx, {
        captureId,
        createAs: "quote",
        client: { id: tenant.clientId },
        job: { id: tenant.jobId },
        lines: [{ kind: "material", description: "X", quantity: 1, unit: "ea", unitPrice: 1, jobId: tenant.jobId }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects foreign job on receipt line", async () => {
    const { a, b } = await seedTwoContractors();
    const ctx = { db: getTestDb(), contractorId: a.contractorId };
    const captureId = await seedCapture(ctx, "receipt");
    await expect(
      confirmCapture(ctx, {
        captureId,
        createAs: "log",
        lines: [{ kind: "material", description: "X", quantity: 1, unit: "ea", unitPrice: 1, jobId: b.jobId }],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const rows = await ctx.db.select().from(lineItems).where(eq(lineItems.captureId, captureId));
    expect(rows).toHaveLength(0);
  });

  it("double confirm is idempotent", async () => {
    const tenant = await seedTenant("ci");
    const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
    const captureId = await seedCapture(ctx, "text");
    const input = {
      captureId,
      createAs: "invoice" as const,
      client: { id: tenant.clientId },
      job: { id: tenant.jobId },
      lines: [{ kind: "labour" as const, description: "Work", quantity: 1, unit: "hr", unitPrice: 80 }],
    };
    const first = await confirmCapture(ctx, input);
    const second = await confirmCapture(ctx, input);
    expect(second).toEqual(first);
    const docs = await ctx.db.select().from(documents).where(eq(documents.contractorId, tenant.contractorId));
    expect(docs.filter((d) => d.type === "invoice")).toHaveLength(1);
  });

  it("discard creates nothing", async () => {
    const tenant = await seedTenant("cd");
    const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
    const captureId = await seedCapture(ctx, "text");
    await discardCapture(ctx, captureId);
    const rows = await ctx.db.select().from(lineItems).where(eq(lineItems.captureId, captureId));
    expect(rows).toHaveLength(0);
    await expect(discardCapture(ctx, captureId)).resolves.toBeUndefined();
  });

  it("isolates tenants", async () => {
    const { a, b } = await seedTwoContractors();
    const db = getTestDb();
    const captureId = await seedCapture({ db, contractorId: b.contractorId }, "text");
    await expect(
      confirmCapture(
        { db, contractorId: a.contractorId },
        {
          captureId,
          createAs: "log",
          client: { id: a.clientId },
          job: { id: a.jobId },
          lines: [{ kind: "material", description: "X", quantity: 1, unit: "ea", unitPrice: 1 }],
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
