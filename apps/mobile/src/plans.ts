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
  outcome: "waiting" | "confirmed" | "cancelled" | "failed" | null;
  preview: import("./api").PlanPreview | null;
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