import { jsonError } from "@/lib/http/json-error";
import { contractorFromBearer } from "@/lib/mobile/bearer-auth";
import { getJobForContractor } from "@/lib/queries-v2";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await contractorFromBearer(request);
  if (!auth) return jsonError("unauthorized", "Sign in required.", 401);

  const { id } = await params;
  const job = await getJobForContractor(auth.db, auth.contractorId, id);
  if (!job) return jsonError("not_found", "Job not found.", 404);

  return Response.json({
    job: {
      id: job.id,
      title: job.title,
      status: job.status,
      siteAddress: job.siteAddress,
      notes: job.notes,
      client: job.client ? { id: job.client.id, name: job.client.name } : null,
    },
  });
}