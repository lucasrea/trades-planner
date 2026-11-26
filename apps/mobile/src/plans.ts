export const PLAN_NEW = "new";

export type PlanSummary = {
  id: string;
  title: string;
  jobTitle: string | null;
  updatedAt: number;
};

export type PlanThreadMessage = {
  id: string;
  role: "user" | "plan";
  body: string;
  captureId: string | null;
  captureType: string | null;
  outcome: "waiting" | "confirmed" | "cancelled" | "failed" | null;
  preview: import("./api").PlanPreview | null;
  /** Choices offered with a Plan question. */
  options: { label: string; jobId: string | null }[];
};

export function groupPlansByJob(plans: PlanSummary[]) {
  const groups: { jobTitle: string | null; plans: PlanSummary[] }[] = [];
  const index = new Map<string, number>();
  for (const plan of plans) {
    const jobTitle = plan.jobTitle?.trim() || null;
    const key = jobTitle ?? "";
    const at = index.get(key);
    if (at == null) {
      index.set(key, groups.length);
      groups.push({ jobTitle, plans: [plan] });
    } else {
      groups[at]!.plans.push(plan);
    }
  }
  return groups;
}

/** The thread rows for a send whose plan could not be saved or reloaded, built from the response itself. */
export function localTurn(userBody: string, result: import("./api").TextCaptureResult): PlanThreadMessage[] {
  const cards = result.cards?.length
    ? result.cards
    : result.preview
      ? [{ captureId: result.captureId, title: result.preview.title, preview: result.preview }]
      : [];
  const key = `local-${result.captureId || Date.now()}`;
  const row = (id: string, rest: Partial<PlanThreadMessage>): PlanThreadMessage => ({
    id,
    role: "plan",
    body: "",
    captureId: null,
    captureType: null,
    outcome: null,
    preview: null,
    options: [],
    ...rest,
  });
  return [
    row(`${key}-said`, { role: "user", body: userBody }),
    ...(result.reply ? [row(`${key}-reply`, { body: result.reply })] : []),
    ...cards.map((card) =>
      row(`${key}-${card.captureId}`, {
        body: card.title,
        captureId: card.captureId,
        outcome: "waiting",
        preview: card.preview,
      }),
    ),
  ];
}
