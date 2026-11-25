import { and, eq, isNull } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DescribeExtraction } from "@/lib/ai/extraction-types";
import { captures, clients, documents, jobs, lineItems } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { NotFoundError, ValidationError } from "@/lib/services/context";
import { createDescribeCapture } from "@/lib/services/describe-capture";
import { cancelPlanProposal, confirmPlanProposal } from "@/lib/services/plan-proposals";
import { getTestDb } from "../helpers/db";
import { seedTenant, seedTwoContractors } from "../helpers/seed";

const env = process.env;

beforeEach(() => {
  process.env.AI_PROVIDER = "fake";
  process.env.AI_FAKE_MODE = "ok";
});

afterEach(() => {
  process.env = { ...env };
});

const valve = { kind: "material", description: "Valve", quantity: 1, unit: "ea", unit_price: 45 } as const;

function proposal(partial: Partial<DescribeExtraction>): DescribeExtraction {
  return {
    intent: null,
    client_name: null,
    job_title: null,
    site_address: null,
    scope_notes: null,
    lines: [],
    warnings: [],
    ...partial,
  };
}

async function seedProposal(contractorId: string, extraction: DescribeExtraction) {
  const db = getTestDb();
  const id = newId();
  await db.insert(captures).values({
    id,
    contractorId,
    type: "text",
    status: "needs_review",
    transcript: "message $45",
    extraction,
    createdAt: Date.now(),
  });
  return id;
}

async function counts(contractorId: string) {
  const db = getTestDb();
  const [docs, lines, jobRows, clientRows] = await Promise.all([
    db.select().from(documents).where(eq(documents.contractorId, contractorId)),
    db.select().from(lineItems).where(eq(lineItems.contractorId, contractorId)),
    db.select().from(jobs).where(eq(jobs.contractorId, contractorId)),
    db.select().from(clients).where(eq(clients.contractorId, contractorId)),
  ]);
  return { docs: docs.length, lines: lines.length, jobs: jobRows.length, clients: clientRows.length };
}

