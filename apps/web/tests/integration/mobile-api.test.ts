import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as confirmCapture } from "@/app/api/v1/captures/[id]/confirm/route";
import { GET as listDocuments } from "@/app/api/v1/documents/route";
import { GET as getDocument } from "@/app/api/v1/documents/[id]/route";
import { GET as listJobs } from "@/app/api/v1/jobs/route";
import { GET as getJob } from "@/app/api/v1/jobs/[id]/route";
import { GET as listPlansRoute } from "@/app/api/v1/plans/route";
import { GET as planThread } from "@/app/api/v1/plans/[id]/thread/route";
import { POST as textCapture } from "@/app/api/v1/captures/text/route";
import { POST as mobileSession } from "@/app/api/mobile/session/route";
import type { DescribeExtraction } from "@/lib/ai/extraction-types";
import * as verifyModule from "@/lib/mobile/verify-google-id-token";
import { captures, documents, lineItems, mobileSessions, users } from "@/lib/db/schema";
import type { GoogleIdTokenVerifier } from "@/lib/mobile/google-id-token";
import { createMobileSession, hashMobileBearer, resolveMobileSession } from "@/lib/mobile/sessions";
import { createSessionFromIdToken } from "@/lib/mobile/create-session-from-id-token";
import { verifiedToken } from "@/lib/mobile/verify-google-id-token";
import { getTestDb } from "../helpers/db";
import { seedTenant, seedTwoContractors } from "../helpers/seed";
import { newId } from "@/lib/id";

const env = process.env;

function fakeVerify(email: string): GoogleIdTokenVerifier {
  return async () => verifiedToken(email);
}

async function bearerFor(tenant: { userId: string; contractorId: string }) {
  const db = getTestDb();
  return (await createMobileSession(db, tenant)).token;
}

function sessionPost(idToken: string) {
  return mobileSession(
    new Request("http://localhost/api/mobile/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken }),
    }),
  );
}

function textPost(token: string, body: unknown) {
  return textCapture(
    new Request("http://localhost/api/v1/captures/text", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }),
  );
}

function confirmPost(token: string, captureId: string) {
  return confirmCapture(
    new Request("http://localhost/api/v1/captures/" + captureId + "/confirm", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    }),
    { params: Promise.resolve({ id: captureId }) },
  );
}

