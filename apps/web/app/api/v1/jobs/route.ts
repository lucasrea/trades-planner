import { jsonError } from "@/lib/http/json-error";
import { contractorFromBearer } from "@/lib/mobile/bearer-auth";
import { getJobsForContractor } from "@/lib/queries-v2";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await contractorFromBearer(request);
  if (!auth) return jsonError("unauthorized", "Sign in required.", 401);

  const jobs = await getJobsForContractor(auth.db, auth.contractorId);
  return Response.json({
    jobs: jobs.map((job) => ({
      id: job.id,
      title: job.title,
      status: job.status,
      siteAddress: job.siteAddress,
      updatedAt: job.updatedAt,
      client: job.client ? { name: job.client.name } : null,
      unbilledTotal: job.unbilledTotal,
    })),
  });
}