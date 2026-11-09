import { describe, expect, it } from "vitest";
import type { DescribeExtraction } from "@/lib/ai/extraction-types";
import { buildProposal, chooseAction, previewProposal, toConfirmPlan, type PlanJobRef } from "@/lib/plan-proposal";

const kitchen: PlanJobRef = { id: "job-kitchen", title: "Kitchen reno", clientId: "client-chen" };
const jobs = [kitchen, { id: "job-bath", title: "Bathroom", clientId: "client-patel" }];
const clients = [
  { id: "client-chen", name: "Chen, David" },
  { id: "client-patel", name: "Patel, Maria" },
];

function extraction(partial: Partial<DescribeExtraction> = {}): DescribeExtraction {
  return {
    intent: null,
    client_name: null,
    job_title: null,
    site_address: null,
    scope_notes: null,
    lines: [],
    warnings: [],
    ...partial,
  };
}

const valve = { kind: "material", description: "Valve", quantity: 1, unit: "ea", unit_price: 45 } as const;
const hours = { kind: "labour", description: "Labour", quantity: 3, unit: "hr", unit_price: null } as const;

describe("chooseAction", () => {
  const material = [{ kind: "material" as const }];
  const labour = [{ kind: "labour" as const }];

  it("bills when the words ask to bill", () => {
    for (const job of ["selected", "matched", null] as const) {
      expect(chooseAction({ intent: "invoice", lines: material, job, namesWork: true })).toBe("make_invoice");
    }
  });

  it("quotes on the selected job when the words ask to quote, otherwise tracks work", () => {
    expect(chooseAction({ intent: "quote", lines: material, job: "selected", namesWork: false })).toBe("make_quote");
    expect(chooseAction({ intent: "quote", lines: [...labour, ...material], job: "selected", namesWork: false })).toBe(
      "make_quote",
    );
    expect(chooseAction({ intent: null, lines: labour, job: "selected", namesWork: false })).toBe("log_hours");
  });

  it("adds materials or logs hours on an existing job named in the words", () => {
    expect(chooseAction({ intent: "log", lines: material, job: "matched", namesWork: true })).toBe("add_materials");
    expect(chooseAction({ intent: "log", lines: labour, job: "matched", namesWork: true })).toBe("log_hours");
    expect(chooseAction({ intent: "quote", lines: material, job: "matched", namesWork: true })).toBe("make_quote");
  });

  it("makes a quote when pricing new work and names the action for tracked work with no job", () => {
    expect(chooseAction({ intent: "quote", lines: material, job: null, namesWork: true })).toBe("make_quote");
    expect(chooseAction({ intent: null, lines: material, job: null, namesWork: true })).toBe("make_quote");
    expect(chooseAction({ intent: "log", lines: material, job: null, namesWork: true })).toBe("add_materials");
  });

  it("creates a job when something new is named and there is nothing to price", () => {
    expect(chooseAction({ intent: null, lines: [], job: null, namesWork: true })).toBe("create_job");
    expect(chooseAction({ intent: "quote", lines: [], job: null, namesWork: true })).toBe("create_job");
  });

  it("returns no action when the message names nothing to do", () => {
    expect(chooseAction({ intent: null, lines: [], job: null, namesWork: false })).toBeNull();
    expect(chooseAction({ intent: "log", lines: [], job: "selected", namesWork: true })).toBeNull();
  });
});

