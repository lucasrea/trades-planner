#!/usr/bin/env npx tsx
/**
 * Live conversation eval for the Plan agent. Not part of CI: it calls the real model and costs a few
 * cents. Each chat runs several turns through the same path as the web Plan screen (runPlanAgent with
 * thread history, recordAgentTurn), against a throwaway local Postgres that this script resets.
 * Cards are confirmed in that database only. Email uses the fake provider.
 *
 * Usage, from apps/web:
 *   DATABASE_URL_TEST=postgres://ci:ci@127.0.0.1:54329/ci AI_PROVIDER=live OPENAI_API_KEY=… EXTRACTION_MODEL=gpt-5-mini [PLAN_MODEL=…] \
 *     npx tsx scripts/eval-plan-chats.ts [chat-name …]
 * Writes a full transcript to EVAL_OUT (default: plan-chats-eval.json in the current directory).
 */
import fs from "node:fs";
import path from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { clients, contractors, documents, jobs, lineItems, users } from "../lib/db/schema";
import { clearFakeEmails, getFakeEmails } from "../lib/email";
import { newId } from "../lib/id";
import type { PlanPreview } from "../lib/plan-proposal";
import { PLAN_NEW } from "../lib/plans";
import { isLocalPostgresConnectionString } from "../lib/postgres-url";
import { createDraftDocument, createInvoiceFromQuote, setDocumentStatus } from "../lib/services/documents";
import { saveDocumentLine, saveTrackedLine } from "../lib/services/line-items";
import { runPlanAgent, type PlanAgentResult } from "../lib/services/plan-agent";
import { confirmPlanProposal } from "../lib/services/plan-proposals";
import { listRecentPlanHistory, recordAgentTurn } from "../lib/services/plans";
import { getTestDb, getTestDatabaseUrl, getTestSql, resetPublicSchema } from "../tests/helpers/db";

// ---- Safety and setup ----

const url = getTestDatabaseUrl();
if (!isLocalPostgresConnectionString(url)) {
  console.error("Refusing to run: DATABASE_URL_TEST must be a local throwaway database. This script drops its schema.");
  process.exit(1);
}
if (process.env.AI_PROVIDER !== "live" || !process.env.OPENAI_API_KEY || !process.env.EXTRACTION_MODEL) {
  console.error("Set AI_PROVIDER=live, OPENAI_API_KEY and EXTRACTION_MODEL.");
  process.exit(1);
}
process.env.EMAIL_PROVIDER = "fake";
process.env.DATABASE_URL = url;

const db = getTestDb();

async function resetDatabase() {
  await resetPublicSchema();
  const dir = path.resolve(process.cwd(), "../../supabase/migrations");
  const sql = getTestSql();
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".sql")).sort()) {
    await sql.unsafe(fs.readFileSync(path.join(dir, file), "utf8"));
  }
}

// ---- A realistic small business ----

type Seed = Awaited<ReturnType<typeof seedBusiness>>;

async function seedBusiness() {
  const now = Date.now();
  const userId = newId();
  const contractorId = newId();
  await db.insert(users).values({ id: userId, email: `eval-${userId}@example.test`, name: "Eval", createdAt: now });
  await db.insert(contractors).values({
    id: contractorId,
    userId,
    businessName: "Rea Plumbing",
    email: "office@example.test",
    labourRateHourly: 85,
    defaultMarkupPct: 20,
    taxRate: 0.13,
    taxLabel: "HST",
    nextQuoteNumber: 1,
    nextInvoiceNumber: 1,
  });
  const ctx = { db, contractorId };
  const client = async (name: string, email: string) => {
    const id = newId();
    await db.insert(clients).values({ id, contractorId, name, email, createdAt: now });
    return id;
  };
  const job = async (title: string, clientId: string, status: string) => {
    const id = newId();
    await db.insert(jobs).values({ id, contractorId, clientId, title, status, createdAt: now, updatedAt: now });
    return id;
  };
  const chen = await client("Chen", "chen@example.test");
  const patel = await client("Patel", "patel@example.test");
  const pippo = await client("pippo", "");
  const kitchen = await job("Kitchen reno", chen, "active");
  const heater = await job("Water heater replacement", patel, "quoted");
  const bath = await job("new bathroom", pippo, "active");

  const line = (jobId: string, documentId: string, kind: "labour" | "material", description: string, quantity: number, unitPrice: number) =>
    saveDocumentLine(ctx, { jobId, documentId, kind, description, quantity, unit: kind === "labour" ? "hr" : "ea", unitPrice });

  // Q-0001: water heater, sent and waiting.
  const q1 = await createDraftDocument(ctx, heater, "quote");
  await line(heater, q1.id, "material", "40 gal water heater", 1, 780);
  await line(heater, q1.id, "labour", "Install labour", 4, 85);
  await setDocumentStatus(ctx, q1.id, "sent");
  // Q-0002: bathroom vanity, still a draft.
  const q2 = await createDraftDocument(ctx, bath, "quote");
  await line(bath, q2.id, "material", "Vanity", 1, 450);
  // Q-0003: kitchen rough-in, approved and invoiced as INV-0001, which is overdue.
  const q3 = await createDraftDocument(ctx, kitchen, "quote");
  await line(kitchen, q3.id, "labour", "Kitchen rough-in labour", 6, 85);
  await setDocumentStatus(ctx, q3.id, "sent");
  await setDocumentStatus(ctx, q3.id, "approved");
  const inv1 = await createInvoiceFromQuote(ctx, q3.id);
  await setDocumentStatus(ctx, inv1, "sent");
  await db.update(documents).set({ dueDate: "2026-11-01" }).where(eq(documents.id, inv1));
  // INV-0002: kitchen faucet, paid.
  const inv2 = await createDraftDocument(ctx, kitchen, "invoice");
  await line(kitchen, inv2.id, "material", "Faucet install", 1, 200);
  await setDocumentStatus(ctx, inv2.id, "sent");
  await setDocumentStatus(ctx, inv2.id, "paid");
  // Unbilled on the kitchen: 3 h labour ($255) and a PEX run bought at $60, sold at $72. $327 in all.
  await saveTrackedLine(ctx, { jobId: kitchen, kind: "labour", description: "Labour", quantity: 3, unit: "hr", unitPrice: 85 });
  const pex = await saveTrackedLine(ctx, { jobId: kitchen, kind: "material", description: "1/2 in PEX 100 ft", quantity: 1, unit: "ea", unitCost: 60, unitPrice: 72 });

  return { contractorId, ctx, clients: { chen, patel, pippo }, jobs: { kitchen, heater, bath }, docs: { q1: q1.id, q2: q2.id, q3: q3.id, inv1, inv2: inv2.id }, pex };
}

