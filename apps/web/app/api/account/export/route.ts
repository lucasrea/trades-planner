import { getSession } from "@/lib/auth";
import { ensureDb } from "@/lib/db";
import { jsonError } from "@/lib/http/json-error";
import { exportAccountData } from "@/lib/services/account";
import { NotFoundError } from "@/lib/services/context";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("unauthorized", "Sign in required.", 401);

  try {
    const data = await exportAccountData({ db: await ensureDb(), contractorId: session.contractorId });
    const day = data.exportedAt.slice(0, 10);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="trades-planner-data-${day}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError) return jsonError("not_found", "Account not found.", 404);
    throw error;
  }
}