describe("buildProposal", () => {
  it("add a valve at $45 to the kitchen: adds that material to the existing job", () => {
    const proposal = buildProposal({
      extraction: extraction({ intent: "log", job_title: "kitchen", lines: [valve] }),
      selectedJob: null,
      jobs,
      clients,
    });
    expect(proposal).toMatchObject({ action: "add_materials", job_id: "job-kitchen", client_id: "client-chen" });
    expect(proposal.lines).toHaveLength(1);
  });

  it("uses the selected job even when the message names another", () => {
    const proposal = buildProposal({
      extraction: extraction({ intent: "log", job_title: "bathroom", lines: [valve] }),
      selectedJob: kitchen,
      jobs,
      clients,
    });
    expect(proposal).toMatchObject({ action: "add_materials", job_id: "job-kitchen" });
  });

  it("quote with labour and material keeps both lines for one draft quote", () => {
    const proposal = buildProposal({
      extraction: extraction({ intent: "quote", client_name: "Chen", job_title: "Kitchen reno", lines: [hours, valve] }),
      selectedJob: null,
      jobs,
      clients,
    });
    expect(proposal).toMatchObject({ action: "make_quote", job_id: "job-kitchen", client_id: "client-chen" });
    expect(proposal.lines).toEqual([hours, valve]);
    expect(proposal.warnings.join(" ")).not.toContain("Not included yet");

    const preview = previewProposal(proposal, { labourRate: 85, jobTitle: "Kitchen reno", clientName: "Chen, David" })!;
    expect(preview.title).toBe("Make a draft quote for Kitchen reno");
    expect(preview.lines).toHaveLength(2);
    expect(preview.lines.map((l) => l.kind)).toEqual(["labour", "material"]);

    const plan = toConfirmPlan(proposal, { labourRate: 85, job: kitchen });
    expect(plan.ok && plan.kind === "capture" && plan.input.createAs).toBe("quote");
    expect(plan.ok && plan.kind === "capture" && plan.input.lines).toHaveLength(2);
    expect(plan.ok && plan.kind === "capture" && plan.input.lines.map((l) => l.kind)).toEqual(["labour", "material"]);
  });

  it("quote on a selected job keeps the labour line", () => {
    const proposal = buildProposal({
      extraction: extraction({ intent: "quote", lines: [hours, valve] }),
      selectedJob: kitchen,
      jobs,
      clients,
    });
    expect(proposal).toMatchObject({ action: "make_quote", job_id: "job-kitchen" });
    expect(proposal.lines).toEqual([hours, valve]);
  });

  it("does one action: keeps materials now and says what is left for the next message", () => {
    const proposal = buildProposal({
      extraction: extraction({ intent: "log", lines: [hours, valve] }),
      selectedJob: kitchen,
      jobs,
      clients,
    });
    expect(proposal.action).toBe("add_materials");
    expect(proposal.lines).toEqual([valve]);
    expect(proposal.warnings.join(" ")).toContain("Not included yet");
    expect(proposal.warnings.join(" ")).toContain("Labour");
  });

  it("matches an existing client by name and leaves a new name unmatched", () => {
    const known = buildProposal({
      extraction: extraction({ intent: "quote", client_name: "Mrs Patel", job_title: "Heater", lines: [valve] }),
      selectedJob: null,
      jobs,
      clients,
    });
    expect(known).toMatchObject({ action: "make_quote", client_id: "client-patel", job_id: null });
    const fresh = buildProposal({
      extraction: extraction({ intent: "quote", client_name: "Okafor", job_title: "Deck", lines: [valve] }),
      selectedJob: null,
      jobs,
      clients,
    });
    expect(fresh.client_id).toBeNull();
  });

  it("does not attach Create a job to an existing job", () => {
    const proposal = buildProposal({
      extraction: extraction({ client_name: "Chen", job_title: "Kitchen reno" }),
      selectedJob: null,
      jobs,
      clients,
    });
    expect(proposal).toMatchObject({ action: "create_job", job_id: null, client_id: "client-chen" });
  });
});

