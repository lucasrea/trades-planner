import { jsonError } from "@/lib/http/json-error";

export function assertSameOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        throw jsonError("forbidden", "Cross-origin request blocked.", 403);
      }
    } catch {
      throw jsonError("forbidden", "Cross-origin request blocked.", 403);
    }
  }
  if (site && site !== "same-origin" && site !== "same-site") {
    throw jsonError("forbidden", "Cross-origin request blocked.", 403);
  }
}
