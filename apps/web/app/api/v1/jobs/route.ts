import { jsonError } from "@/lib/http/json-error";
import { contractorFromBearer } from "@/lib/mobile/bearer-auth";
import { getJobsForContractor } from "@/lib/queries-v2";
import { isActiveJobStatus } from "@/lib/status";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await contractorFromBearer(request);
  if (!auth) return jsonError("unauthorized", "Sign in required.", 401);

  // `?open=1` is the job picker: quoted and active jobs only.
  const openOnly = new URL(request.url).searchParams.get("open") === "1";
  const all = await getJobsForContractor(auth.db, auth.contractorId);
  const jobs = openOnly ? all.filter((job) => isActiveJobStatus(job.status)) : all;
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