describe("previewProposal", () => {
  const ctx = { labourRate: 85 };

  it("returns nothing when no action was chosen", () => {
    expect(previewProposal(extraction({ action: null }), ctx)).toBeNull();
  });

  it("describes adding a material to the job and is ready to confirm", () => {
    const preview = previewProposal(
      { ...extraction({ intent: "log", lines: [valve] }), action: "add_materials", job_id: "job-kitchen", client_id: "client-chen" },
      { ...ctx, jobTitle: "Kitchen reno", clientName: "Chen, David" },
    )!;
    expect(preview.title).toBe("Add these materials to Kitchen reno");
    expect(preview.lines).toEqual([
      { kind: "material", description: "Valve", quantity: 1, unit: "ea", unitPrice: 45, note: null },
    ]);
    expect(preview.canConfirm).toBe(true);
  });

  it("blocks a material price that was not in the message", () => {
    const preview = previewProposal(
      { ...extraction({ intent: "log", lines: [valve] }), action: "add_materials", job_id: "job-kitchen", client_id: "client-chen" },
      { ...ctx, jobTitle: "Kitchen reno", transcript: "Add a valve to the kitchen" },
    )!;
    expect(preview.lines[0]?.note).toBe("This price was not in what you said.");
    expect(preview.canConfirm).toBe(false);
    expect(preview.blockers).toContain("This price was not in what you said.");
  });

  it("allows a material price that the message named", () => {
    const preview = previewProposal(
      { ...extraction({ intent: "log", lines: [valve] }), action: "add_materials", job_id: "job-kitchen", client_id: "client-chen" },
      { ...ctx, jobTitle: "Kitchen reno", transcript: "Add a valve at $45 to the kitchen" },
    )!;
    expect(preview.lines[0]).toMatchObject({ unitPrice: 45, note: null });
    expect(preview.canConfirm).toBe(true);
  });

  it("uses the labour rate when no price was spoken", () => {
    const preview = previewProposal(
      { ...extraction({ lines: [hours] }), action: "log_hours", job_id: "job-kitchen", client_id: "client-chen" },
      { ...ctx, jobTitle: "Kitchen reno" },
    )!;
    expect(preview.title).toBe("Log these hours on Kitchen reno");
    expect(preview.lines[0]).toMatchObject({ unitPrice: 85, note: "Using your labour rate" });
    expect(preview.canConfirm).toBe(true);
  });

  it("kitchen hours with no named price still uses the labour rate", () => {
    const preview = previewProposal(
      {
        ...extraction({ lines: [{ ...hours, quantity: 1, description: "Kitchen" }] }),
        action: "log_hours",
        job_id: "job-kitchen",
        client_id: "client-chen",
      },
      { ...ctx, jobTitle: "Kitchen reno", transcript: "Log 1 hour on the kitchen" },
    )!;
    expect(preview.lines[0]).toMatchObject({ unitPrice: 85, note: "Using your labour rate" });
    expect(preview.canConfirm).toBe(true);
  });

  it("blocks confirm when a stated price is missing on labour", () => {
    const preview = previewProposal(
      { ...extraction({ lines: [hours] }), action: "log_hours", job_id: "job-kitchen", client_id: "client-chen" },
      { ...ctx, jobTitle: "Kitchen reno", transcript: "Log 1 hour at 80 dollars" },
    )!;
    expect(preview.lines[0]).toMatchObject({ unitPrice: null, note: "No price" });
    expect(preview.canConfirm).toBe(false);
    expect(preview.blockers).toContain("The named price was not put on the labour line.");
  });

  it("confirms labour at the line price when the model set it, even if the text also names a price", () => {
    const pricedHours = { kind: "labour", description: "Labour", quantity: 1, unit: "hr", unit_price: 80 } as const;
    const preview = previewProposal(
      { ...extraction({ lines: [pricedHours] }), action: "make_quote", job_title: "Deck", client_name: "Okafor" },
      { ...ctx, transcript: "Quote one hour at 80 dollars" },
    )!;
    expect(preview.lines[0]).toMatchObject({ unitPrice: 80, note: null });
    expect(preview.canConfirm).toBe(true);
  });

  it("blocks Confirm and warns when a material has no price", () => {
    const preview = previewProposal(
      {
        ...extraction({ lines: [{ ...valve, unit_price: null }] }),
        action: "add_materials",
        job_id: "job-kitchen",
        client_id: "client-chen",
      },
      ctx,
    )!;
    expect(preview.lines[0]!.note).toBe("No price");
    expect(preview.canConfirm).toBe(false);
    expect(preview.blockers).toContain("Add a price to every line.");
  });

  it("blocks Confirm when a line has no quantity", () => {
    const preview = previewProposal(
      {
        ...extraction({ lines: [{ ...valve, quantity: 0 }] }),
        action: "make_quote",
        job_title: "Deck",
        client_name: "Okafor",
      },
      ctx,
    )!;
    expect(preview.lines[0]!.note).toBe("No quantity");
    expect(preview.canConfirm).toBe(false);
  });

  it("asks for a job when tracked work names one that does not exist", () => {
    const preview = previewProposal(
      { ...extraction({ job_title: "garage", lines: [valve] }), action: "add_materials" },
      ctx,
    )!;
    expect(preview.canConfirm).toBe(false);
    expect(preview.blockers[0]).toContain("garage");
  });

  it("previews a draft quote with a new job and new client", () => {
    const preview = previewProposal(
      {
        ...extraction({ client_name: "Okafor", job_title: "Deck", scope_notes: "Cedar", lines: [valve] }),
        action: "make_quote",
      },
      ctx,
    )!;
    expect(preview).toMatchObject({
      title: "Make a draft quote for Deck",
      jobIsNew: true,
      clientIsNew: true,
      notes: "Cedar",
      canConfirm: true,
    });
  });

  it("needs a title and a client to create a job", () => {
    const missing = previewProposal({ ...extraction({ job_title: "Deck" }), action: "create_job" }, ctx)!;
    expect(missing.canConfirm).toBe(false);
    const ready = previewProposal(
      { ...extraction({ job_title: "Deck", client_name: "Okafor", site_address: "9 Oak" }), action: "create_job" },
      ctx,
    )!;
    expect(ready).toMatchObject({ canConfirm: true, siteAddress: "9 Oak", clientIsNew: true, lines: [] });
  });
});

