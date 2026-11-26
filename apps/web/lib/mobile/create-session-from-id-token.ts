import type { Database } from "@/lib/db";
import type { AppleIdTokenVerifier } from "@/lib/mobile/apple-id-token";
import { findContractorForEmail, findOrLinkContractorForApple } from "@/lib/mobile/find-user";
import type { GoogleIdTokenVerifier } from "@/lib/mobile/google-id-token";
import { createMobileSession } from "@/lib/mobile/sessions";

export async function createSessionFromIdToken(
  db: Database,
  idToken: string,
  verify: GoogleIdTokenVerifier,
): Promise<{ token: string } | { kind: "unauthorized" } | { kind: "invalid" } | { kind: "no_account" }> {
  const trimmed = idToken.trim();
  if (!trimmed) return { kind: "invalid" };
  const verified = await verify(trimmed);
  if (!verified?.emailVerified) return { kind: "unauthorized" };
  const account = await findContractorForEmail(db, verified.email);
  if (!account) return { kind: "no_account" };
  return createMobileSession(db, account);
}

export async function createSessionFromAppleIdToken(
  db: Database,
  idToken: string,
  verify: AppleIdTokenVerifier,
): Promise<
  | { token: string }
  | { kind: "unauthorized" }
  | { kind: "invalid" }
  | { kind: "no_account"; isPrivateEmail: boolean }
  | { kind: "apple_mismatch" }
> {
  const trimmed = idToken.trim();
  if (!trimmed) return { kind: "invalid" };
  const verified = await verify(trimmed);
  if (!verified) return { kind: "unauthorized" };
  const account = await findOrLinkContractorForApple(db, verified);
  if ("kind" in account) {
    if (account.kind === "no_account") return { kind: "no_account", isPrivateEmail: verified.isPrivateEmail };
    return account;
  }
  return createMobileSession(db, account);
}
