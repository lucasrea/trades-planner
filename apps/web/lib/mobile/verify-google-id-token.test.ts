import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createGoogleIdTokenVerifier } from "@/lib/mobile/verify-google-id-token";

const env = process.env;
const WEB = "web-client.apps.googleusercontent.com";
const IOS = "ios-client.apps.googleusercontent.com";

let privateKey: CryptoKey;
let verify: ReturnType<typeof createGoogleIdTokenVerifier>;

function sign(audience: string, options: { issuer?: string; emailVerified?: boolean } = {}) {
  return new SignJWT({ email: "Joe@Example.com", email_verified: options.emailVerified ?? true })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(options.issuer ?? "https://accounts.google.com")
    .setAudience(audience)
    .setExpirationTime("5m")
    .sign(privateKey);
}

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
  verify = createGoogleIdTokenVerifier(createLocalJWKSet({ keys: [jwk] }));
});

beforeEach(() => {
  process.env.AUTH_GOOGLE_ID = WEB;
  delete process.env.AUTH_GOOGLE_MOBILE_AUDIENCES;
});

afterEach(() => {
  process.env = { ...env };
});

describe("Google ID token verifier", () => {
  it("accepts the web client id as the audience, from either Google issuer", async () => {
    for (const issuer of ["https://accounts.google.com", "accounts.google.com"]) {
      expect(await verify(await sign(WEB, { issuer }))).toEqual({ email: "joe@example.com", emailVerified: true });
    }
  });

  it("accepts another client id only when it is listed", async () => {
    expect(await verify(await sign(IOS))).toBeNull();
    process.env.AUTH_GOOGLE_MOBILE_AUDIENCES = ` other , ${IOS} ,`;
    expect(await verify(await sign(IOS))).toMatchObject({ email: "joe@example.com" });
    expect(await verify(await sign(WEB))).toMatchObject({ email: "joe@example.com" });
    expect(await verify(await sign("someone-else"))).toBeNull();
  });

  it("rejects another issuer and an unverified email", async () => {
    expect(await verify(await sign(WEB, { issuer: "https://appleid.apple.com" }))).toBeNull();
    expect(await verify(await sign(WEB, { emailVerified: false }))).toBeNull();
  });

  it("accepts nothing with no client id configured", async () => {
    delete process.env.AUTH_GOOGLE_ID;
    process.env.AUTH_GOOGLE_MOBILE_AUDIENCES = " , ";
    expect(await verify(await sign(WEB))).toBeNull();
  });
});
