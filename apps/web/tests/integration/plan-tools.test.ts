import { and, eq, isNull } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanLoopClient, PlanLoopMessage, PlanStepOptions } from "@/lib/ai/plan-loop";
import { captures, clients, contractors, documents, jobs, lineItems } from "@/lib/db/schema";
import { clearFakeEmails, getFakeEmails } from "@/lib/email";
import { newId } from "@/lib/id";
import { PLAN_NEW } from "@/lib/plans";
import { createDraftDocument, createInvoiceFromTrackedLines, setDocumentStatus } from "@/lib/services/documents";
import { saveDocumentLine, saveTrackedLine } from "@/lib/services/line-items";
import { runPlanAgent, type PlanAgentResult } from "@/lib/services/plan-agent";
import { confirmPlanProposal } from "@/lib/services/plan-proposals";
import { getPlanThread, recordAgentTurn } from "@/lib/services/plans";
import { findDocuments } from "@/lib/services/plan-reads";
import { getTestDb } from "../helpers/db";
import { seedTenant, seedTwoContractors, type TenantSeed } from "../helpers/seed";

const env = process.env;

beforeEach(() => {
  process.env.AI_PROVIDER = "fake";
  process.env.AI_FAKE_MODE = "ok";
  clearFakeEmails();
});

afterEach(() => {
  process.env = { ...env };
  vi.restoreAllMocks();
});

type Call = { name: string; args: unknown };

/**
 * A scripted model: makes these calls on its first step, then answers with `then(results)` (or nothing).
 * `final` answers the last "reply or ask" step the loop takes when a turn would end empty.
 */
function scripted(
  calls: Call[],
  then?: (results: Record<string, unknown>[]) => string | null,
  final?: (options: PlanStepOptions) => Call | null,
): PlanLoopClient & { seen: PlanLoopMessage[][] } {
  let step = 0;
  const seen: PlanLoopMessage[][] = [];
  return {
    seen,
    async complete(messages, _signal, options) {
      seen.push([...messages]);
      step += 1;
      if (options?.tools) {
        const call = final?.(options);
        return call
          ? { content: null, toolCalls: [{ id: `final-${step}`, name: call.name, arguments: JSON.stringify(call.args) }] }
          : { content: null, toolCalls: [] };
      }
      if (step === 1 && calls.length) {
        return { content: null, toolCalls: calls.map((call, index) => ({ id: `c${index}`, name: call.name, arguments: JSON.stringify(call.args) })) };
      }
      const results = messages.filter((message) => message.role === "tool").map((message) => JSON.parse(message.content ?? "null"));
      return { content: then ? then(results) : null, toolCalls: [] };
    },
  };
}

const contractorOf = (tenant: TenantSeed) => ({ id: tenant.contractorId, labourRateHourly: 85 });
const ctxOf = (tenant: TenantSeed) => ({ db: getTestDb(), contractorId: tenant.contractorId });

async function draft(tenant: TenantSeed, type: "quote" | "invoice", lines: { description: string; quantity: number; unitPrice: number }[] = []) {
  const ctx = ctxOf(tenant);
  const doc = await createDraftDocument(ctx, tenant.jobId, type);
  for (const line of lines) {
    await saveDocumentLine(ctx, { jobId: tenant.jobId, documentId: doc.id, kind: "material", unit: "ea", ...line });
  }
  return doc;
}

async function sent(tenant: TenantSeed, type: "quote" | "invoice", lines: { description: string; quantity: number; unitPrice: number }[]) {
  const doc = await draft(tenant, type, lines);
  await setDocumentStatus(ctxOf(tenant), doc.id, "sent");
  return doc;
}

function cards(result: PlanAgentResult) {
  return result.parts.flatMap((part) => (part.kind === "card" ? [part] : []));
}

async function confirm(tenant: TenantSeed, captureId: string) {
  return confirmPlanProposal(ctxOf(tenant), captureId, { authUrl: "https://example.test" });
}

