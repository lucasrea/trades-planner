import { eq } from "drizzle-orm";
import { exportJWK, createLocalJWKSet, generateKeyPair, SignJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DELETE as signOut, POST as signIn } from "@/app/api/mobile/session/route";
import { POST as confirmCapture } from "@/app/api/v1/captures/[id]/confirm/route";
import { POST as textCapture } from "@/app/api/v1/captures/text/route";
import { GET as listDocuments } from "@/app/api/v1/documents/route";
import { GET as listJobs } from "@/app/api/v1/jobs/route";
import { GET as listPlans } from "@/app/api/v1/plans/route";
import { contractors, mobileSessions, users } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import type { VerifiedAppleIdToken } from "@/lib/mobile/apple-id-token";
import { createSessionFromAppleIdToken } from "@/lib/mobile/create-session-from-id-token";
import { createMobileSession, resolveMobileSession } from "@/lib/mobile/sessions";
import * as appleModule from "@/lib/mobile/verify-apple-id-token";
import * as googleModule from "@/lib/mobile/verify-google-id-token";
import { getTestDb } from "../helpers/db";
import { seedTenant, type TenantSeed } from "../helpers/seed";

const env = process.env;
const SIGN_UP = "Sign up at trades-planner-bay.vercel.app first.";

function sessionPost(body: unknown) {
  return signIn(
    new Request("http://localhost/api/mobile/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function sessionDelete(token?: string) {
  return signOut(
    new Request("http://localhost/api/mobile/session", {
      method: "DELETE",
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  );
}

/** Every kind of bearer request the phone makes: reads, a text capture and a confirm. */
async function apiStatuses(token: string) {
  const headers = { authorization: `Bearer ${token}` };
  const get = (path: string) => new Request(`http://localhost${path}`, { headers });
  const responses = await Promise.all([
    listJobs(get("/api/v1/jobs")),
    listDocuments(get("/api/v1/documents")),
    listPlans(get("/api/v1/plans")),
    textCapture(
      new Request("http://localhost/api/v1/captures/text", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ text: "add a valve at $45" }),
      }),
    ),
    confirmCapture(new Request("http://localhost/api/v1/captures/x/confirm", { method: "POST", headers }), {
      params: Promise.resolve({ id: "x" }),
    }),
  ]);
  return responses.map((res) => res.status);
}

async function userFor(tenant: TenantSeed) {
  const [user] = await getTestDb().select().from(users).where(eq(users.id, tenant.userId)).limit(1);
  if (!user) throw new Error("missing user");
  return user;
}

async function sessionsFor(tenant: TenantSeed) {
  return getTestDb().select().from(mobileSessions).where(eq(mobileSessions.contractorId, tenant.contractorId));
}

function fakeApple(identity: Partial<VerifiedAppleIdToken> & { appleId: string }) {
  return vi
    .spyOn(appleModule, "verifyAppleIdToken")
    .mockImplementation(async () => ({ email: null, isPrivateEmail: false, ...identity }));
}

async function tokenFrom(res: Response) {
  expect(res.status).toBe(200);
  const body = (await res.json()) as { token: string };
  return body.token;
}

afterEach(() => {
  process.env = { ...env };
  vi.restoreAllMocks();
});

describe("mobile sign-out", () => {
  it("revokes that bearer and leaves the contractor's other sessions", async () => {
    const tenant = await seedTenant("signout");
    const db = getTestDb();
    const phone = (await createMobileSession(db, tenant)).token;
    const otherPhone = (await createMobileSession(db, tenant)).token;

    const res = await sessionDelete(phone);
    expect(res.status).toBe(204);
    expect(await resolveMobileSession(db, phone)).toBeNull();
    expect(await resolveMobileSession(db, otherPhone)).toMatchObject({ contractorId: tenant.contractorId });
    expect(await sessionsFor(tenant)).toHaveLength(1);
  });

  it("answers 401 to every request with a revoked bearer", async () => {
    process.env.AI_PROVIDER = "fake";
    const tenant = await seedTenant("signout-401");
    const token = (await createMobileSession(getTestDb(), tenant)).token;
    expect(await apiStatuses(token)).not.toContain(401);

    await sessionDelete(token);
    expect(await apiStatuses(token)).toEqual([401, 401, 401, 401, 401]);
  });

  it("answers 401 to an expired bearer", async () => {
    const tenant = await seedTenant("expired");
    const db = getTestDb();
    const token = (await createMobileSession(db, tenant)).token;
    await db
      .update(mobileSessions)
      .set({ expiresAt: Date.now() - 1 })
      .where(eq(mobileSessions.contractorId, tenant.contractorId));
    expect(await apiStatuses(token)).toEqual([401, 401, 401, 401, 401]);
  });

  it("succeeds when the bearer is already gone, and needs a bearer", async () => {
    expect((await sessionDelete("never-issued")).status).toBe(204);
    expect((await sessionDelete()).status).toBe(401);
  });
});

describe("mobile Google sign-in", () => {
  it("tells an unknown email to sign up, with its own error code", async () => {
    vi.spyOn(googleModule, "verifyGoogleIdToken").mockImplementation(async () =>
      googleModule.verifiedToken(`nobody-${newId()}@example.com`),
    );
    const res = await sessionPost({ idToken: "fake" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: { code: "no_account", message: SIGN_UP } });
  });

  it("gives the same answer to a user who has no contractor", async () => {
    const email = `orphan-${newId()}@example.com`;
    await getTestDb().insert(users).values({ id: newId(), email, createdAt: Date.now() });
    vi.spyOn(googleModule, "verifyGoogleIdToken").mockImplementation(async () => googleModule.verifiedToken(email));
    const res = await sessionPost({ idToken: "fake" });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("no_account");
  });

  it("answers 401 to a token that does not verify", async () => {
    vi.spyOn(googleModule, "verifyGoogleIdToken").mockImplementation(async () => null);
    const res = await sessionPost({ idToken: "fake" });
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthorized");
  });
});

describe("mobile Apple sign-in", () => {
  it("links the first sign-in to the account with that email, then finds it by Apple id", async () => {
    const tenant = await seedTenant("apple-link");
    const user = await userFor(tenant);
    const appleId = `apple-${newId()}`;

    fakeApple({ appleId, email: user.email });
    const token = await tokenFrom(await sessionPost({ idToken: "fake", provider: "apple" }));
    expect((await userFor(tenant)).appleId).toBe(appleId);
    expect(await resolveMobileSession(getTestDb(), token)).toMatchObject({ contractorId: tenant.contractorId });

    // Later tokens are matched on the Apple id, with no email or a changed one.
    vi.restoreAllMocks();
    fakeApple({ appleId });
    await tokenFrom(await sessionPost({ idToken: "fake", provider: "apple" }));
    vi.restoreAllMocks();
    fakeApple({ appleId, email: "changed@example.com" });
    await tokenFrom(await sessionPost({ idToken: "fake", provider: "apple" }));
    expect(await sessionsFor(tenant)).toHaveLength(3);
  });

  it("does not create an account for an unknown or missing email", async () => {
    const db = getTestDb();
    const before = {
      users: (await db.select().from(users)).length,
      contractors: (await db.select().from(contractors)).length,
    };
    for (const email of [`stranger-${newId()}@example.com`, null]) {
      vi.restoreAllMocks();
      fakeApple({ appleId: `apple-${newId()}`, email });
      const res = await sessionPost({ idToken: "fake", provider: "apple" });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe("no_account");
      expect(body.error.message).toContain(SIGN_UP);
      expect(body.error.message).toContain("Continue with Google");
    }
    expect((await db.select().from(users)).length).toBe(before.users);
    expect((await db.select().from(contractors)).length).toBe(before.contractors);
  });

  it("explains how to share the email when Apple hid it", async () => {
    fakeApple({ appleId: `apple-${newId()}`, email: "abc@privaterelay.appleid.com", isPrivateEmail: true });
    const res = await sessionPost({ idToken: "fake", provider: "apple" });
    expect(res.status).toBe(403);
    expect((await res.json()).error.message).toContain("Share My Email");
  });

  it("keeps the first Apple id and refuses a second one with the same email", async () => {
    const tenant = await seedTenant("apple-second");
    const email = `second-${newId()}@example.com`;
    await getTestDb().update(users).set({ email, appleId: "apple-first-" + email }).where(eq(users.id, tenant.userId));

    fakeApple({ appleId: `apple-other-${newId()}`, email });
    const res = await sessionPost({ idToken: "fake", provider: "apple" });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("apple_mismatch");
    expect((await userFor(tenant)).appleId).toBe("apple-first-" + email);
    expect(await sessionsFor(tenant)).toHaveLength(0);
  });

  it("answers 401 to a token that does not verify", async () => {
    vi.spyOn(appleModule, "verifyAppleIdToken").mockImplementation(async () => null);
    const res = await sessionPost({ idToken: "fake", provider: "apple" });
    expect(res.status).toBe(401);
  });

  it("rejects an unknown provider", async () => {
    const res = await sessionPost({ idToken: "fake", provider: "github" });
    expect(res.status).toBe(400);
  });

  it("signs in with a token checked by the real verifier against a local key", async () => {
    process.env.AUTH_APPLE_BUNDLE_ID = "com.example.app";
    const tenant = await seedTenant("apple-signed");
    const email = `signed-${newId()}@example.com`;
    await getTestDb().update(users).set({ email }).where(eq(users.id, tenant.userId));

    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" }] });
    const idToken = await new SignJWT({ email, email_verified: "true" })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer("https://appleid.apple.com")
      .setAudience("com.example.app")
      .setSubject(`apple-${newId()}`)
      .setExpirationTime("5m")
      .sign(privateKey);

    const result = await createSessionFromAppleIdToken(getTestDb(), idToken, appleModule.createAppleIdTokenVerifier(keys));
    expect(result).toHaveProperty("token");
    expect((await userFor(tenant)).appleId).toBeTruthy();
  });

  it("will not give one Apple id to two users", async () => {
    const a = await seedTenant("apple-unique-a");
    const b = await seedTenant("apple-unique-b");
    const db = getTestDb();
    const appleId = `apple-${newId()}`;
    await db.update(users).set({ appleId }).where(eq(users.id, a.userId));
    await expect(db.update(users).set({ appleId }).where(eq(users.id, b.userId))).rejects.toThrow();
  });
});
