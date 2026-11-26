import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { AppleIdTokenVerifier } from "@/lib/mobile/apple-id-token";

const APPLE_ISSUER = "https://appleid.apple.com";
const appleKeys = createRemoteJWKSet(new URL(`${APPLE_ISSUER}/auth/keys`));

/** Apple sends these claims as booleans or as the strings "true" and "false". */
function isTrue(claim: unknown) {
  return claim === true || claim === "true";
}

/** `keys` is injected so tests can verify tokens they signed themselves. */
export function createAppleIdTokenVerifier(keys: JWTVerifyGetKey): AppleIdTokenVerifier {
  return async (idToken) => {
    // The audience of a native sign-in token is the app's bundle id. Without it, accept nothing.
    const audience = process.env.AUTH_APPLE_BUNDLE_ID?.trim();
    if (!audience) return null;
    try {
      const { payload } = await jwtVerify(idToken, keys, {
        issuer: APPLE_ISSUER,
        audience,
        requiredClaims: ["sub", "exp"],
      });
      if (!payload.sub) return null;
      const email = typeof payload.email === "string" ? payload.email.toLowerCase().trim() : "";
      return {
        appleId: payload.sub,
        email: email && isTrue(payload.email_verified) ? email : null,
        isPrivateEmail: isTrue(payload.is_private_email) || email.endsWith("@privaterelay.appleid.com"),
      };
    } catch {
      return null;
    }
  };
}

export const verifyAppleIdToken: AppleIdTokenVerifier = createAppleIdTokenVerifier(appleKeys);