// ---- Running a chat ----

type Turn = {
  say: string;
  result: PlanAgentResult;
  ms: number;
  tools: { tool: string; ok: boolean; ms: number }[];
  text: string;
  cards: { captureId: string; title: string; preview: PlanPreview | null }[];
  /** Wrong facts, wrong job, a made-up price, an id on screen: the answer is wrong. */
  problems: string[];
  /** Style: right answer, but not how we want it said or done. */
  warnings: string[];
};

type Chat = { seed: Seed; planId: string | null; turns: Turn[]; jobId?: string };

async function say(chat: Chat, text: string, opts: { jobId?: string } = {}): Promise<Turn> {
  const ctx = chat.seed.ctx;
  const history = await listRecentPlanHistory(ctx, chat.planId ?? undefined);
  const events: { event?: string; tools?: Turn["tools"] }[] = [];
  const info = console.info;
  console.info = (value: unknown) => events.push(value as (typeof events)[number]);
  const started = Date.now();
  let result: PlanAgentResult;
  try {
    result = await runPlanAgent(db, { id: chat.seed.contractorId, labourRateHourly: 85 }, { text, jobId: opts.jobId, history });
  } finally {
    console.info = info;
  }
  const ms = Date.now() - started;
  chat.planId = await recordAgentTurn(ctx, { planId: chat.planId ?? PLAN_NEW, userBody: text, result, jobId: opts.jobId });
  const cards = result.parts.flatMap((part) => (part.kind === "card" ? [{ captureId: part.captureId, title: part.body, preview: part.preview }] : []));
  const words = result.parts
    .map((part) => (part.kind === "ask" ? `${part.body}\n${part.options.map((option) => option.label).join("\n")}` : part.body))
    .join("\n");
  const turn: Turn = {
    say: text,
    result,
    ms,
    tools: events.find((event) => event.event === "plan_turn_finished")?.tools ?? [],
    text: words,
    cards,
    problems: [],
    warnings: [],
  };
  turn.problems.push(...universalProblems(turn));
  chat.turns.push(turn);
  return turn;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const JARGON = /\b(propose_\w+|find_(?:jobs|documents|clients)|get_(?:job|document)|search_lines|business_snapshot|unit_price|unit_cost|markup_amount|price_source|job_id|client_id|document_id|tool call)\b/i;

function shown(turn: Turn) {
  const cardText = turn.cards
    .map((card) => [card.title, ...(card.preview?.lines.map((line) => `${line.description} ${line.note ?? ""}`) ?? []), ...(card.preview?.changes?.map((row) => `${row.label} ${row.value}`) ?? []), ...(card.preview?.blockers ?? []), ...(card.preview?.warnings ?? [])].join("\n"))
    .join("\n");
  return `${turn.text}\n${cardText}`;
}

function universalProblems(turn: Turn) {
  const problems: string[] = [];
  const visible = shown(turn);
  if (UUID.test(visible)) problems.push("An id is visible to the contractor.");
  const jargon = JARGON.exec(visible);
  if (jargon) problems.push(`Tool or field name visible: "${jargon[0]}".`);
  if (turn.result.parts.length === 0) problems.push("Empty turn.");
  if (/typical (?:price|cost)|usually costs|around \$\d|about \$\d/i.test(turn.text)) problems.push("Suggests a price nobody gave.");
  if (turn.result.status === "failed") problems.push(`Turn failed: ${turn.text.slice(0, 120)}`);
  if (turn.ms > 50_000) problems.push(`Took ${Math.round(turn.ms / 1000)} s.`);
  return problems;
}

function expect(turn: Turn, ok: boolean, problem: string) {
  if (!ok) turn.problems.push(problem);
}

function soft(turn: Turn, ok: boolean, warning: string) {
  if (!ok) turn.warnings.push(warning);
}

const confirmable = (turn: Turn) => turn.cards.filter((card) => card.preview?.canConfirm);
const noConfirmable = (turn: Turn, why: string) => expect(turn, confirmable(turn).length === 0, `Must not offer a confirmable card: ${why}. Got ${confirmable(turn).map((c) => c.title).join(" | ")}.`);

async function confirm(turn: Turn, chat: Chat, card: Turn["cards"][number] | undefined, label: string) {
  if (!card) {
    turn.problems.push(`No card to confirm (${label}).`);
    return null;
  }
  try {
    return await confirmPlanProposal(chat.seed.ctx, card.captureId, { authUrl: "https://example.test" });
  } catch (error) {
    turn.problems.push(`Confirm failed (${label}): ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

const mentions = (turn: Turn, pattern: RegExp) => pattern.test(shown(turn));
const cardWhere = (turn: Turn, test: (preview: PlanPreview) => boolean) => turn.cards.find((card) => card.preview && test(card.preview));

// ---- The chats ----

const CHATS: Record<string, (chat: Chat) => Promise<void>> = {
  async books(chat) {
    const t1 = await say(chat, "how many open quotes do i have");
    expect(t1, mentions(t1, /\b2\b|\btwo\b/i), "Should say 2 open quotes (Q-0001 sent, Q-0002 draft).");
    const t2 = await say(chat, "lay them out by job name");
    expect(t2, mentions(t2, /water heater replacement/i) && mentions(t2, /new bathroom/i), "Should list both jobs by name.");
    expect(
      t2,
      (mentions(t2, /Q-0001/) && mentions(t2, /Q-0002/)) || (mentions(t2, /1,265\.60/) && mentions(t2, /508\.50/)),
      "Should list both quotes, by number or by their totals ($1,265.60 and $508.50).",
    );
    expect(t2, !mentions(t2, /kitchen reno[^\n]*(draft|quote)/i), "Kitchen reno has no open quote.");
    expect(t2, !mentions(t2, /Q-0003/), "Q-0003 is approved, not open.");
    const t3 = await say(chat, "who owes me money?");
    expect(t3, mentions(t3, /INV-0001|Chen/i), "Should name INV-0001 or Chen.");
    expect(t3, mentions(t3, /576\.30/), "Should give $576.30 owed.");
  },

  async newJob(chat) {
    const t1 = await say(
      chat,
      "starting a new job for someone named Joe. I need to Swap the Moen valve, rerun half-inch PEX to the kitchen, new toilet flange — call it a six-hour day.",
    );
    const card = cardWhere(t1, (preview) => preview.action === "make_quote" || preview.action === "create_job");
    expect(t1, Boolean(card), "Should draft a quote (or a new job) card.");
    expect(t1, !t1.cards.some((c) => c.preview?.jobId), "Must not attach an existing job.");
    expect(t1, !mentions(t1, /Kitchen reno|pippo/i), "Must not use the Kitchen reno job or its client.");
    expect(t1, t1.cards.some((c) => /joe/i.test(c.preview?.clientName ?? "")), "Client should be Joe.");
    expect(t1, t1.cards.some((c) => c.preview?.lines.some((line) => line.kind === "labour" && line.quantity === 6)), "Should have 6 h of labour.");
    const t2 = await say(chat, "the flange is $18 and the PEX and fittings are $35");
    const priced = cardWhere(t2, (preview) => preview.lines.some((line) => line.unitPrice === 18) && preview.lines.some((line) => line.unitPrice === 35));
    expect(t2, Boolean(priced), "Should give a card with the $18 flange and $35 PEX.");
    // The model may add a line Joe never priced (the valve itself). Then the card is rightly blocked,
    // but only by that line: the labour, flange and PEX must all be priced.
    const unpriced = priced?.preview?.lines.filter((line) => line.unitPrice == null) ?? [];
    expect(
      t2,
      Boolean(priced?.preview?.canConfirm) || (unpriced.length > 0 && unpriced.every((line) => !/flange|pex/i.test(line.description))),
      `That card should be confirmable, or blocked only by a line Joe never priced. Blockers: ${priced?.preview?.blockers.join("; ") ?? "no card"}`,
    );
    expect(t2, !t2.cards.some((c) => c.preview?.jobId), "Still a new job.");
    expect(t2, t2.cards.some((c) => /joe/i.test(c.preview?.clientName ?? "")), "Still for Joe.");
  },

  async approveAndInvoice(chat) {
    const t1 = await say(chat, "Patel approved the water heater quote, invoice it");
    const status = t1.cards.find((card) => /Mark Q-0001 approved/i.test(card.title));
    const invoice = t1.cards.find((card) => /Invoice Q-0001/i.test(card.title));
    expect(t1, Boolean(status), "Should make a 'Mark Q-0001 approved' card.");
    expect(t1, Boolean(invoice), "Should make an 'Invoice Q-0001' card.");
    await confirm(t1, chat, status, "approve");
    const result = await confirm(t1, chat, invoice, "invoice");
    if (result?.kind === "document") {
      const [doc] = await db.select().from(documents).where(eq(documents.id, result.documentId));
      expect(t1, doc?.sourceQuoteId === chat.seed.docs.q1 && doc?.subtotal === 1120, "The invoice should copy Q-0001 ($1,120 before tax).");
    }
  },

  async editDraft(chat) {
    const t1 = await say(chat, "add a $50 disposal fee to the bathroom quote");
    const add = cardWhere(t1, (preview) => preview.action === "change" && /Q-0002/.test(preview.title));
    expect(t1, Boolean(add?.preview?.canConfirm), `Should make a confirmable change card on Q-0002. ${add?.preview?.blockers.join("; ") ?? ""}`);
    await confirm(t1, chat, add, "add fee");
    const t2 = await say(chat, "and change the vanity to $475");
    const change = cardWhere(t2, (preview) => preview.action === "change" && /Q-0002/.test(preview.title));
    expect(t2, Boolean(change?.preview?.canConfirm), `Should make a confirmable change card on Q-0002. ${change?.preview?.blockers.join("; ") ?? ""}`);
    await confirm(t2, chat, change, "vanity price");
    const [doc] = await db.select().from(documents).where(eq(documents.id, chat.seed.docs.q2));
    expect(t2, doc?.subtotal === 525, `Q-0002 should be $525 before tax (vanity $475 + fee $50). It is $${doc?.subtotal}.`);
  },

  async priceMemory(chat) {
    const t1 = await say(chat, "what did I charge for a water heater last time?");
    expect(t1, mentions(t1, /780/), "Should say $780.");
    const t2 = await say(chat, "quote Chen the same water heater for the kitchen");
    const card = cardWhere(t2, (preview) => preview.action === "make_quote" && preview.lines.some((line) => line.unitPrice === 780));
    expect(t2, Boolean(card), "Should draft a quote with the $780 heater.");
    expect(t2, Boolean(card?.preview?.canConfirm), `That quote should be confirmable. ${card?.preview?.blockers.join("; ") ?? ""}`);
    expect(t2, card?.preview?.jobTitle === "Kitchen reno", `Should be on Kitchen reno, not ${card?.preview?.jobTitle}.`);
  },

  async logAndUndo(chat) {
    const t1 = await say(chat, "log 3 hours on the bathroom");
    const log = cardWhere(t1, (preview) => preview.action === "log_hours");
    expect(t1, log?.preview?.jobTitle === "new bathroom", `Should log on new bathroom, not ${log?.preview?.jobTitle}.`);
    expect(t1, Boolean(log?.preview?.canConfirm), "Should be confirmable at the labour rate.");
    await confirm(t1, chat, log, "log hours");
    const t2 = await say(chat, "undo that");
    const undo = t2.cards.find((card) => /^Undo/i.test(card.title));
    expect(t2, Boolean(undo?.preview?.canConfirm), `Should offer a confirmable undo. ${undo?.preview?.blockers.join("; ") ?? "no card"}`);
    await confirm(t2, chat, undo, "undo");
    const left = await db
      .select()
      .from(lineItems)
      .where(and(eq(lineItems.jobId, chat.seed.jobs.bath), isNull(lineItems.documentId), eq(lineItems.kind, "labour")));
    expect(t2, left.length === 0, "The 3 hours should be gone after undo.");
  },

  async unbilled(chat) {
    const t1 = await say(chat, "what unbilled work do I have?");
    expect(t1, mentions(t1, /Kitchen reno/i) && mentions(t1, /327/), "Should say Kitchen reno has $327 unbilled.");
    const t2 = await say(chat, "invoice it");
    const card = cardWhere(t2, (preview) => preview.action === "invoice_tracked");
    expect(t2, card?.preview?.jobTitle === "Kitchen reno", `Should invoice Kitchen reno's unbilled work. Got ${card?.title ?? "no card"}.`);
    const result = await confirm(t2, chat, card, "invoice unbilled");
    if (result?.kind === "document") {
      const [doc] = await db.select().from(documents).where(eq(documents.id, result.documentId));
      expect(t2, doc?.subtotal === 327, `The invoice should be $327 before tax. It is $${doc?.subtotal}.`);
    }
  },

  async ambiguous(chat) {
    const t1 = await say(chat, "add 2 hours of labour");
    const asked = t1.result.parts.some((part) => part.kind === "ask" && part.options.length >= 2);
    const blocked = t1.cards.some((card) => card.preview && !card.preview.canConfirm);
    expect(t1, asked || blocked || /which job/i.test(t1.text), "With three jobs and none named, it should ask which job.");
    expect(t1, !t1.cards.some((card) => card.preview?.canConfirm), "It must not pick a job on its own.");
    const t2 = await say(chat, "the kitchen one");
    const card = cardWhere(t2, (preview) => preview.action === "log_hours");
    expect(t2, card?.preview?.jobTitle === "Kitchen reno", `Should log on Kitchen reno. Got ${card?.preview?.jobTitle ?? "no card"}.`);
    expect(t2, Boolean(card?.preview?.lines.some((line) => line.quantity === 2)), "Should be 2 hours.");
  },

  async statusAndSettings(chat) {
    const t1 = await say(chat, "Chen paid INV-0001");
    const paid = t1.cards.find((card) => /Mark INV-0001 paid/i.test(card.title));
    expect(t1, Boolean(paid?.preview?.canConfirm), "Should make a confirmable 'Mark INV-0001 paid' card.");
    await confirm(t1, chat, paid, "paid");
    const [doc] = await db.select().from(documents).where(eq(documents.id, chat.seed.docs.inv1));
    expect(t1, doc?.status === "paid", "INV-0001 should be paid.");
    const t2 = await say(chat, "my labour rate is $95 now");
    const settings = cardWhere(t2, (preview) => Boolean(preview.changes?.some((row) => row.label === "Labour rate" && /85.*95/.test(row.value))));
    expect(t2, Boolean(settings?.preview?.canConfirm), "Should make a settings card: labour rate $85 → $95.");
  },

  async send(chat) {
    clearFakeEmails();
    const t1 = await say(chat, "email Patel the water heater quote");
    const send = t1.cards.find((card) => /Email Q-0001/i.test(card.title));
    expect(t1, Boolean(send?.preview?.canConfirm), `Should make a confirmable 'Email Q-0001' card. ${send?.preview?.blockers.join("; ") ?? "no card"}`);
    await confirm(t1, chat, send, "email");
    expect(t1, getFakeEmails().length === 1 && getFakeEmails()[0]?.to === "patel@example.test", "Exactly one email, to Patel.");
    const t2 = await say(chat, "remind Chen about the overdue invoice");
    const remind = t2.cards.find((card) => /Remind Chen about INV-0001/i.test(card.title));
    expect(t2, Boolean(remind?.preview?.canConfirm), `Should make a confirmable reminder for INV-0001. ${remind?.preview?.blockers.join("; ") ?? "no card"}`);
    await confirm(t2, chat, remind, "reminder");
    expect(t2, getFakeEmails().at(-1)?.subject.startsWith("Reminder:") === true, "The second email should be a reminder.");
  },

  async smallTalk(chat) {
    const t1 = await say(chat, "thanks!");
    expect(t1, t1.cards.length === 0, "Small talk should not make a card.");
  },

  async moveLines(chat) {
    const t1 = await say(chat, "that PEX on the kitchen job was actually for the bathroom");
    const move = cardWhere(t1, (preview) => Boolean(preview.action === "change" && /Move/i.test(preview.title) && preview.jobTitle === "new bathroom"));
    expect(t1, Boolean(move?.preview?.canConfirm), `Should make a confirmable move card to new bathroom. Got ${t1.cards.map((c) => c.title).join(" | ") || "no card"}.`);
    await confirm(t1, chat, move, "move");
    const [pex] = await db.select().from(lineItems).where(eq(lineItems.id, chat.seed.pex));
    expect(t1, pex?.jobId === chat.seed.jobs.bath, "The PEX line should now be on new bathroom.");
  },

  async chase(chat) {
    const t1 = await say(chat, "anything I need to chase?");
    expect(t1, mentions(t1, /INV-0001|Chen/i), "Should bring up Chen's overdue INV-0001.");
    soft(t1, t1.cards.length === 0, "A question should not make a card.");
  },

  // ---- Questions about the books ----

  async overdue(chat) {
    const t = await say(chat, "what's overdue?");
    expect(t, mentions(t, /INV-0001|Chen/i) && mentions(t, /576\.30/), "INV-0001, Chen, $576.30.");
    soft(t, t.cards.length === 0, "A question should not make a card.");
  },
  async patelQuote(chat) {
    const t = await say(chat, "how much is Patel's quote?");
    expect(t, mentions(t, /1,265\.60/), "Q-0001 is $1,265.60.");
  },
  async sentQuotes(chat) {
    const t = await say(chat, "which quotes have I sent?");
    expect(t, mentions(t, /Q-0001|water heater/i), "Q-0001 (water heater) is sent.");
    expect(t, !mentions(t, /Q-0002[^\n]*\bsent\b/i), "Q-0002 is a draft, not sent.");
  },
  async faucetPaid(chat) {
    const t = await say(chat, "did Chen pay for the faucet?");
    expect(t, mentions(t, /\bpaid\b|\byes\b/i) && mentions(t, /INV-0002|226/), "Yes: INV-0002, $226.00, paid.");
  },
  async kitchenSummary(chat) {
    const t = await say(chat, "what's going on with the kitchen job?");
    expect(t, mentions(t, /327/), "Kitchen reno has $327.00 unbilled.");
    expect(t, mentions(t, /INV-0001|576\.30|overdue/i), "INV-0001 is overdue.");
  },
  async paidThisMonth(chat) {
    const t = await say(chat, "how much have I been paid this month?");
    expect(t, mentions(t, /226/), "$226.00 (INV-0002).");
  },
  async patelEmail(chat) {
    const t = await say(chat, "what's Patel's email?");
    expect(t, mentions(t, /patel@example\.test/), "patel@example.test");
  },
  async listJobs(chat) {
    const t = await say(chat, "list my jobs");
    expect(t, mentions(t, /Kitchen reno/i) && mentions(t, /Water heater replacement/i) && mentions(t, /new bathroom/i), "All three jobs.");
  },
  async labourRate(chat) {
    const t = await say(chat, "what's my labour rate?");
    expect(t, mentions(t, /\$?85/), "$85/h.");
    soft(t, t.cards.length === 0, "A question should not make a card.");
  },
  async spentOnPex(chat) {
    const t = await say(chat, "what did I spend on PEX?");
    expect(t, mentions(t, /\$60/), "The PEX cost $60.00.");
  },

  // ---- Messy wording ----

  async voiceHours(chat) {
    const t = await say(chat, "uh yeah so add like two and a half hours to the bathroom job");
    const card = cardWhere(t, (preview) => preview.action === "log_hours");
    expect(t, card?.preview?.jobTitle === "new bathroom", `Log on new bathroom, not ${card?.preview?.jobTitle ?? "no card"}.`);
    expect(t, Boolean(card?.preview?.lines.some((line) => line.quantity === 2.5)), "2.5 hours.");
    expect(t, Boolean(card?.preview?.canConfirm), "Confirmable at the labour rate.");
  },
  async patelValve(chat) {
    const t = await say(chat, "quote for patel, new shutoff valve 45 bucks and an hour of labour");
    const card = cardWhere(t, (preview) => preview.action === "make_quote");
    expect(t, /patel/i.test(card?.preview?.clientName ?? ""), `For Patel, not ${card?.preview?.clientName ?? "no card"}.`);
    expect(t, Boolean(card?.preview?.lines.some((line) => line.unitPrice === 45)), "Valve at $45.");
    expect(t, Boolean(card?.preview?.lines.some((line) => line.kind === "labour" && line.quantity === 1)), "1 hour of labour.");
    expect(t, Boolean(card?.preview?.canConfirm), `Confirmable. ${card?.preview?.blockers.join("; ") ?? ""}`);
  },
  async screws(chat) {
    const t = await say(chat, "kitchen reno: 2 boxes of screws at $12 each");
    const card = cardWhere(t, (preview) => preview.action === "add_materials");
    expect(t, card?.preview?.jobTitle === "Kitchen reno", `On Kitchen reno, not ${card?.preview?.jobTitle ?? "no card"}.`);
    expect(t, Boolean(card?.preview?.lines.some((line) => line.quantity === 2 && line.unitPrice === 12)), "2 at $12.");
    expect(t, Boolean(card?.preview?.canConfirm), "Confirmable.");
  },
  async typoInvoice(chat) {
    const t = await say(chat, "bil chen for wat i logged on the kitchen");
    const card = cardWhere(t, (preview) => preview.action === "invoice_tracked");
    expect(t, card?.preview?.jobTitle === "Kitchen reno", `Invoice Kitchen reno's unbilled work. Got ${t.cards.map((c) => c.title).join(" | ") || "no card"}.`);
  },
  async twoThings(chat) {
    const t = await say(chat, "log 4 hours on the bathroom and the vanity cost me $380");
    const hours = cardWhere(t, (preview) => preview.action === "log_hours");
    expect(t, hours?.preview?.jobTitle === "new bathroom" && Boolean(hours?.preview?.lines.some((line) => line.quantity === 4)), "4 hours on new bathroom.");
    const vanity = cardWhere(t, (preview) => preview.lines.some((line) => /vanity/i.test(line.description)));
    soft(t, Boolean(vanity), "The vanity should be its own card.");
    if (vanity) {
      expect(t, Boolean(vanity.preview?.lines.some((line) => /vanity/i.test(line.description) && line.unitPrice === 456)), "Vanity cost $380 + 20% markup = $456.");
    }
  },

  // ---- Changes ----

  async sendNoEmail(chat) {
    const t = await say(chat, "mark the bathroom quote sent and email it to pippo");
    const status = t.cards.find((card) => /Mark Q-0002 sent/i.test(card.title));
    expect(t, Boolean(status?.preview?.canConfirm), "Mark Q-0002 sent (confirmable).");
    expect(t, !t.cards.some((card) => /Email/i.test(card.title) && card.preview?.canConfirm), "pippo has no email; the email card must not be confirmable.");
    soft(t, mentions(t, /no email|email address|doesn't have an email|has no email/i), "Should say pippo has no email.");
  },
  async lockedDue(chat) {
    const t = await say(chat, "push the due date on INV-0001 to Dec 15");
    noConfirmable(t, "INV-0001 is sent, so it can't be edited");
    soft(t, mentions(t, /sent|draft|can't|cannot|locked/i), "Should say why.");
  },
  async deleteDraft(chat) {
    const t = await say(chat, "delete the bathroom quote");
    const card = t.cards.find((c) => /Delete draft Q-0002/i.test(c.title));
    expect(t, Boolean(card?.preview?.canConfirm), "Delete draft Q-0002 (confirmable).");
    await confirm(t, chat, card, "delete");
    const left = await db.select().from(documents).where(eq(documents.id, chat.seed.docs.q2));
    expect(t, left.length === 0, "Q-0002 should be gone.");
  },
  async renameJob(chat) {
    const t = await say(chat, "rename the kitchen job to Chen kitchen reno");
    const card = cardWhere(t, (preview) => Boolean(preview.changes?.some((row) => row.label === "Title")));
    expect(t, Boolean(card?.preview?.canConfirm), "A confirmable rename card.");
    await confirm(t, chat, card, "rename");
    const [job] = await db.select().from(jobs).where(eq(jobs.id, chat.seed.jobs.kitchen));
    expect(t, /chen kitchen reno/i.test(job?.title ?? ""), `Renamed to "Chen kitchen reno", got "${job?.title}".`);
  },
  async clientPhone(chat) {
    const t = await say(chat, "Patel's new number is 416-555-0199");
    const card = cardWhere(t, (preview) => Boolean(preview.changes?.some((row) => row.label === "Phone")));
    expect(t, Boolean(card?.preview?.canConfirm), "A confirmable phone change for Patel.");
    await confirm(t, chat, card, "phone");
    const [row] = await db.select().from(clients).where(eq(clients.id, chat.seed.clients.patel));
    expect(t, row?.phone === "416-555-0199" && row?.email === "patel@example.test", "Phone updated, email kept.");
  },
  async markup(chat) {
    const t = await say(chat, "set my markup to 25%");
    const card = cardWhere(t, (preview) => Boolean(preview.changes?.some((row) => row.label === "Material markup" && /20.*25/.test(row.value))));
    expect(t, Boolean(card?.preview?.canConfirm), "Markup 20 % → 25 %.");
  },
  async declined(chat) {
    const t = await say(chat, "Patel declined the water heater quote");
    const card = t.cards.find((c) => /Mark Q-0001 declined/i.test(c.title));
    expect(t, Boolean(card?.preview?.canConfirm), "Mark Q-0001 declined (confirmable).");
  },
  async statedInvoice(chat) {
    const t = await say(chat, "invoice Patel $2000 for the water heater job");
    const card = cardWhere(t, (preview) => preview.action === "make_invoice");
    expect(t, card?.preview?.jobTitle === "Water heater replacement", `On Water heater replacement, not ${card?.preview?.jobTitle ?? "no card"}.`);
    expect(t, Boolean(card?.preview?.lines.some((line) => line.unitPrice === 2000)), "A $2,000 line.");
    expect(t, Boolean(card?.preview?.canConfirm), "Confirmable.");
  },
  async newClientQuote(chat) {
    const t = await say(chat, "new client Maria Lopez at 22 Oak St, quote a kitchen faucet swap: faucet $240 plus 2 hours");
    const card = cardWhere(t, (preview) => preview.action === "make_quote");
    expect(t, /maria/i.test(card?.preview?.clientName ?? "") && Boolean(card?.preview?.clientIsNew), "New client Maria Lopez.");
    expect(t, !card?.preview?.jobId, "A new job.");
    expect(t, Boolean(card?.preview?.lines.some((line) => line.unitPrice === 240)), "Faucet $240.");
    expect(t, Boolean(card?.preview?.lines.some((line) => line.kind === "labour" && line.quantity === 2)), "2 hours.");
    expect(t, Boolean(card?.preview?.canConfirm), `Confirmable. ${card?.preview?.blockers.join("; ") ?? ""}`);
  },
  async createJob(chat) {
    const t = await say(chat, "create a job for Chen: basement bathroom rough-in");
    const card = cardWhere(t, (preview) => preview.action === "create_job");
    expect(t, /chen/i.test(card?.preview?.clientName ?? "") && !card?.preview?.clientIsNew, "For existing client Chen.");
    expect(t, Boolean(card?.preview?.canConfirm), "Confirmable.");
  },

  // ---- Must refuse or hold back ----

  async noPrice(chat) {
    const t = await say(chat, "quote Chen for a new kitchen faucet");
    noConfirmable(t, "no price was given for the faucet");
  },
  async alreadyPaid(chat) {
    const t = await say(chat, "mark INV-0002 paid");
    noConfirmable(t, "INV-0002 is already paid");
  },
  async nothingUnbilled(chat) {
    const t = await say(chat, "invoice the unbilled work on the bathroom");
    expect(t, t.cards.length === 0, "The bathroom has no unbilled work.");
  },
  async nothingToUndo(chat) {
    const t = await say(chat, "undo that");
    noConfirmable(t, "nothing was confirmed");
  },
  async offTopic(chat) {
    const t = await say(chat, "what's the weather like today?");
    expect(t, t.cards.length === 0, "No card for an off-topic question.");
  },
  async hello(chat) {
    const t = await say(chat, "hey");
    expect(t, t.cards.length === 0, "No card for a greeting.");
  },

  // ---- Follow-ups ----

  async followApprove(chat) {
    const t1 = await say(chat, "show me Patel's quote");
    expect(t1, mentions(t1, /1,265\.60/), "Q-0001, $1,265.60.");
    const t2 = await say(chat, "approve it");
    const card = t2.cards.find((c) => /Mark Q-0001 approved/i.test(c.title));
    expect(t2, Boolean(card?.preview?.canConfirm), "Mark Q-0001 approved (confirmable).");
  },
  async unbilledFollow(chat) {
    const t1 = await say(chat, "how much unbilled on the kitchen?");
    expect(t1, mentions(t1, /327/), "$327.00.");
    const t2 = await say(chat, "put it on a new invoice");
    const card = cardWhere(t2, (preview) => preview.action === "invoice_tracked");
    expect(t2, card?.preview?.jobTitle === "Kitchen reno", `Invoice Kitchen reno's unbilled work. Got ${t2.cards.map((c) => c.title).join(" | ") || "no card"}.`);
  },
};

// ---- Run ----

async function main() {
  const wanted = process.argv.slice(2);
  const names = wanted.length ? wanted : Object.keys(CHATS);
  const report: {
    chat: string;
    turns: { say: string; ms: number; tools: Turn["tools"]; shown: string; problems: string[]; warnings: string[] }[];
    error?: string;
  }[] = [];
  let failures = 0;
  let warned = 0;
  for (const name of names) {
    const run = CHATS[name];
    if (!run) throw new Error(`Unknown chat: ${name}`);
    await resetDatabase();
    const chat: Chat = { seed: await seedBusiness(), planId: null, turns: [] };
    let error: string | undefined;
    try {
      await run(chat);
    } catch (caught) {
      error = caught instanceof Error ? caught.stack ?? caught.message : String(caught);
    }
    const turns = chat.turns.map((turn) => ({
      say: turn.say,
      ms: turn.ms,
      tools: turn.tools,
      shown: shown(turn).trim(),
      problems: turn.problems,
      warnings: turn.warnings,
    }));
    report.push({ chat: name, turns, error });
    const problems = turns.flatMap((turn) => turn.problems);
    const ok = !error && problems.length === 0;
    if (!ok) failures += 1;
    if (turns.some((turn) => turn.warnings.length)) warned += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}  (${turns.length} turns, ${turns.reduce((sum, turn) => sum + turn.ms, 0) / 1000} s)`);
    for (const turn of turns) {
      console.log(`   > ${turn.say}`);
      console.log(`     tools: ${turn.tools.map((tool) => `${tool.tool}${tool.ok ? "" : "!"}`).join(", ") || "(rules)"}`);
      console.log(`     ${turn.shown.replace(/\n/g, "\n     ").slice(0, 900)}`);
      for (const problem of turn.problems) console.log(`     ✗ ${problem}`);
      for (const warning of turn.warnings) console.log(`     ~ ${warning}`);
    }
    if (error) console.log(`   ✗ ${error.split("\n").slice(0, 3).join(" ")}`);
  }
  const out = process.env.EVAL_OUT ?? "plan-chats-eval.json";
  fs.writeFileSync(out, JSON.stringify({ model: process.env.PLAN_MODEL || process.env.EXTRACTION_MODEL, report }, null, 2));
  const times = report.flatMap((chat) => chat.turns.map((turn) => turn.ms)).sort((a, b) => a - b);
  const p90 = times[Math.min(times.length - 1, Math.floor(times.length * 0.9))] ?? 0;
  const mean = times.length ? times.reduce((sum, ms) => sum + ms, 0) / times.length : 0;
  console.log(
    `\n${names.length - failures}/${names.length} chats passed (${times.length} turns). ${warned} with style warnings. ` +
      `Turn time: mean ${(mean / 1000).toFixed(1)} s, p90 ${(p90 / 1000).toFixed(1)} s. Transcript: ${out}`,
  );
  await getTestSql().end();
  process.exit(failures ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