describe("questions about the books", () => {
  it("answers 'how many open quotes' instead of asking which job", async () => {
    const tenant = await seedTenant("counts");
    await draft(tenant, "quote", [{ description: "Tank", quantity: 1, unitPrice: 780 }]);
    await sent(tenant, "quote", [{ description: "Valve", quantity: 1, unitPrice: 45 }]);
    await sent(tenant, "quote", [{ description: "Fittings", quantity: 2, unitPrice: 10 }]);
    const client = scripted([{ name: "find_documents", args: { doc_type: "quote", status: "open" } }], (results) => {
      const found = results[0] as { count: number; count_by_status: Record<string, number> };
      return `${found.count} open quotes: ${found.count_by_status.sent} waiting on the client, ${found.count_by_status.draft} draft.`;
    });
    const result = await runPlanAgent(getTestDb(), contractorOf(tenant), { text: "how many open quotes do i have", client });
    expect(result.parts).toEqual([{ kind: "text", body: "3 open quotes: 2 waiting on the client, 1 draft." }]);
  });

  it("answers the follow-up 'for all of them' from the earlier messages", async () => {
    const tenant = await seedTenant("follow");
    await sent(tenant, "quote", [{ description: "Valve", quantity: 1, unitPrice: 45 }]);
    const client = scripted([{ name: "find_documents", args: { doc_type: "quote", status: "open" } }], (results) => {
      return `${(results[0] as { count: number }).count} open quote.`;
    });
    const result = await runPlanAgent(getTestDb(), contractorOf(tenant), {
      text: "for all of them",
      history: [
        { role: "user", content: "how many open quotes do i have" },
        { role: "assistant", content: "Which job?" },
      ],
      client,
    });
    expect(result.reply).toBe("1 open quote.");
    expect(client.seen[0]!.some((message) => message.content === "how many open quotes do i have")).toBe(true);
  });

  it("never reads another contractor's paperwork", async () => {
    const { a, b } = await seedTwoContractors();
    await sent(a, "invoice", [{ description: "A work", quantity: 1, unitPrice: 100 }]);
    const theirs = await sent(b, "invoice", [{ description: "B work", quantity: 1, unitPrice: 999 }]);
    const found = await findDocuments(ctxOf(a), {});
    expect(found.count).toBe(1);
    expect(JSON.stringify(found)).not.toContain("B work");
    const client = scripted([{ name: "get_document", args: { document_id: theirs.id } }], (results) => JSON.stringify(results[0]));
    const result = await runPlanAgent(getTestDb(), contractorOf(a), { text: "what's in that invoice", client });
    expect(result.reply).toContain("not found");
    expect(result.reply).not.toContain("999");
  });

  it("reports owed and overdue totals computed by the app", async () => {
    const tenant = await seedTenant("owed");
    const ctx = ctxOf(tenant);
    const late = await sent(tenant, "invoice", [{ description: "Late", quantity: 1, unitPrice: 100 }]);
    await sent(tenant, "invoice", [{ description: "Fine", quantity: 3, unitPrice: 33.33 }]);
    await ctx.db.update(documents).set({ dueDate: "2020-01-01" }).where(eq(documents.id, late.id));
    let snapshot: Record<string, { count: number; total: number }> = {};
    const client = scripted([{ name: "business_snapshot", args: { period: "month" } }], (results) => {
      snapshot = results[0] as typeof snapshot;
      return "ok";
    });
    await runPlanAgent(getTestDb(), contractorOf(tenant), { text: "who owes me", client });
    const rows = await ctx.db.select().from(documents).where(eq(documents.contractorId, tenant.contractorId));
    const owed = Math.round(rows.reduce((sum, doc) => sum + doc.total, 0) * 100) / 100;
    expect(snapshot.owed).toEqual({ count: 2, total: owed });
    expect(snapshot.overdue!.count).toBe(1);
  });
});