describe("toConfirmPlan", () => {
  const context = { labourRate: 85, job: { id: "job-kitchen", clientId: "client-chen" } };

  it("add materials writes tracked log lines on the job, never an invoice", () => {
    const plan = toConfirmPlan(
      { ...extraction({ intent: "log", lines: [valve] }), action: "add_materials", job_id: "job-kitchen", client_id: "client-chen" },
      context,
    );
    expect(plan).toEqual({
      ok: true,
      kind: "capture",
      input: {
        createAs: "log",
        client: { id: "client-chen" },
        job: { id: "job-kitchen" },
        notes: undefined,
        lines: [{ kind: "material", description: "Valve", quantity: 1, unit: "ea", unitCost: null, unitPrice: 45 }],
      },
    });
  });

  it("log hours fills the contractor labour rate when no price was spoken", () => {
    const plan = toConfirmPlan(
      { ...extraction({ lines: [hours] }), action: "log_hours", job_id: "job-kitchen", client_id: "client-chen" },
      context,
    );
    expect(plan.ok && plan.kind === "capture" && plan.input.createAs).toBe("log");
    expect(plan.ok && plan.kind === "capture" && plan.input.lines[0]).toMatchObject({ kind: "labour", quantity: 3, unitPrice: 85 });
  });

  it("refuses log hours when the transcript named a price but labour unit_price is empty", () => {
    const plan = toConfirmPlan(
      { ...extraction({ lines: [hours] }), action: "log_hours", job_id: "job-kitchen", client_id: "client-chen" },
      { ...context, transcript: "Log 1 hour at 80 dollars" },
    );
    expect(plan.ok).toBe(false);
  });

  it("confirms labour at 80 when the line already has unit_price 80", () => {
    const plan = toConfirmPlan(
      {
        ...extraction({ lines: [{ ...hours, quantity: 1, unit_price: 80 }] }),
        action: "make_quote",
        job_title: "Deck",
        client_name: "Okafor",
      },
      { labourRate: 85, job: null, transcript: "Quote one hour at 80 dollars" },
    );
    expect(plan.ok && plan.kind === "capture" && plan.input.lines[0]).toMatchObject({ unitPrice: 80 });
  });

  it("make quote and make invoice map to draft documents with notes", () => {
    const base = { ...extraction({ scope_notes: "Scope", lines: [valve] }), job_id: "job-kitchen", client_id: "client-chen" };
    const quote = toConfirmPlan({ ...base, action: "make_quote" }, context);
    const invoice = toConfirmPlan({ ...base, action: "make_invoice" }, context);
    expect(quote.ok && quote.kind === "capture" && quote.input).toMatchObject({ createAs: "quote", notes: "Scope" });
    expect(invoice.ok && invoice.kind === "capture" && invoice.input).toMatchObject({ createAs: "invoice", notes: "Scope" });
  });

  it("a new quote creates a new job, and a new client only when no client matched", () => {
    const fresh = toConfirmPlan(
      {
        ...extraction({ client_name: "Okafor", job_title: "Deck", site_address: "9 Oak", lines: [valve] }),
        action: "make_quote",
      },
      { labourRate: 85, job: null },
    );
    expect(fresh.ok && fresh.kind === "capture" && fresh.input).toMatchObject({
      client: { name: "Okafor" },
      job: { title: "Deck", siteAddress: "9 Oak" },
    });
    const known = toConfirmPlan(
      { ...extraction({ client_name: "Patel", job_title: "Deck", lines: [valve] }), action: "make_quote", client_id: "client-patel" },
      { labourRate: 85, job: null },
    );
    expect(known.ok && known.kind === "capture" && known.input.client).toEqual({ id: "client-patel" });
  });

  it("create job maps to the job service input, not the line-based confirm", () => {
    const plan = toConfirmPlan(
      { ...extraction({ client_name: "Okafor", job_title: "Deck", site_address: "9 Oak" }), action: "create_job" },
      { labourRate: 85, job: null },
    );
    expect(plan).toEqual({
      ok: true,
      kind: "create_job",
      input: { title: "Deck", siteAddress: "9 Oak", client: { name: "Okafor" } },
    });
  });

  it("refuses to map a proposal with a blocker or a job that was not loaded", () => {
    const noPrice = toConfirmPlan(
      {
        ...extraction({ lines: [{ ...valve, unit_price: null }] }),
        action: "add_materials",
        job_id: "job-kitchen",
        client_id: "client-chen",
      },
      context,
    );
    expect(noPrice.ok).toBe(false);
    const missingJob = toConfirmPlan(
      { ...extraction({ lines: [valve] }), action: "add_materials", job_id: "job-kitchen", client_id: "client-chen" },
      { labourRate: 85, job: null },
    );
    expect(missingJob.ok).toBe(false);
    expect(toConfirmPlan(extraction(), context).ok).toBe(false);
  });
});
