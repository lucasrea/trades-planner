import { createMobileSession } from "@/lib/mobile/sessions";
import { getTestDb } from "./db";
import type { TenantSeed } from "./seed";

export async function bearerFor(tenant: Pick<TenantSeed, "userId" | "contractorId">) {
  return (await createMobileSession(getTestDb(), tenant)).token;
}

type IdRoute = (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;

/** Calls a `/api/v1/.../[id]` route the way the phone does. A string body is sent as JSON text. */
export function callRoute(
  route: IdRoute,
  id: string,
  options: { token?: string; method?: string; body?: unknown } = {},
) {
  const headers: Record<string, string> = {};
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  return route(
    new Request(`http://localhost/api/v1/test/${id}`, {
      method: options.method ?? "POST",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
    { params: Promise.resolve({ id }) },
  );
}
