import { z } from "zod";
import { ensureDb } from "@/lib/db";
import { jsonError } from "@/lib/http/json-error";
import { parseBearerToken } from "@/lib/mobile/bearer-auth";
import { createSessionFromAppleIdToken, createSessionFromIdToken } from "@/lib/mobile/create-session-from-id-token";
import { revokeMobileSession } from "@/lib/mobile/sessions";
import { verifyAppleIdToken } from "@/lib/mobile/verify-apple-id-token";
import { verifyGoogleIdToken } from "@/lib/mobile/verify-google-id-token";

export const runtime = "nodejs";

// The phone shows these messages as they are.
const SIGN_UP = "Sign up at trades-planner-bay.vercel.app first.";
const APPLE_NO_ACCOUNT = `No account uses this Apple email. Continue with Google. New here? ${SIGN_UP}`;
const APPLE_HIDDEN_EMAIL =
  "Your Apple email is hidden, so we can't find your account. In iPhone Settings, stop using your Apple ID with Trades Planner, then try again and choose Share My Email. " +
  `New here? ${SIGN_UP}`;
const APPLE_MISMATCH = "This account is linked to a different Apple ID. Continue with Google.";

const bodySchema = z.object({
  idToken: z.string().min(1),
  provider: z.enum(["google", "apple"]).default("google"),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid", "Invalid JSON body.", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError("invalid", "idToken is required.", 400);
  const { idToken, provider } = parsed.data;

  const db = await ensureDb();
  const result =
    provider === "apple"
      ? await createSessionFromAppleIdToken(db, idToken, verifyAppleIdToken)
      : await createSessionFromIdToken(db, idToken, verifyGoogleIdToken);
  if ("token" in result) return Response.json({ token: result.token });

  switch (result.kind) {
    case "invalid":
      return jsonError("invalid", "idToken is required.", 400);
    case "unauthorized":
      return jsonError("unauthorized", "Sign in failed.", 401);
    case "apple_mismatch":
      return jsonError("apple_mismatch", APPLE_MISMATCH, 409);
    case "no_account": {
      if (!("isPrivateEmail" in result)) return jsonError("no_account", SIGN_UP, 403);
      return jsonError("no_account", result.isPrivateEmail ? APPLE_HIDDEN_EMAIL : APPLE_NO_ACCOUNT, 403);
    }
  }
}

/** Log out. Revokes this bearer only; revoking one that is already gone also succeeds. */
export async function DELETE(request: Request) {
  const token = parseBearerToken(request);
  if (!token) return jsonError("unauthorized", "Sign in required.", 401);
  await revokeMobileSession(await ensureDb(), token);
  return new Response(null, { status: 204 });
}
