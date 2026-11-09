/**
 * Plan agent proposal logic. Pure: no Next, React or DB imports.
 *
 * The model only fills a describe extraction (intent, lines, names). This module decides the one
 * action a message becomes, builds the preview the contractor reviews, and maps a confirmed proposal
 * onto the inputs of the existing confirm services. It does no document arithmetic.
 */
import type { DescribeExtraction, DescribeLine, PlanAction } from "@/lib/ai/extraction-types";
import { describeToDraft, fuzzyMatchClient, fuzzyMatchJob } from "@/lib/line-items";
import { transcriptNamesPrice } from "@/lib/plan-stated-price";

export type PlanJobRef = { id: string; title: string; clientId: string };
export type PlanClientRef = { id: string; name: string };

export type PlanConfirmLine = {
  kind: "labour" | "material" | "other";
  description: string;
  quantity: number;
  unit: string;
  unitCost: number | null;
  unitPrice: number;
};

export type PlanConfirmInput = {
  createAs: "quote" | "invoice" | "log";
  client: { id: string } | { name: string };
  job: { id: string } | { title: string; siteAddress?: string };
  notes?: string;
  lines: PlanConfirmLine[];
};

export type PlanConfirmPlan =
  | { ok: true; kind: "capture"; input: PlanConfirmInput }
  | {
      ok: true;
      kind: "create_job";
      input: { title: string; siteAddress?: string; client: { id: string } | { name: string } };
    }
  | { ok: false; reason: string };

export type PlanPreviewLine = {
  kind: DescribeLine["kind"];
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  note: string | null;
};

export type PlanPreview = {
  action: PlanAction;
  title: string;
  jobTitle: string | null;
  jobIsNew: boolean;
  clientName: string | null;
  clientIsNew: boolean;
  siteAddress: string | null;
  notes: string | null;
  lines: PlanPreviewLine[];
  warnings: string[];
  blockers: string[];
  canConfirm: boolean;
};

const ACTION_LABELS: Record<PlanAction, string> = {
  create_job: "Create a job",
  add_materials: "Add materials",
  log_hours: "Log hours",
  make_quote: "Make a quote",
  make_invoice: "Make an invoice",
};