describe("mobile API", () => {
  beforeEach(() => {
    process.env.AI_PROVIDER = "fake";
    process.env.AI_FAKE_MODE = "ok";
  });

  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  it("fake verifier signs in a seeded user and stores only the hash", async () => {
    const tenant = await seedTenant("mobile-session");
    const db = getTestDb();
    const [user] = await db.select().from(users).where(eq(users.id, tenant.userId)).limit(1);
    if (!user) throw new Error("missing user");
    const result = await createSessionFromIdToken(db, "id-token", fakeVerify(user.email));
    expect("token" in result).toBe(true);
    if (!("token" in result)) throw new Error("expected token");
    const rows = await db.select().from(mobileSessions).where(eq(mobileSessions.contractorId, tenant.contractorId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).toBe(hashMobileBearer(result.token));
    expect(rows[0]?.tokenHash).not.toBe(result.token);
    expect(await resolveMobileSession(db, result.token)).toMatchObject({ contractorId: tenant.contractorId });
  });

  it("unknown email returns unauthorized from session route", async () => {
    vi.spyOn(verifyModule, "verifyGoogleIdToken").mockImplementation(fakeVerify("missing@example.com"));
    const res = await sessionPost("fake");
    expect(res.status).toBe(401);
  });

  it("text capture with planId records a thread readable from v1 plans", async () => {
    const tenant = await seedTenant("mobile-plan-thread");
    const token = await bearerFor(tenant);
    const send = await textPost(token, { text: "add a valve at $45 to the kitchen", planId: "new" });
    expect(send.status).toBe(200);
    const body = await send.json();
    expect(body.planId).toBeTruthy();

    const plansRes = await listPlansRoute(
      new Request("http://localhost/api/v1/plans", { headers: { authorization: `Bearer ${token}` } }),
    );
    expect(plansRes.status).toBe(200);
    const plansBody = await plansRes.json();
    expect(plansBody.plans.some((plan: { id: string }) => plan.id === body.planId)).toBe(true);

    const threadRes = await planThread(
      new Request(`http://localhost/api/v1/plans/${body.planId}/thread`, {
        headers: { authorization: `Bearer ${token}` },
      }),
      { params: Promise.resolve({ id: body.planId }) },
    );
    expect(threadRes.status).toBe(200);
    const thread = await threadRes.json();
    expect(thread.messages.length).toBeGreaterThanOrEqual(2);
  });

  it("text capture returns preview without plan id", async () => {
    const tenant = await seedTenant("mobile-text");
    const token = await bearerFor(tenant);
    const res = await textPost(token, { text: "add a valve at $45 to the kitchen" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("needs_review");
    expect(body.preview?.title).toContain("Add these materials");
    expect(body.preview?.lines?.length).toBeGreaterThan(0);
    expect(body.planId).toBeFalsy();
  });

  it("confirm writes the same rows and blocks cross-tenant capture", async () => {
    const tenant = await seedTenant("mobile-confirm");
    const { b } = await seedTwoContractors();
    const db = getTestDb();
    const tokenA = await bearerFor(tenant);
    const tokenB = await bearerFor(b);

    const extraction: DescribeExtraction = {
      intent: "log",
      action: "add_materials",
      client_name: null,
      client_id: null,
      job_title: null,
      job_id: tenant.jobId,
      site_address: null,
      scope_notes: null,
      lines: [{ kind: "material", description: "valve", quantity: 1, unit: "ea", unit_price: 45 }],
      warnings: [],
    };
    const captureId = newId();
    await db.insert(captures).values({
      id: captureId,
      contractorId: tenant.contractorId,
      jobId: tenant.jobId,
      type: "text",
      status: "needs_review",
      transcript: "add a valve at 45",
      extraction,
      createdAt: Date.now(),
    });

    const deny = await confirmPost(tokenB, captureId);
    expect(deny.status).toBe(404);

    const ok = await confirmPost(tokenA, captureId);
    expect(ok.status).toBe(200);
    const confirmed = await ok.json();
    expect(confirmed.kind).toBe("log");

    const lines = await db
      .select()
      .from(lineItems)
      .where(and(eq(lineItems.contractorId, tenant.contractorId), eq(lineItems.captureId, captureId)));
    expect(lines).toHaveLength(1);
    expect(await db.select().from(documents).where(eq(documents.contractorId, tenant.contractorId))).toHaveLength(0);
  });

  it("read routes return tenant data and hide other tenants", async () => {
    const tenant = await seedTenant("mobile-reads");
    const { b } = await seedTwoContractors();
    const tokenA = await bearerFor(tenant);
    const tokenB = await bearerFor(b);

    const jobsRes = await listJobs(
      new Request("http://localhost/api/v1/jobs", { headers: { authorization: `Bearer ${tokenA}` } }),
    );
    expect(jobsRes.status).toBe(200);
    const jobsBody = await jobsRes.json();
    expect(jobsBody.jobs.some((job: { id: string }) => job.id === tenant.jobId)).toBe(true);

    const jobRes = await getJob(
      new Request(`http://localhost/api/v1/jobs/${tenant.jobId}`, { headers: { authorization: `Bearer ${tokenA}` } }),
      { params: Promise.resolve({ id: tenant.jobId }) },
    );
    expect(jobRes.status).toBe(200);
    const foreignJob = await getJob(
      new Request(`http://localhost/api/v1/jobs/${tenant.jobId}`, { headers: { authorization: `Bearer ${tokenB}` } }),
      { params: Promise.resolve({ id: tenant.jobId }) },
    );
    expect(foreignJob.status).toBe(404);

    const docsRes = await listDocuments(
      new Request("http://localhost/api/v1/documents", { headers: { authorization: `Bearer ${tokenA}` } }),
    );
    expect(docsRes.status).toBe(200);

    const docId = newId();
    const db = getTestDb();
    await db.insert(documents).values({
      id: docId,
      contractorId: tenant.contractorId,
      clientId: tenant.clientId,
      jobId: tenant.jobId,
      type: "quote",
      status: "draft",
      number: "Q-TEST-1",
      notes: "",
      validUntil: null,
      dueDate: null,
      subtotal: 100,
      tax: 13,
      total: 113,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const docRes = await getDocument(
      new Request(`http://localhost/api/v1/documents/${docId}`, { headers: { authorization: `Bearer ${tokenA}` } }),
      { params: Promise.resolve({ id: docId }) },
    );
    expect(docRes.status).toBe(200);
    const docBody = await docRes.json();
    expect(docBody.document.number).toBe("Q-TEST-1");

    const foreignDoc = await getDocument(
      new Request(`http://localhost/api/v1/documents/${docId}`, { headers: { authorization: `Bearer ${tokenB}` } }),
      { params: Promise.resolve({ id: docId }) },
    );
    expect(foreignDoc.status).toBe(404);
  });
});