describe("ids stay out of what the contractor reads", () => {
  it("strips ids from a reply and from a question's choices", async () => {
    const tenant = await seedTenant("ids");
    const quote = await draft(tenant, "quote", [{ description: "Tank", quantity: 1, unitPrice: 780 }]);
    const client = scripted(
      [{ name: "ask", args: { question: `Which one? (id ${quote.id})`, options: [{ label: `${quote.number} — id ${quote.id}`, job_id: tenant.jobId }] } }],
    );
    const asked = await runPlanAgent(getTestDb(), contractorOf(tenant), { text: "which quote", client });
    expect(JSON.stringify(asked.parts)).not.toContain(quote.id);
    expect(asked.parts[0]).toMatchObject({ kind: "ask", body: "Which one?", options: [{ label: quote.number, jobId: tenant.jobId }] });

    const replied = await runPlanAgent(getTestDb(), contractorOf(tenant), {
      text: "lay them out by job name",
      client: scripted([{ name: "find_documents", args: {} }], (results) => {
        const found = results[0] as { documents: { id: string; number: string }[] };
        return found.documents.map((doc) => `- ${doc.number} — id ${doc.id}`).join("\n");
      }),
    });
    expect(replied.reply).toBe(`- ${quote.number}`);
  });
});

describe("no empty turns", () => {
  it("takes one more step that may only answer or ask", async () => {
    const tenant = await seedTenant("empty");
    let offered: string[] = [];
    const client = scripted([{ name: "find_jobs", args: {} }], () => null, (options) => {
      offered = options.tools ?? [];
      return { name: "ask", args: { question: "Which job?", options: [{ label: "Job empty", job_id: tenant.jobId }] } };
    });
    const result = await runPlanAgent(getTestDb(), contractorOf(tenant), { text: "what about that one", client });
    expect(offered).toEqual(["reply", "ask"]);
    expect(result.parts).toEqual([{ kind: "ask", body: "Which job?", options: [{ label: "Job empty", jobId: tenant.jobId }] }]);
  });

  it("says it couldn't work it out, without 'Add it yourself', when a question gets nothing", async () => {
    const tenant = await seedTenant("nothing");
    const client = scripted([], () => null, () => null);
    const result = await runPlanAgent(getTestDb(), contractorOf(tenant), { text: "what about that one", client });
    expect(result.parts).toEqual([{ kind: "text", body: "I couldn't work that out. Name the job or the document and try again." }]);
    expect(result.reviewUrl).toBe("/app");
  });

  it("saves a question's choices with the thread", async () => {
    const tenant = await seedTenant("choices");
    const ctx = ctxOf(tenant);
    const client = scripted([{ name: "ask", args: { question: "Which job?", options: [{ label: "Job choices", job_id: tenant.jobId }, { label: "Someone else's", job_id: "nope" }] } }]);
    const result = await runPlanAgent(getTestDb(), contractorOf(tenant), { text: "invoice it", client });
    const planId = await recordAgentTurn(ctx, { planId: PLAN_NEW, userBody: "invoice it", result });
    const thread = await getPlanThread(ctx, planId!);
    expect(thread.messages.at(-1)?.options).toEqual([
      { label: "Job choices", jobId: tenant.jobId },
      { label: "Someone else's", jobId: null },
    ]);
  });
});

