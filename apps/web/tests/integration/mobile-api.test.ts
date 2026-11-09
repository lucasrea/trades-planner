import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as confirmCapture } from "@/app/api/v1/captures/[id]/confirm/route";
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

  it("text capture returns preview without plan id", async () => {
    const tenant = await seedTenant("mobile-text");
    const token = await bearerFor(tenant);
    const res = await textPost(token, { text: "add a valve at $45 to the kitchen" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("needs_review");
    expect(body.preview?.title).toContain("Add these materials");
    expect(body.preview?.lines?.length).toBeGreaterThan(0);
    expect(body.planId).toBeUndefined();
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
      transcript: "add valve",
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
});
