import { z } from "zod";
import { jsonError } from "@/lib/http/json-error";
import { planErrorResponse } from "@/lib/http/service-error";
import { contractorFromBearer } from "@/lib/mobile/bearer-auth";
import { previewStoredProposal, updatePlanProposalLines } from "@/lib/services/plan-proposals";

export const runtime = "nodejs";

// Shape only. The service owns the rules and their wording.
const bodySchema = z.object({
  lines: z
    .array(z.object({ description: z.string(), quantity: z.number(), unit: z.string(), unitPrice: z.number().nullable() }))
    .max(100),
});

/** Edit the lines on a waiting card. Answers with the card as it now stands. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await contractorFromBearer(request);
  if (!auth) return jsonError("unauthorized", "Sign in required.", 401);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid", "Check the details and try again.", 400);

  const { id } = await params;
  const ctx = { db: auth.db, contractorId: auth.contractorId };
  try {
    const { proposal, transcript } = await updatePlanProposalLines(ctx, id, parsed.data.lines);
    return Response.json({ preview: await previewStoredProposal(ctx, proposal, transcript) });
  } catch (error) {
    return planErrorResponse(error);
  }
}