describe("money moves", () => {
  it("'Patel approved, invoice it' makes two cards that confirm once each", async () => {
    const tenant = await seedTenant("approve");
    const quote = await sent(tenant, "quote", [{ description: "Tank", quantity: 1, unitPrice: 780 }]);
    const client = scripted([
      { name: "propose_document_change", args: { document_id: quote.id, action: "mark_approved" } },
      { name: "propose_invoice", args: { quote_id: quote.id } },
    ]);
    const result = await runPlanAgent(getTestDb(), contractorOf(tenant), { text: "Patel approved, invoice it", client });
    const [status, invoice] = cards(result);
    expect(status?.body).toBe(`Mark ${quote.number} approved`);
    expect(invoice?.preview?.blockers).toEqual([`${quote.number} is sent. Mark it approved first.`]);

    expect(await confirm(tenant, status!.captureId)).toMatchObject({ kind: "done" });
    const first = await confirm(tenant, invoice!.captureId);
    expect(first.kind).toBe("document");
    expect(await confirm(tenant, invoice!.captureId)).toEqual(first);
    expect(await confirm(tenant, status!.captureId)).toMatchObject({ kind: "done" });

    const docs = await getTestDb().select().from(documents).where(eq(documents.contractorId, tenant.contractorId));
    expect(docs.filter((doc) => doc.type === "invoice")).toHaveLength(1);
    expect(docs.find((doc) => doc.type === "invoice")).toMatchObject({ sourceQuoteId: quote.id, subtotal: 780 });
    const [job] = await getTestDb().select().from(jobs).where(eq(jobs.id, tenant.jobId));
    expect(job?.status).toBe("active");
  });

  it("refuses a status change the rules do not allow", async () => {
    const tenant = await seedTenant("illegal");
    const quote = await draft(tenant, "quote", [{ description: "Tank", quantity: 1, unitPrice: 780 }]);
    const client = scripted([{ name: "propose_document_change", args: { document_id: quote.id, action: "mark_paid" } }]);
    const result = await runPlanAgent(getTestDb(), contractorOf(tenant), { text: "mark it paid", client });
    const [card] = cards(result);
    expect(card?.preview?.canConfirm).toBe(false);
    await expect(confirm(tenant, card!.captureId)).rejects.toThrow("can't be marked paid");
  });

  it("invoices a job's unbilled work through the tracked-lines invoice", async () => {
    const tenant = await seedTenant("unbilled");
    await saveTrackedLine(ctxOf(tenant), { jobId: tenant.jobId, kind: "labour", description: "Labour", quantity: 2, unit: "hr", unitPrice: 85 });
    const client = scripted([{ name: "propose_invoice", args: { job_id: tenant.jobId } }]);
    const result = await runPlanAgent(getTestDb(), contractorOf(tenant), { text: "bill the job", client });
    const [card] = cards(result);
    expect(card?.preview?.action).toBe("invoice_tracked");
    await confirm(tenant, card!.captureId);
    const left = await getTestDb()
      .select()
      .from(lineItems)
      .where(and(eq(lineItems.jobId, tenant.jobId), isNull(lineItems.documentId), isNull(lineItems.billedDocumentId)));
    expect(left).toHaveLength(0);
  });
});

describe("editing drafts", () => {
  it("adds a fee the contractor named to a draft and shows the new total", async () => {
    const tenant = await seedTenant("fee");
    const quote = await draft(tenant, "quote", [{ description: "Tank", quantity: 1, unitPrice: 780 }]);
    const client = scripted([
      {
        name: "propose_document_change",
        args: { document_id: quote.id, action: "add_lines", lines: [{ kind: "other", description: "Disposal fee", quantity: 1, unit_price: 50 }] },
      },
    ]);
    const result = await runPlanAgent(getTestDb(), contractorOf(tenant), { text: `add a $50 disposal fee to ${quote.number}`, client });
    const [card] = cards(result);
    expect(card?.preview?.canConfirm).toBe(true);
    expect(card?.preview?.changes?.find((row) => row.label === "Total")?.value).toBe("$881.40 → $937.90");
    await confirm(tenant, card!.captureId);
    const [doc] = await getTestDb().select().from(documents).where(eq(documents.id, quote.id));
    expect(doc?.subtotal).toBe(830);
  });

  it("refuses to edit a sent quote, with the reason", async () => {
    const tenant = await seedTenant("locked");
    const quote = await sent(tenant, "quote", [{ description: "Tank", quantity: 1, unitPrice: 780 }]);
    const client = scripted([
      {
        name: "propose_document_change",
        args: { document_id: quote.id, action: "add_lines", lines: [{ kind: "other", description: "Disposal fee", quantity: 1, unit_price: 50 }] },
      },
    ]);
    const result = await runPlanAgent(getTestDb(), contractorOf(tenant), { text: `add a $50 disposal fee to ${quote.number}`, client });
    const [card] = cards(result);
    expect(card?.preview?.blockers[0]).toBe(`${quote.number} is sent, so its lines can't change. Only a draft can be edited.`);
    await expect(confirm(tenant, card!.captureId)).rejects.toThrow("Only a draft can be edited");
  });

  it("blocks a fee price nobody said", async () => {
    const tenant = await seedTenant("unsaidfee");
    const quote = await draft(tenant, "quote", [{ description: "Tank", quantity: 1, unitPrice: 780 }]);
    const client = scripted([
      {
        name: "propose_document_change",
        args: { document_id: quote.id, action: "add_lines", lines: [{ kind: "other", description: "Disposal fee", quantity: 1, unit_price: 75 }] },
      },
    ]);
    const result = await runPlanAgent(getTestDb(), contractorOf(tenant), { text: "add a disposal fee", client });
    expect(cards(result)[0]?.preview?.blockers).toContain("This price was not in what you said.");
  });
});

