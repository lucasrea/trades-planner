import type { Database } from "@/lib/db";
import { findContractorForEmail } from "@/lib/mobile/find-user";
import type { GoogleIdTokenVerifier } from "@/lib/mobile/google-id-token";
import { createMobileSession } from "@/lib/mobile/sessions";

export async function createSessionFromIdToken(
  db: Database,
  idToken: string,
  verify: GoogleIdTokenVerifier,
): Promise<{ token: string } | { kind: "unauthorized" } | { kind: "invalid" }> {
  const trimmed = idToken.trim();
  if (!trimmed) return { kind: "invalid" };
  const verified = await verify(trimmed);
  if (!verified?.emailVerified) return { kind: "unauthorized" };
  const account = await findContractorForEmail(db, verified.email);
  if (!account) return { kind: "unauthorized" };
  return createMobileSession(db, account);
}