describe("plan proposals", () => {
  it("add a valve at $45 to the kitchen previews the material and confirm writes one unbilled line, no invoice", async () => {
    const tenant = await seedTenant("kitchen");
    const db = getTestDb();
    const ctx = { db, contractorId: tenant.contractorId };
    const result = await createDescribeCapture(
      db,
      { id: tenant.contractorId, labourRateHourly: 85 },
      { type: "text", resolveTranscript: async () => "add a valve at $45 to the kitchen" },
    );
    expect(result.status).toBe("needs_review");
    expect(result.preview).toMatchObject({
      action: "add_materials",
      title: "Add these materials to Job kitchen",
      canConfirm: true,
      lines: [{ description: "valve", quantity: 1, unitPrice: 45 }],
    });
    const before = await counts(tenant.contractorId);

    const confirmed = await confirmPlanProposal(ctx, result.captureId);
    expect(confirmed).toEqual({ kind: "log", jobIds: [tenant.jobId] });

    const lines = await db.select().from(lineItems).where(eq(lineItems.captureId, result.captureId));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      jobId: tenant.jobId,
      kind: "material",
      unitPrice: 45,
      documentId: null,
      billedDocumentId: null,
    });
    const after = await counts(tenant.contractorId);
    expect(after.docs).toBe(0);
    expect(after.lines).toBe(before.lines + 1);
    const [row] = await db.select().from(captures).where(eq(captures.id, result.captureId));
    expect(row?.status).toBe("confirmed");
  });

  it("log hours uses the contractor labour rate and writes unbilled labour", async () => {
    const tenant = await seedTenant("hours");
    const db = getTestDb();
    const ctx = { db, contractorId: tenant.contractorId };
    const result = await createDescribeCapture(
      db,
      { id: tenant.contractorId, labourRateHourly: 85 },
      { type: "text", resolveTranscript: async () => "log 3 hours on the hours" },
    );
    expect(result.preview?.action).toBe("log_hours");
    await confirmPlanProposal(ctx, result.captureId);
    const [line] = await db
      .select()
      .from(lineItems)
      .where(and(eq(lineItems.captureId, result.captureId), isNull(lineItems.documentId)));
    expect(line).toMatchObject({ kind: "labour", quantity: 3, unitPrice: 85, jobId: tenant.jobId });
    expect((await counts(tenant.contractorId)).docs).toBe(0);
  });

  it("make a quote confirms to a draft quote on a new job, reusing the matching client", async () => {
    const tenant = await seedTenant("quote");
    const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
    const captureId = await seedProposal(
      tenant.contractorId,
      {
        ...proposal({ intent: "quote", client_name: "Client quote", job_title: "Deck", scope_notes: "Cedar", lines: [valve] }),
        action: "make_quote",
        client_id: tenant.clientId,
      },
    );
    const result = await confirmPlanProposal(ctx, captureId);
    expect(result.kind).toBe("document");
    if (result.kind !== "document") return;
    const [doc] = await ctx.db.select().from(documents).where(eq(documents.id, result.documentId));
    expect(doc).toMatchObject({ type: "quote", status: "draft", notes: "Cedar", clientId: tenant.clientId });
    expect(doc?.total).toBeGreaterThan(0);
    const after = await counts(tenant.contractorId);
    expect(after).toMatchObject({ docs: 1, clients: 1, jobs: 2 });
  });

  it("make an invoice confirms to a draft invoice on the existing job", async () => {
    const tenant = await seedTenant("invoice");
    const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
    const captureId = await seedProposal(tenant.contractorId, {
      ...proposal({ intent: "invoice", lines: [valve] }),
      action: "make_invoice",
      job_id: tenant.jobId,
      client_id: tenant.clientId,
    });
    const result = await confirmPlanProposal(ctx, captureId);
    expect(result.kind).toBe("document");
    if (result.kind !== "document") return;
    const [doc] = await ctx.db.select().from(documents).where(eq(documents.id, result.documentId));
    expect(doc).toMatchObject({ type: "invoice", status: "draft", jobId: tenant.jobId });
  });

  it("create a job writes a job and a new client only when none matched; a second confirm returns the same job", async () => {
    const tenant = await seedTenant("create");
    const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
    const fresh = await seedProposal(tenant.contractorId, {
      ...proposal({ client_name: "Okafor", job_title: "Deck", site_address: "9 Oak" }),
      action: "create_job",
    });
    const first = await confirmPlanProposal(ctx, fresh);
    expect(first.kind).toBe("job");
    expect(await confirmPlanProposal(ctx, fresh)).toEqual(first);
    let after = await counts(tenant.contractorId);
    expect(after).toMatchObject({ jobs: 2, clients: 2, docs: 0, lines: 0 });

    const known = await seedProposal(tenant.contractorId, {
      ...proposal({ client_name: "Client create", job_title: "Fence" }),
      action: "create_job",
      client_id: tenant.clientId,
    });
    await confirmPlanProposal(ctx, known);
    after = await counts(tenant.contractorId);
    expect(after).toMatchObject({ jobs: 3, clients: 2 });
  });

  it("cancel writes nothing and confirm after cancel is refused", async () => {
    const tenant = await seedTenant("cancel");
    const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
    const captureId = await seedProposal(tenant.contractorId, {
      ...proposal({ intent: "log", lines: [valve] }),
      action: "add_materials",
      job_id: tenant.jobId,
      client_id: tenant.clientId,
    });
    const before = await counts(tenant.contractorId);
    await cancelPlanProposal(ctx, captureId);
    expect(await counts(tenant.contractorId)).toEqual(before);
    const [row] = await ctx.db.select().from(captures).where(eq(captures.id, captureId));
    expect(row?.status).toBe("discarded");
    await expect(confirmPlanProposal(ctx, captureId)).rejects.toThrow();
    expect(await counts(tenant.contractorId)).toEqual(before);
  });

  it("refuses to confirm a line with no price", async () => {
    const tenant = await seedTenant("noprice");
    const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
    const captureId = await seedProposal(tenant.contractorId, {
      ...proposal({ intent: "log", lines: [{ ...valve, unit_price: null }] }),
      action: "add_materials",
      job_id: tenant.jobId,
      client_id: tenant.clientId,
    });
    await expect(confirmPlanProposal(ctx, captureId)).rejects.toBeInstanceOf(ValidationError);
    expect((await counts(tenant.contractorId)).lines).toBe(0);
  });

  it("is scoped by contractor: a foreign capture or a foreign job id cannot be confirmed", async () => {
    const { a, b } = await seedTwoContractors();
    const db = getTestDb();
    const bCapture = await seedProposal(b.contractorId, {
      ...proposal({ intent: "log", lines: [valve] }),
      action: "add_materials",
      job_id: b.jobId,
      client_id: b.clientId,
    });
    await expect(confirmPlanProposal({ db, contractorId: a.contractorId }, bCapture)).rejects.toBeInstanceOf(NotFoundError);
    await expect(cancelPlanProposal({ db, contractorId: a.contractorId }, bCapture)).rejects.toBeInstanceOf(NotFoundError);

    const aCaptureForeignJob = await seedProposal(a.contractorId, {
      ...proposal({ intent: "log", lines: [valve] }),
      action: "add_materials",
      job_id: b.jobId,
      client_id: b.clientId,
    });
    await expect(confirmPlanProposal({ db, contractorId: a.contractorId }, aCaptureForeignJob)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect((await counts(a.contractorId)).lines).toBe(0);
    expect((await counts(b.contractorId)).lines).toBe(0);
  });
});