describe("prices from the contractor's records", () => {
  it("copies the last water heater price and says where it came from", async () => {
    const tenant = await seedTenant("memory");
    const old = await sent(tenant, "quote", [{ description: "40 gal water heater", quantity: 1, unitPrice: 780 }]);
    const [oldLine] = await getTestDb().select().from(lineItems).where(eq(lineItems.documentId, old.id));
    let found: { last_price: { unit_price: number } | null; lines: { id: string }[] } | null = null;
    const client: PlanLoopClient = {
      async complete(messages) {
        const tools = messages.filter((message) => message.role === "tool");
        if (tools.length === 0) {
          return { content: null, toolCalls: [{ id: "s", name: "search_lines", arguments: JSON.stringify({ query: "water heater" }) }] };
        }
        if (tools.length === 1) {
          found = JSON.parse(tools[0]!.content ?? "null");
          return {
            content: null,
            toolCalls: [
              {
                id: "p",
                name: "propose_work",
                arguments: JSON.stringify({
                  intent: "quote",
                  job_id: tenant.jobId,
                  lines: [{ kind: "material", description: "Water heater", quantity: 1, unit_price: 999, price_source: found!.lines[0]!.id }],
                }),
              },
            ],
          };
        }
        return { content: null, toolCalls: [] };
      },
    };
    const result = await runPlanAgent(getTestDb(), contractorOf(tenant), { text: "quote the same water heater as last time", client });
    expect(found!.last_price?.unit_price).toBe(780);
    const [card] = cards(result);
    expect(card?.preview?.canConfirm).toBe(true);
    expect(card?.preview?.lines[0]).toMatchObject({ unitPrice: 780, note: expect.stringContaining(`From ${old.number}`) });
    expect(oldLine?.id).toBe(found!.lines[0]!.id);
  });

  it("rejects a price_source that is not the contractor's line", async () => {
    const { a, b } = await seedTwoContractors();
    const theirs = await sent(b, "quote", [{ description: "Water heater", quantity: 1, unitPrice: 5 }]);
    const [line] = await getTestDb().select().from(lineItems).where(eq(lineItems.documentId, theirs.id));
    const client = scripted(
      [{ name: "propose_work", args: { intent: "quote", job_id: a.jobId, lines: [{ kind: "material", description: "Heater", quantity: 1, price_source: line!.id }] } }],
      (results) => JSON.stringify(results[0]),
    );
    const result = await runPlanAgent(getTestDb(), contractorOf(a), { text: "same heater price", client });
    expect(cards(result)).toHaveLength(0);
    expect(result.reply).toContain("price_source is not one of your lines");
  });
});

