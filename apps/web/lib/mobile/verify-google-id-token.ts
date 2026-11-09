import { createRemoteJWKSet, jwtVerify } from "jose";
import type { GoogleIdTokenVerifier, VerifiedGoogleIdToken } from "@/lib/mobile/google-id-token";

const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export const verifyGoogleIdToken: GoogleIdTokenVerifier = async (idToken) => {
  const audience = process.env.AUTH_GOOGLE_ID;
  if (!audience) return null;
  try {
    const { payload } = await jwtVerify(idToken, jwks, { audience });
    const email = typeof payload.email === "string" ? payload.email.toLowerCase().trim() : "";
    if (!email || payload.email_verified !== true) return null;
    return { email, emailVerified: true };
  } catch {
    return null;
  }
};

/** @internal Test helper for asserting verifier shape without calling Google. */
export function verifiedToken(email: string): VerifiedGoogleIdToken {
  return { email: email.toLowerCase().trim(), emailVerified: true };
}
