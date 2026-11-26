import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { GoogleIdTokenVerifier, VerifiedGoogleIdToken } from "@/lib/mobile/google-id-token";

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

/**
 * The phone asks for tokens with the web client id as the server client id, so the audience is
 * AUTH_GOOGLE_ID. AUTH_GOOGLE_MOBILE_AUDIENCES (comma separated) is for further client ids of
 * this same app, should a platform issue tokens addressed to its own client id.
 */
function allowedAudiences() {
  return [process.env.AUTH_GOOGLE_ID, ...(process.env.AUTH_GOOGLE_MOBILE_AUDIENCES?.split(",") ?? [])]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);
}

/** `keys` is injected so tests can verify tokens they signed themselves. */
export function createGoogleIdTokenVerifier(keys: JWTVerifyGetKey): GoogleIdTokenVerifier {
  return async (idToken) => {
    const audience = allowedAudiences();
    if (audience.length === 0) return null;
    try {
      const { payload } = await jwtVerify(idToken, keys, {
        issuer: GOOGLE_ISSUERS,
        audience,
        requiredClaims: ["exp"],
      });
      const email = typeof payload.email === "string" ? payload.email.toLowerCase().trim() : "";
      if (!email || payload.email_verified !== true) return null;
      return { email, emailVerified: true };
    } catch {
      return null;
    }
  };
}

export const verifyGoogleIdToken: GoogleIdTokenVerifier = createGoogleIdTokenVerifier(googleKeys);

/** @internal Test helper for asserting verifier shape without calling Google. */
export function verifiedToken(email: string): VerifiedGoogleIdToken {
  return { email: email.toLowerCase().trim(), emailVerified: true };
}
