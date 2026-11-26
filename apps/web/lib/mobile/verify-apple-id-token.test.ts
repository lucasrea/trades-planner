import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from "jose";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createAppleIdTokenVerifier } from "@/lib/mobile/verify-apple-id-token";

const env = process.env;
const BUNDLE = "com.example.app";

let privateKey: CryptoKey;
let strangerKey: CryptoKey;
let verify: ReturnType<typeof createAppleIdTokenVerifier>;

function sign(
  claims: JWTPayload,
  options: { key?: CryptoKey; issuer?: string; audience?: string; expires?: string | null; subject?: string | null } = {},
) {
  const jwt = new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(options.issuer ?? "https://appleid.apple.com")
    .setAudience(options.audience ?? BUNDLE);
  if (options.subject !== null) jwt.setSubject(options.subject ?? "apple-user-1");
  if (options.expires !== null) jwt.setExpirationTime(options.expires ?? "5m");
  return jwt.sign(options.key ?? privateKey);
}

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  strangerKey = (await generateKeyPair("RS256")).privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
  verify = createAppleIdTokenVerifier(createLocalJWKSet({ keys: [jwk] }));
});

beforeEach(() => {
  process.env.AUTH_APPLE_BUNDLE_ID = BUNDLE;
});

afterEach(() => {
  process.env = { ...env };
});

describe("Apple ID token verifier", () => {
  it("returns the Apple id and the lowercased verified email", async () => {
    const token = await sign({ email: " Joe@Example.com ", email_verified: true });
    expect(await verify(token)).toEqual({ appleId: "apple-user-1", email: "joe@example.com", isPrivateEmail: false });
  });

  it("reads the string forms of the boolean claims", async () => {
    const token = await sign({ email: "x@privaterelay.appleid.com", email_verified: "true", is_private_email: "true" });
    expect(await verify(token)).toMatchObject({ email: "x@privaterelay.appleid.com", isPrivateEmail: true });
  });

  it("drops an email that Apple has not verified", async () => {
    for (const claims of [
      { email: "joe@example.com" },
      { email: "joe@example.com", email_verified: false },
      { email: "joe@example.com", email_verified: "false" },
    ]) {
      expect(await verify(await sign(claims))).toMatchObject({ appleId: "apple-user-1", email: null });
    }
  });

  it("rejects a token that is not for this app, not from Apple, expired, or signed by another key", async () => {
    const claims = { email: "joe@example.com", email_verified: true };
    const bad = [
      await sign(claims, { audience: "com.someone.else" }),
      await sign(claims, { issuer: "https://accounts.google.com" }),
      await sign(claims, { expires: "-1m" }),
      await sign(claims, { expires: null }),
      await sign(claims, { subject: null }),
      await sign(claims, { key: strangerKey }),
      "not-a-token",
    ];
    for (const token of bad) expect(await verify(token)).toBeNull();
  });

  it("accepts nothing until the bundle id is configured", async () => {
    delete process.env.AUTH_APPLE_BUNDLE_ID;
    expect(await verify(await sign({}))).toBeNull();
  });
});