describe("sending", () => {
  beforeEach(() => {
    process.env.EMAIL_PROVIDER = "fake";
  });

  async function withEmail(tenant: TenantSeed) {
    await getTestDb().update(clients).set({ email: "client@example.test" }).where(eq(clients.id, tenant.clientId));
  }

  it("emails a draft quote once and marks it sent", async () => {
    const tenant = await seedTenant("send");
    await withEmail(tenant);
    const quote = await draft(tenant, "quote", [{ description: "Tank", quantity: 1, unitPrice: 780 }]);
    const client = scripted([{ name: "propose_send", args: { document_id: quote.id } }]);
    const result = await runPlanAgent(getTestDb(), contractorOf(tenant), { text: "send Patel the quote", client });
    const [card] = cards(result);
    expect(card?.preview?.changes).toEqual([
      { label: "To", value: "client@example.test" },
      { label: "Status", value: "draft → sent" },
    ]);
    expect(getFakeEmails()).toHaveLength(0);
    await confirm(tenant, card!.captureId);
    await confirm(tenant, card!.captureId);
    expect(getFakeEmails()).toHaveLength(1);
    const [doc] = await getTestDb().select().from(documents).where(eq(documents.id, quote.id));
    expect(doc?.status).toBe("sent");
  });

  it("sends a payment reminder for a sent invoice", async () => {
    const tenant = await seedTenant("remind");
    await withEmail(tenant);
    const invoice = await sent(tenant, "invoice", [{ description: "Valve", quantity: 1, unitPrice: 45 }]);
    const client = scripted([{ name: "propose_send", args: { document_id: invoice.id, reminder: true } }]);
    const result = await runPlanAgent(getTestDb(), contractorOf(tenant), { text: "remind Chen to pay", client });
    await confirm(tenant, cards(result)[0]!.captureId);
    expect(getFakeEmails()[0]?.subject).toMatch(/^Reminder: /);
    expect(getFakeEmails()[0]?.text).toContain("still unpaid");
  });

  it("will not send without an email address", async () => {
    const tenant = await seedTenant("noemail");
    const quote = await draft(tenant, "quote", [{ description: "Tank", quantity: 1, unitPrice: 780 }]);
    const client = scripted([{ name: "propose_send", args: { document_id: quote.id } }]);
    const result = await runPlanAgent(getTestDb(), contractorOf(tenant), { text: "send it", client });
    const [card] = cards(result);
    expect(card?.preview?.canConfirm).toBe(false);
    await expect(confirm(tenant, card!.captureId)).rejects.toThrow("has no email");
    expect(getFakeEmails()).toHaveLength(0);
  });
});

describe("undo", () => {
  it("removes hours confirmed a moment ago", async () => {
    const tenant = await seedTenant("undo");
    const db = getTestDb();
    const logged = await runPlanAgent(db, contractorOf(tenant), { text: "add 3 hours of labour", jobId: tenant.jobId });
    await confirm(tenant, logged.captureId);
    const client = scripted([{ name: "propose_undo", args: {} }]);
    const undo = await runPlanAgent(db, contractorOf(tenant), { text: "undo that", client });
    const [card] = cards(undo);
    expect(card?.body).toBe("Undo: remove 1 line");
    await confirm(tenant, card!.captureId);
    expect(await db.select().from(lineItems).where(eq(lineItems.captureId, logged.captureId))).toHaveLength(0);
    const [row] = await db.select().from(captures).where(eq(captures.id, logged.captureId));
    expect(row?.status).toBe("discarded");
  });

  it("refuses once the lines were invoiced", async () => {
    const tenant = await seedTenant("undone");
    const db = getTestDb();
    const logged = await runPlanAgent(db, contractorOf(tenant), { text: "add 3 hours of labour", jobId: tenant.jobId });
    await confirm(tenant, logged.captureId);
    await createInvoiceFromTrackedLines(ctxOf(tenant), tenant.jobId);
    const undo = await runPlanAgent(db, contractorOf(tenant), { text: "undo that", client: scripted([{ name: "propose_undo", args: {} }]) });
    const [card] = cards(undo);
    expect(card?.preview?.blockers).toEqual(["Those lines were already invoiced, so they can't be undone from Plan."]);
  });
});