export function planActionLabel(action: PlanAction) {
  return ACTION_LABELS[action];
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Existing-job work: labour-only is Log hours, anything else is Add materials. */
function trackedAction(lines: Pick<DescribeLine, "kind">[]): PlanAction {
  return lines.length > 0 && lines.every((line) => line.kind === "labour") ? "log_hours" : "add_materials";
}

/**
 * One message, one action.
 * - Words that bill: Make an invoice.
 * - No lines: Create a job when something new is named, otherwise unclear.
 * - A job already selected in Plan: work on it (Add materials or Log hours).
 * - A job only named in the words: a quote when pricing, otherwise Add materials or Log hours.
 * - No job: Make a quote when pricing new work; tracked work with no job still names its action so
 *   the card can ask for one.
 */
export function chooseAction(input: {
  intent: DescribeExtraction["intent"];
  lines: Pick<DescribeLine, "kind">[];
  job: "selected" | "matched" | null;
  /** A job title or client name appears in the message. */
  namesWork: boolean;
}): PlanAction | null {
  if (input.intent === "invoice") return "make_invoice";
  if (input.lines.length === 0) return input.namesWork && !input.job ? "create_job" : null;
  if (input.job === "selected") return trackedAction(input.lines);
  if (input.job === "matched") return input.intent === "quote" ? "make_quote" : trackedAction(input.lines);
  if (input.intent === "log") return trackedAction(input.lines);
  return "make_quote";
}

function describeLine(line: DescribeLine) {
  return `${line.quantity} ${line.description}`.trim();
}

/**
 * Turn the model's extraction into the stored proposal: pick one action, resolve the job and client
 * from what the contractor already has, and keep only the lines that action writes.
 */
export function buildProposal(input: {
  extraction: DescribeExtraction;
  selectedJob: PlanJobRef | null;
  jobs: PlanJobRef[];
  clients: PlanClientRef[];
}): DescribeExtraction {
  const { extraction } = input;
  const jobTitle = clean(extraction.job_title);
  const clientName = clean(extraction.client_name);
  const namedJobId = jobTitle && extraction.lines.length > 0 ? fuzzyMatchJob(jobTitle, input.jobs)?.id : undefined;
  const namedJob = input.jobs.find((job) => job.id === namedJobId) ?? null;
  const matchedJob = input.selectedJob ?? namedJob;

  const action = chooseAction({
    intent: extraction.intent,
    lines: extraction.lines,
    job: input.selectedJob ? "selected" : namedJob ? "matched" : null,
    namesWork: Boolean(jobTitle || clientName),
  });

  const warnings = [...extraction.warnings];
  let lines = extraction.lines;
  if (action === "add_materials" || action === "log_hours") {
    const keep = (line: DescribeLine) => (action === "log_hours" ? line.kind === "labour" : line.kind !== "labour");
    lines = extraction.lines.filter(keep);
    const left = extraction.lines.filter((line) => !keep(line));
    if (left.length > 0) {
      warnings.push(
        `Not included yet: ${left.map(describeLine).join(", ")}. Send ${left.some((l) => l.kind === "labour") ? "the hours" : "the materials"} in your next message.`,
      );
    }
  }

  const job = action === "create_job" ? null : matchedJob;
  const clientId = job ? job.clientId : (fuzzyMatchClient(clientName ?? "", input.clients)?.id ?? null);

  return {
    ...extraction,
    lines,
    warnings,
    action,
    job_id: job?.id ?? null,
    client_id: clientId,
  };
}

function lineNote(line: DescribeLine, price: number | null, defaultRate: boolean): string | null {
  if (!(line.quantity > 0)) return "No quantity";
  if (price == null) return "No price";
  if (line.uncertain) return "Check this";
  if (defaultRate) return "Using your labour rate";
  return null;
}

/** The card the contractor reviews. Blockers disable Confirm; warnings do not. */
export function previewProposal(
  proposal: DescribeExtraction,
  context: {
    labourRate: number;
    jobTitle?: string | null;
    clientName?: string | null;
    transcript?: string | null;
  },
): PlanPreview | null {
  const action = proposal.action ?? null;
  if (!action) return null;

  const statedPrice = transcriptNamesPrice(context.transcript);
  const drafts = describeToDraft(proposal, { labourRate: context.labourRate, statedPriceInTranscript: statedPrice });
  const lines: PlanPreviewLine[] = proposal.lines.map((line, index) => {
    const draft = drafts[index]!;
    return {
      kind: line.kind,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: draft.unitPrice,
      note: lineNote(line, draft.unitPrice, Boolean(draft.defaultRate)),
    };
  });

  const typedJobTitle = clean(proposal.job_title);
  const typedClientName = clean(proposal.client_name);
  const hasJob = Boolean(proposal.job_id);
  const hasClient = Boolean(proposal.client_id) || Boolean(typedClientName);
  const jobTitle = hasJob ? (clean(context.jobTitle) ?? typedJobTitle) : typedJobTitle;
  const clientName = clean(context.clientName) ?? typedClientName;

  const blockers: string[] = [];
  const warnings = [...proposal.warnings];

  if (action === "create_job") {
    if (!typedJobTitle) blockers.push("Add a job title.");
    if (!hasClient) blockers.push("Add a client.");
  } else {
    if (lines.length === 0) blockers.push("There are no lines to add.");
    const labourMissingStatedPrice =
      statedPrice &&
      proposal.lines.some(
        (line) => line.kind === "labour" && (line.unit_price == null || line.unit_price === 0),
      );
    if (labourMissingStatedPrice) {
      blockers.push("The named price was not put on the labour line.");
    } else if (lines.some((line) => line.note === "No price")) {
      blockers.push("Add a price to every line.");
    }
    if (lines.some((line) => line.note === "No quantity")) blockers.push("Add a quantity to every line.");
    if (action === "add_materials" || action === "log_hours") {
      if (!hasJob) {
        blockers.push(
          typedJobTitle ? `I couldn't find a job called "${typedJobTitle}". Pick the job.` : "Pick the job this belongs to.",
        );
      }
    } else if (!hasJob) {
      if (!typedJobTitle) blockers.push("Add a job title.");
      if (!hasClient) blockers.push("Add a client.");
    }
  }
  for (const line of lines) {
    if (line.note === "Check this") warnings.push(`${line.description}: check the quantity and price.`);
  }

  const forJob = jobTitle ? ` ${action === "make_quote" || action === "make_invoice" ? "for" : "on"} ${jobTitle}` : "";
  const titles: Record<PlanAction, string> = {
    create_job: typedJobTitle ? `Create the job "${typedJobTitle}"` : "Create a job",
    add_materials: `Add these materials${jobTitle ? ` to ${jobTitle}` : ""}`,
    log_hours: `Log these hours${forJob}`,
    make_quote: `Make a draft quote${forJob}`,
    make_invoice: `Make a draft invoice${forJob}`,
  };

  return {
    action,
    title: titles[action],
    jobTitle,
    jobIsNew: !hasJob && action !== "add_materials" && action !== "log_hours" && Boolean(typedJobTitle),
    clientName,
    clientIsNew: !proposal.client_id && Boolean(typedClientName),
    siteAddress: clean(proposal.site_address),
    notes: action === "make_quote" || action === "make_invoice" ? clean(proposal.scope_notes) : null,
    lines: action === "create_job" ? [] : lines,
    warnings,
    blockers,
    canConfirm: blockers.length === 0,
  };
}

/**
 * Map a proposal onto the inputs of the existing services. `job` is the contractor's own job row
 * when the proposal names one (the caller loads it scoped by contractor_id).
 */
export function toConfirmPlan(
  proposal: DescribeExtraction,
  context: { labourRate: number; job: { id: string; clientId: string } | null; transcript?: string | null },
): PlanConfirmPlan {
  const preview = previewProposal(proposal, { labourRate: context.labourRate, transcript: context.transcript });
  if (!preview) return { ok: false, reason: "This message has no action to confirm." };
  if (!preview.canConfirm) return { ok: false, reason: preview.blockers[0]! };

  const action = preview.action;
  const typedClientName = clean(proposal.client_name);
  const siteAddress = clean(proposal.site_address) ?? undefined;
  const newClient = proposal.client_id ? { id: proposal.client_id } : { name: typedClientName ?? "" };

  if (action === "create_job") {
    return {
      ok: true,
      kind: "create_job",
      input: { title: clean(proposal.job_title)!, siteAddress, client: newClient },
    };
  }

  if (proposal.job_id && (!context.job || context.job.id !== proposal.job_id)) {
    return { ok: false, reason: "That job is no longer available." };
  }

  const statedPrice = transcriptNamesPrice(context.transcript);
  const drafts = describeToDraft(proposal, { labourRate: context.labourRate, statedPriceInTranscript: statedPrice });
  const lines: PlanConfirmLine[] = proposal.lines.map((line, index) => ({
    kind: line.kind,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unitCost: null,
    unitPrice: drafts[index]!.unitPrice ?? 0,
  }));

  const createAs = action === "make_quote" ? "quote" : action === "make_invoice" ? "invoice" : "log";
  const notes = createAs === "log" ? undefined : (clean(proposal.scope_notes) ?? undefined);
  const client = context.job ? { id: context.job.clientId } : newClient;
  const job = context.job ? { id: context.job.id } : { title: clean(proposal.job_title)!, siteAddress };
  return { ok: true, kind: "capture", input: { createAs, client, job, notes, lines } };
}
