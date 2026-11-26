import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { POST as cancelRoute } from "@/app/api/v1/captures/[id]/cancel/route";
import { POST as confirmRoute } from "@/app/api/v1/captures/[id]/confirm/route";
import { PATCH as linesRoute } from "@/app/api/v1/captures/[id]/lines/route";
import type { DescribeExtraction } from "@/lib/ai/extraction-types";
import { captures, documents, lineItems } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { createDraftDocument } from "@/lib/services/documents";
import { getTestDb } from "../helpers/db";
import { bearerFor, callRoute } from "../helpers/mobile";
import { seedTenant, type TenantSeed } from "../helpers/seed";

async function waitingCard(tenant: TenantSeed, extraction: Partial<DescribeExtraction> = {}, transcript = "add a valve to the job") {
  const id = newId();
  await getTestDb().insert(captures).values({
    id,
    contractorId: tenant.contractorId,
    jobId: tenant.jobId,
    type: "text",
    status: "needs_review",
    transcript,
    extraction: {
      intent: "log",
      action: "add_materials",
      client_name: null,
      client_id: null,
      job_title: null,
      job_id: tenant.jobId,
      site_address: null,
      scope_notes: null,
      lines: [{ kind: "material", description: "valve", quantity: 1, unit: "ea", unit_price: null }],
      warnings: [],
      ...extraction,
    },
    createdAt: Date.now(),
  });
  return id;
}

async function stored(captureId: string) {
  const [row] = await getTestDb().select().from(captures).where(eq(captures.id, captureId));
  return row!;
}

const edit = { lines: [{ description: "Ball valve", quantity: 2, unit: "ea", unitPrice: 45 }] };

describe("mobile Plan cards", () => {
  it("edits a blocked card's lines, then confirms what was saved", async () => {
    const tenant = await seedTenant("phone-lines");
    const token = await bearerFor(tenant);
    const captureId = await waitingCard(tenant);

    const blocked = await callRoute(confirmRoute, captureId, { token });
    expect(blocked.status).toBe(400);

    const res = await callRoute(linesRoute, captureId, { token, method: "PATCH", body: edit });
    expect(res.status).toBe(200);
    const { preview } = await res.json();
    expect(preview.canConfirm).toBe(true);
    expect(preview.blockers).toEqual([]);
    expect(preview.lines[0]).toMatchObject({ description: "Ball valve", quantity: 2, unitPrice: 45 });

    expect((await callRoute(confirmRoute, captureId, { token })).status).toBe(200);
    const lines = await getTestDb().select().from(lineItems).where(eq(lineItems.captureId, captureId));
    expect(lines).toMatchObject([{ description: "Ball valve", quantity: 2, unitPrice: 45, lineTotal: 90 }]);

    const late = await callRoute(linesRoute, captureId, { token, method: "PATCH", body: edit });
    expect(late.status).toBe(409);
    expect((await late.json()).error.message).toBe("This message was already confirmed or cancelled.");
    expect((await callRoute(cancelRoute, captureId, { token })).status).toBe(409);
  });

  it("explains a refused edit and keeps tracked-invoice cards read-only", async () => {
    const tenant = await seedTenant("phone-lines-refused");
    const token = await bearerFor(tenant);
    const captureId = await waitingCard(tenant);

    const empty = await callRoute(linesRoute, captureId, {
      token,
      method: "PATCH",
      body: { lines: [{ ...edit.lines[0], description: "  " }] },
    });
    expect(empty.status).toBe(400);
    expect((await empty.json()).error.message).toBe("Every line needs a description.");
    expect((await callRoute(linesRoute, captureId, { token, method: "PATCH", body: { lines: [{}] } })).status).toBe(400);

    const tracked = await waitingCard(tenant, { action: "invoice_tracked", intent: "invoice" });
    const refused = await callRoute(linesRoute, tracked, { token, method: "PATCH", body: edit });
    expect(refused.status).toBe(400);
    expect((await refused.json()).error.message).toBe("Edit these lines on the job.");
  });

  it("cancel discards the capture on the server, twice is fine", async () => {
    const tenant = await seedTenant("phone-cancel");
    const token = await bearerFor(tenant);
    const captureId = await waitingCard(tenant);

    expect((await callRoute(cancelRoute, captureId, { token })).status).toBe(200);
    expect((await stored(captureId)).status).toBe("discarded");
    expect((await callRoute(cancelRoute, captureId, { token })).status).toBe(200);
    expect((await callRoute(confirmRoute, captureId, { token })).status).not.toBe(200);
    expect(await getTestDb().select().from(lineItems).where(eq(lineItems.captureId, captureId))).toHaveLength(0);
  });

  it("confirming a change card says where it happened", async () => {
    const tenant = await seedTenant("phone-change");
    const token = await bearerFor(tenant);
    const { id: documentId } = await createDraftDocument(
      { db: getTestDb(), contractorId: tenant.contractorId },
      tenant.jobId,
      "quote",
    );
    const captureId = await waitingCard(
      tenant,
      { action: "change", lines: [], change: { kind: "document_status", document_id: documentId, to: "sent" } },
      "mark the quote sent",
    );

    const res = await callRoute(confirmRoute, captureId, { token });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ kind: "done", href: `/app/documents/${documentId}` });
    const [doc] = await getTestDb().select().from(documents).where(eq(documents.id, documentId));
    expect(doc?.status).toBe("sent");
  });

  it("refuses a missing token and another contractor's card", async () => {
    const owner = await seedTenant("phone-card-owner");
    const other = await seedTenant("phone-card-other");
    const token = await bearerFor(other);
    const captureId = await waitingCard(owner);
    const before = await stored(captureId);

    expect((await callRoute(cancelRoute, captureId)).status).toBe(401);
    expect((await callRoute(linesRoute, captureId, { method: "PATCH", body: edit })).status).toBe(401);
    expect((await callRoute(cancelRoute, captureId, { token })).status).toBe(404);
    expect((await callRoute(linesRoute, captureId, { token, method: "PATCH", body: edit })).status).toBe(404);
    expect((await callRoute(confirmRoute, captureId, { token })).status).toBe(404);

    expect(await stored(captureId)).toEqual(before);
    expect(
      await getTestDb()
        .select()
        .from(lineItems)
        .where(and(eq(lineItems.contractorId, owner.contractorId), eq(lineItems.captureId, captureId))),
    ).toHaveLength(0);
  });
});
