export const paidPlans = ["solo", "pro"] as const;
export const planIds = ["free", "solo", "pro"] as const;
export const planStates = ["free", "solo", "pro", "trial", "past_due", "canceled"] as const;

export type PaidPlan = (typeof paidPlans)[number];
export type PlanId = (typeof planIds)[number];
export type PlanState = (typeof planStates)[number];

export type PlanFeature =
  | "duplicate_documents"
  | "export_clients_csv"
  | "email_pdf"
  | "payment_reminders"
  | "shopping_list"
  | "job_photos"
  | "activity_log"
  | "quickbooks_export"
  | "voice_to_quote"
  | "quote_templates";

export type PlanLimits = {
  clients: number;
  activeJobs: number;
  documentsPerMonth: number;
};

export type PlanUsage = {
  clients: number;
  activeJobs: number;
  documentsThisMonth: number;
};

export type EntitlementBlock = {
  error: string;
  upgradeHref: string;
};

const UNLIMITED = Number.POSITIVE_INFINITY;

export const planLimits: Record<PlanId, PlanLimits> = {
  free: { clients: 5, activeJobs: 3, documentsPerMonth: 10 },
  solo: { clients: UNLIMITED, activeJobs: UNLIMITED, documentsPerMonth: UNLIMITED },
  pro: { clients: UNLIMITED, activeJobs: UNLIMITED, documentsPerMonth: UNLIMITED },
};

const planFeatures: Record<PlanFeature, readonly PlanId[]> = {
  duplicate_documents: ["solo", "pro"],
  export_clients_csv: ["solo", "pro"],
  email_pdf: ["pro"],
  payment_reminders: ["pro"],
  shopping_list: ["pro"],
  job_photos: ["pro"],
  activity_log: ["pro"],
  quickbooks_export: ["pro"],
  voice_to_quote: ["pro"],
  quote_templates: ["pro"],
};

const upgradeHref = "/#pricing";

export function isUnlimited(value: number) {
  return !Number.isFinite(value);
}

/** Paid subscriptions stay paid. Trial is treated as Pro until Stripe product mapping exists. */
export function effectivePlan(plan: string | null | undefined): PlanId {
  if (plan === "solo") return "solo";
  if (plan === "pro" || plan === "trial") return "pro";
  return "free";
}

export function getPlanLimits(plan: string | null | undefined): PlanLimits {
  return planLimits[effectivePlan(plan)];
}

export function canUseFeature(plan: string | null | undefined, feature: PlanFeature) {
  return planFeatures[feature].includes(effectivePlan(plan));
}

export function requireFeature(
  plan: string | null | undefined,
  feature: PlanFeature,
): EntitlementBlock | null {
  if (canUseFeature(plan, feature)) return null;
  const needed = planFeatures[feature].includes("solo") ? "Solo" : "Pro";
  return {
    error: `That feature is on ${needed}. Upgrade to keep going.`,
    upgradeHref,
  };
}

export function canCreateClient(plan: string | null | undefined, clientCount: number) {
  const limit = getPlanLimits(plan).clients;
  return isUnlimited(limit) || clientCount < limit;
}

export function canCreateActiveJob(plan: string | null | undefined, activeJobCount: number) {
  const limit = getPlanLimits(plan).activeJobs;
  return isUnlimited(limit) || activeJobCount < limit;
}

export function canCreateDocument(plan: string | null | undefined, documentsThisMonth: number) {
  const limit = getPlanLimits(plan).documentsPerMonth;
  return isUnlimited(limit) || documentsThisMonth < limit;
}

export function requireClientSlot(
  plan: string | null | undefined,
  clientCount: number,
): EntitlementBlock | null {
  if (canCreateClient(plan, clientCount)) return null;
  return {
    error: `Free includes ${planLimits.free.clients} clients. Upgrade to Solo for unlimited paperwork.`,
    upgradeHref,
  };
}

export function requireActiveJobSlot(
  plan: string | null | undefined,
  activeJobCount: number,
): EntitlementBlock | null {
  if (canCreateActiveJob(plan, activeJobCount)) return null;
  return {
    error: `Free includes ${planLimits.free.activeJobs} active jobs. Completed and archived jobs don’t count. Upgrade to Solo for unlimited jobs.`,
    upgradeHref,
  };
}

export function requireDocumentSlot(
  plan: string | null | undefined,
  documentsThisMonth: number,
): EntitlementBlock | null {
  if (canCreateDocument(plan, documentsThisMonth)) return null;
  return {
    error: `Free includes ${planLimits.free.documentsPerMonth} quotes and invoices per month. Upgrade to Solo for unlimited documents.`,
    upgradeHref,
  };
}

export function isActiveJobStatus(status: string) {
  return status === "quoted" || status === "active";
}

export function monthRange(now = new Date()) {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return { start, end };
}
