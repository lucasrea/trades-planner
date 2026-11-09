import { z } from "zod";
import { ensureDb } from "@/lib/db";
import { jsonError } from "@/lib/http/json-error";
import { createSessionFromIdToken } from "@/lib/mobile/create-session-from-id-token";
import { verifyGoogleIdToken } from "@/lib/mobile/verify-google-id-token";

export const runtime = "nodejs";

const bodySchema = z.object({
  idToken: z.string().min(1),
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

  const db = await ensureDb();
  const result = await createSessionFromIdToken(db, parsed.data.idToken, verifyGoogleIdToken);
  if ("kind" in result) {
    if (result.kind === "invalid") return jsonError("invalid", "idToken is required.", 400);
    return jsonError("unauthorized", "Sign in failed.", 401);
  }
  return Response.json({ token: result.token });
}