describe("jobs, clients and settings", () => {
  it("moves an unbilled receipt line to another job, and refuses a billed one", async () => {
    const tenant = await seedTenant("move");
    const db = getTestDb();
    const ctx = ctxOf(tenant);
    const otherJob = newId();
    await db.insert(jobs).values({ id: otherJob, contractorId: tenant.contractorId, clientId: tenant.clientId, title: "Bathroom", status: "active", createdAt: Date.now(), updatedAt: Date.now() });
    const lineId = await saveTrackedLine(ctx, { jobId: tenant.jobId, kind: "material", description: "Valve", quantity: 1, unit: "ea", unitPrice: 45 });
    const client = scripted([{ name: "propose_job_change", args: { job_id: tenant.jobId, action: "move_lines", line_ids: [lineId], to_job_id: otherJob } }]);
    const result = await runPlanAgent(db, contractorOf(tenant), { text: "that valve was for the bathroom", client });
    await confirm(tenant, cards(result)[0]!.captureId);
    const [moved] = await db.select().from(lineItems).where(eq(lineItems.id, lineId));
    expect(moved?.jobId).toBe(otherJob);

    await createInvoiceFromTrackedLines(ctx, otherJob);
    const back = scripted([{ name: "propose_job_change", args: { job_id: otherJob, action: "move_lines", line_ids: [lineId], to_job_id: tenant.jobId } }]);
    const again = await runPlanAgent(db, contractorOf(tenant), { text: "move it back", client: back });
    expect(cards(again)[0]?.preview?.blockers).toEqual(["Only unbilled lines on Bathroom can be moved."]);
  });

  it("updates a client's email and keeps their phone", async () => {
    const tenant = await seedTenant("client");
    const db = getTestDb();
    await db.update(clients).set({ phone: "555-0100" }).where(eq(clients.id, tenant.clientId));
    const client = scripted([{ name: "propose_client", args: { client_id: tenant.clientId, email: "new@example.test" } }]);
    const result = await runPlanAgent(db, contractorOf(tenant), { text: "Patel's email is new@example.test", client });
    await confirm(tenant, cards(result)[0]!.captureId);
    const [row] = await db.select().from(clients).where(eq(clients.id, tenant.clientId));
    expect(row).toMatchObject({ email: "new@example.test", phone: "555-0100" });
  });

  it("changes the labour rate after showing old and new", async () => {
    const tenant = await seedTenant("rate");
    const db = getTestDb();
    const client = scripted([{ name: "propose_settings", args: { labour_rate: 95 } }]);
    const result = await runPlanAgent(db, contractorOf(tenant), { text: "my rate is $95 now", client });
    const [card] = cards(result);
    expect(card?.preview?.changes).toEqual([{ label: "Labour rate", value: "$85.00/h → $95.00/h" }]);
    await confirm(tenant, card!.captureId);
    const [row] = await db.select().from(contractors).where(eq(contractors.id, tenant.contractorId));
    expect(row?.labourRateHourly).toBe(95);
  });

  it("marks a job done", async () => {
    const tenant = await seedTenant("done");
    const client = scripted([{ name: "propose_job_change", args: { job_id: tenant.jobId, action: "set_status", status: "done" } }]);
    const result = await runPlanAgent(getTestDb(), contractorOf(tenant), { text: "kitchen's done", client });
    await confirm(tenant, cards(result)[0]!.captureId);
    const [job] = await getTestDb().select().from(jobs).where(eq(jobs.id, tenant.jobId));
    expect(job?.status).toBe("done");
  });
});

describe("the turn log", () => {
  it("logs each tool with its outcome and never the message", async () => {
    const tenant = await seedTenant("trace");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const client = scripted([{ name: "find_jobs", args: {} }, { name: "get_job", args: { job_id: "nope" } }], () => "done");
    await runPlanAgent(getTestDb(), contractorOf(tenant), { text: "secret client words", client });
    const event = info.mock.calls.map((call) => call[0] as { event?: string; tools?: { tool: string; ok: boolean }[] }).find((entry) => entry?.event === "plan_turn_finished");
    expect(event?.tools?.map((entry) => [entry.tool, entry.ok])).toEqual([
      ["find_jobs", true],
      ["get_job", false],
      ["reply", true],
    ]);
    expect(JSON.stringify(info.mock.calls)).not.toContain("secret client words");
  });
});
