/**
 * What the Plan agent can read. Every query is scoped by contractor_id; an id from another contractor
 * reads as not found. Results are data for the model, not sentences, and every count and money total
 * is computed here with lib/money.ts so the model only repeats numbers.
 */
import { and, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { parseReceiptExtraction } from "@/lib/ai/extraction-types";
import { captures, clients, documents, jobs, lineItems } from "@/lib/db/schema";
import { documentActions, isOverdue, type DocStatus, type DocType } from "@/lib/documents";
import { fuzzyMatchClient, fuzzyMatchJob } from "@/lib/line-items";
import { roundMoney, sumMoney } from "@/lib/money";
import { dateRangeMs, documentStatusFilter, localDate, localMidnightMs, periodStart, type DocumentStatusWord } from "@/lib/plan-lookup";
import { getActiveLinkToken } from "@/lib/services/document-links";
import { NotFoundError, type ServiceContext } from "@/lib/services/context";

/** Rows the model sees per call. The counts and totals always cover every match. */
export const READ_LIMIT = 20;
const SCAN_LIMIT = 500;

function capped<T>(rows: T[]) {
  return { rows: rows.slice(0, READ_LIMIT), more: Math.max(0, rows.length - READ_LIMIT) };
}

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const QUERY_STOPWORDS = new Set(["the", "a", "an", "job", "jobs", "for", "on", "at", "my", "of"]);

/** True when every meaningful word of the query appears in one of the fields. */
function matchesQuery(query: string | null | undefined, fields: (string | null | undefined)[]) {
  const words = normalize(query)
    .split(" ")
    .filter((word) => word && !QUERY_STOPWORDS.has(word));
  if (!words.length) return true;
  const haystack = ` ${fields.map(normalize).join(" ")} `;
  return words.every((word) => haystack.includes(word));
}

function dayOf(ms: number | null | undefined) {
  return ms ? localDate(ms) : null;
}

// ---- Jobs ----

export async function findJobs(
  ctx: ServiceContext,
  args: { query?: string | null; status?: "open" | "quoted" | "active" | "done" | "all" | null; client_id?: string | null; has_unbilled?: boolean | null },
) {
  const conditions = [eq(jobs.contractorId, ctx.contractorId)];
  const status = args.status ?? "all";
  if (status === "open") conditions.push(inArray(jobs.status, ["quoted", "active"]));
  else if (status !== "all") conditions.push(eq(jobs.status, status));
  if (args.client_id) conditions.push(eq(jobs.clientId, args.client_id));
  const rows = await ctx.db
    .select({ job: jobs, clientName: clients.name })
    .from(jobs)
    .leftJoin(clients, and(eq(clients.id, jobs.clientId), eq(clients.contractorId, ctx.contractorId)))
    .where(and(...conditions))
    .orderBy(desc(jobs.updatedAt))
    .limit(SCAN_LIMIT);

  let matched = rows.filter(({ job, clientName }) => matchesQuery(args.query, [job.title, clientName, job.siteAddress]));
  if (args.query && matched.length === 0) {
    // "the kitchen" for "Kitchen reno": fall back to the same fuzzy match the rest of Plan uses.
    const fuzzy = fuzzyMatchJob(args.query, rows.map(({ job }) => job));
    matched = fuzzy ? rows.filter(({ job }) => job.id === fuzzy.id) : [];
  }
  const ids = matched.map(({ job }) => job.id);
  const [unbilled, docs] = ids.length
    ? await Promise.all([
        ctx.db
          .select({ jobId: lineItems.jobId, total: sql<number>`coalesce(sum(${lineItems.lineTotal}), 0)`.mapWith(Number) })
          .from(lineItems)
          .where(
            and(
              eq(lineItems.contractorId, ctx.contractorId),
              inArray(lineItems.jobId, ids),
              isNull(lineItems.documentId),
              isNull(lineItems.billedDocumentId),
            ),
          )
          .groupBy(lineItems.jobId),
        ctx.db
          .select({ jobId: documents.jobId, type: documents.type, status: documents.status })
          .from(documents)
          .where(and(eq(documents.contractorId, ctx.contractorId), inArray(documents.jobId, ids))),
      ])
    : [[], []];
  const unbilledByJob = new Map(unbilled.map((row) => [row.jobId, roundMoney(row.total)]));
  const list = matched
    .map(({ job, clientName }) => {
      const jobDocs = docs.filter((doc) => doc.jobId === job.id);
      return {
        id: job.id,
        title: job.title,
        client: clientName,
        client_id: job.clientId,
        status: job.status,
        site: job.siteAddress || null,
        unbilled_total: unbilledByJob.get(job.id) ?? 0,
        open_quotes: jobDocs.filter((doc) => doc.type === "quote" && (doc.status === "draft" || doc.status === "sent")).length,
        unpaid_invoices: jobDocs.filter((doc) => doc.type === "invoice" && doc.status === "sent").length,
        updated: dayOf(job.updatedAt),
      };
    })
    .filter((job) => !args.has_unbilled || job.unbilled_total > 0);
  const { rows: shown, more } = capped(list);
  return {
    count: list.length,
    unbilled_total: sumMoney(list.map((job) => job.unbilled_total)),
    jobs: shown,
    more,
  };
}

export async function getJobDetail(ctx: ServiceContext, jobId: string) {
  const [row] = await ctx.db
    .select({ job: jobs, client: clients })
    .from(jobs)
    .leftJoin(clients, and(eq(clients.id, jobs.clientId), eq(clients.contractorId, ctx.contractorId)))
    .where(and(eq(jobs.id, jobId), eq(jobs.contractorId, ctx.contractorId)))
    .limit(1);
  if (!row) throw new NotFoundError("Job not found.");
  const [lines, docs] = await Promise.all([
    ctx.db
      .select()
      .from(lineItems)
      .where(and(eq(lineItems.contractorId, ctx.contractorId), eq(lineItems.jobId, jobId), isNull(lineItems.documentId)))
      .orderBy(lineItems.sortOrder, lineItems.createdAt),
    ctx.db
      .select()
      .from(documents)
      .where(and(eq(documents.contractorId, ctx.contractorId), eq(documents.jobId, jobId)))
      .orderBy(desc(documents.updatedAt)),
  ]);
  const unbilled = lines.filter((line) => !line.billedDocumentId);
  const costed = lines.filter((line) => line.unitCost != null);
  const invoiced = docs.filter((doc) => doc.type === "invoice" && doc.status !== "draft");
  return {
    job: {
      id: row.job.id,
      title: row.job.title,
      status: row.job.status,
      site: row.job.siteAddress || null,
      notes: row.job.notes || null,
      client: row.client ? { id: row.client.id, name: row.client.name, email: row.client.email || null, phone: row.client.phone || null } : null,
    },
    unbilled_lines: unbilled.slice(0, READ_LIMIT).map((line) => ({
      id: line.id,
      kind: line.kind,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unit_price: line.unitPrice,
      unit_cost: line.unitCost,
      line_total: line.lineTotal,
      added: dayOf(line.createdAt),
    })),
    unbilled_count: unbilled.length,
    unbilled_total: sumMoney(unbilled.map((line) => line.lineTotal)),
    documents: docs.slice(0, READ_LIMIT).map((doc) => ({
      id: doc.id,
      number: doc.number,
      type: doc.type,
      status: doc.status,
      total: doc.total,
    })),
    /** What the work cost the contractor (lines with a recorded cost) against what was invoiced before tax. */
    money: {
      recorded_cost: sumMoney(costed.map((line) => roundMoney(line.quantity * (line.unitCost ?? 0)))),
      invoiced_before_tax: sumMoney(invoiced.map((doc) => doc.subtotal)),
      paid: sumMoney(invoiced.filter((doc) => doc.status === "paid").map((doc) => doc.total)),
    },
  };
}

// ---- Documents ----

export async function findDocuments(
  ctx: ServiceContext,
  args: {
    type?: "quote" | "invoice" | null;
    status?: DocumentStatusWord | null;
    job_id?: string | null;
    client_id?: string | null;
    number?: string | null;
    /** Words from the client's name, the job title or the number: "Patel water heater". */
    query?: string | null;
    since?: string | null;
    until?: string | null;
  },
  nowMs = Date.now(),
) {
  const today = localDate(nowMs);
  const filter = documentStatusFilter(args.type, args.status);
  const conditions = [eq(documents.contractorId, ctx.contractorId)];
  if (filter.type) conditions.push(eq(documents.type, filter.type));
  if (filter.statuses) conditions.push(inArray(documents.status, filter.statuses));
  if (args.job_id) conditions.push(eq(documents.jobId, args.job_id));
  if (args.client_id) conditions.push(eq(documents.clientId, args.client_id));
  if (args.number) conditions.push(eq(sql`upper(${documents.number})`, args.number.trim().toUpperCase()));
  const range = dateRangeMs(args.since, args.until);
  const dated = sql`coalesce(${documents.sentAt}, ${documents.createdAt})`;
  if (range.from != null) conditions.push(gte(dated, range.from));
  if (range.to != null) conditions.push(lt(dated, range.to));

  const rows = await ctx.db
    .select({ document: documents, clientName: clients.name, jobTitle: jobs.title })
    .from(documents)
    .leftJoin(clients, and(eq(clients.id, documents.clientId), eq(clients.contractorId, ctx.contractorId)))
    .leftJoin(jobs, and(eq(jobs.id, documents.jobId), eq(jobs.contractorId, ctx.contractorId)))
    .where(and(...conditions))
    .orderBy(desc(documents.updatedAt))
    .limit(SCAN_LIMIT);

  const list = rows
    .map(({ document: doc, clientName, jobTitle }) => {
      const overdue = isOverdue({ type: doc.type as DocType, status: doc.status as DocStatus, dueDate: doc.dueDate }, today);
      return {
        id: doc.id,
        number: doc.number,
        type: doc.type,
        status: doc.status,
        overdue,
        job: jobTitle,
        job_id: doc.jobId,
        client: clientName,
        client_id: doc.clientId,
        total: doc.total,
        sent: dayOf(doc.sentAt),
        due: doc.type === "invoice" ? doc.dueDate : null,
        valid_until: doc.type === "quote" ? doc.validUntil : null,
      };
    })
    .filter((doc) => !filter.overdueOnly || doc.overdue);
  // "The vanity quote": a query may name something on the document, not just its client or job.
  const lineWords = new Map<string, string>();
  if (args.query && list.length) {
    const lines = await ctx.db
      .select({ documentId: lineItems.documentId, description: lineItems.description })
      .from(lineItems)
      .where(and(eq(lineItems.contractorId, ctx.contractorId), inArray(lineItems.documentId, list.map((doc) => doc.id))));
    for (const line of lines) {
      if (line.documentId) lineWords.set(line.documentId, `${lineWords.get(line.documentId) ?? ""} ${line.description}`);
    }
  }
  const matched = list.filter((doc) => matchesQuery(args.query, [doc.number, doc.client, doc.job, lineWords.get(doc.id)]));

  const byStatus: Record<string, number> = {};
  for (const doc of matched) byStatus[doc.status] = (byStatus[doc.status] ?? 0) + 1;
  const { rows: shown, more } = capped(matched);
  return {
    today,
    count: matched.length,
    count_by_status: byStatus,
    overdue_count: matched.filter((doc) => doc.overdue).length,
    total: sumMoney(matched.map((doc) => doc.total)),
    documents: shown,
    more,
  };
}

export async function getDocumentDetail(ctx: ServiceContext, args: { document_id?: string | null; number?: string | null }, nowMs = Date.now()) {
  const conditions = [eq(documents.contractorId, ctx.contractorId)];
  if (args.document_id) conditions.push(eq(documents.id, args.document_id));
  else if (args.number) conditions.push(eq(sql`upper(${documents.number})`, args.number.trim().toUpperCase()));
  else throw new NotFoundError("Document not found.");
  const [row] = await ctx.db
    .select({ document: documents, client: clients, jobTitle: jobs.title })
    .from(documents)
    .leftJoin(clients, and(eq(clients.id, documents.clientId), eq(clients.contractorId, ctx.contractorId)))
    .leftJoin(jobs, and(eq(jobs.id, documents.jobId), eq(jobs.contractorId, ctx.contractorId)))
    .where(and(...conditions))
    .limit(1);
  if (!row) throw new NotFoundError("Document not found.");
  const doc = row.document;
  const [lines, unbilled, token] = await Promise.all([
    ctx.db
      .select()
      .from(lineItems)
      .where(and(eq(lineItems.contractorId, ctx.contractorId), eq(lineItems.documentId, doc.id)))
      .orderBy(lineItems.sortOrder),
    ctx.db
      .select({ id: lineItems.id })
      .from(lineItems)
      .where(
        and(
          eq(lineItems.contractorId, ctx.contractorId),
          eq(lineItems.jobId, doc.jobId),
          isNull(lineItems.documentId),
          isNull(lineItems.billedDocumentId),
        ),
      ),
    getActiveLinkToken(ctx, doc.id),
  ]);
  const type = doc.type as DocType;
  const status = doc.status as DocStatus;
  return {
    id: doc.id,
    number: doc.number,
    type,
    status,
    editable: status === "draft",
    overdue: isOverdue({ type, status, dueDate: doc.dueDate }, localDate(nowMs)),
    job: row.jobTitle,
    job_id: doc.jobId,
    client: row.client ? { id: row.client.id, name: row.client.name, email: row.client.email || null } : null,
    notes: doc.notes || null,
    due: type === "invoice" ? doc.dueDate : null,
    valid_until: type === "quote" ? doc.validUntil : null,
    sent: dayOf(doc.sentAt),
    lines: lines.map((line) => ({
      id: line.id,
      kind: line.kind,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unit_price: line.unitPrice,
      line_total: line.lineTotal,
    })),
    subtotal: doc.subtotal,
    tax: doc.tax,
    total: doc.total,
    share_link_active: Boolean(token),
    job_unbilled_lines: unbilled.length,
    next_actions: documentActions({ type, status, unbilledCount: unbilled.length, hasClientEmail: Boolean(row.client?.email) }),
  };
}

// ---- Clients ----

export async function findClients(ctx: ServiceContext, args: { query?: string | null }) {
  const rows = await ctx.db
    .select()
    .from(clients)
    .where(eq(clients.contractorId, ctx.contractorId))
    .orderBy(desc(clients.createdAt))
    .limit(SCAN_LIMIT);
  let matched = rows.filter((client) => matchesQuery(args.query, [client.name, client.email, client.phone, client.billingAddress]));
  if (args.query && matched.length === 0) {
    const fuzzy = fuzzyMatchClient(args.query, rows);
    matched = fuzzy ? rows.filter((client) => client.id === fuzzy.id) : [];
  }
  const ids = matched.map((client) => client.id);
  const openJobs = ids.length
    ? await ctx.db
        .select({ clientId: jobs.clientId, count: sql<number>`count(*)`.mapWith(Number) })
        .from(jobs)
        .where(and(eq(jobs.contractorId, ctx.contractorId), inArray(jobs.clientId, ids), inArray(jobs.status, ["quoted", "active"])))
        .groupBy(jobs.clientId)
    : [];
  const openByClient = new Map(openJobs.map((row) => [row.clientId, row.count]));
  const { rows: shown, more } = capped(matched);
  return {
    count: matched.length,
    clients: shown.map((client) => ({
      id: client.id,
      name: client.name,
      email: client.email || null,
      phone: client.phone || null,
      address: client.billingAddress || null,
      open_jobs: openByClient.get(client.id) ?? 0,
    })),
    more,
  };
}

// ---- Line history ----

export type LineSource = "quoted" | "invoiced" | "tracked" | "receipt";

export async function searchLines(
  ctx: ServiceContext,
  args: {
    query?: string | null;
    kind?: "labour" | "material" | "other" | null;
    job_id?: string | null;
    source?: LineSource | null;
    since?: string | null;
    until?: string | null;
  },
) {
  const conditions = [eq(lineItems.contractorId, ctx.contractorId)];
  if (args.kind) conditions.push(eq(lineItems.kind, args.kind));
  if (args.job_id) conditions.push(eq(lineItems.jobId, args.job_id));
  const range = dateRangeMs(args.since, args.until);
  if (range.from != null) conditions.push(gte(lineItems.createdAt, range.from));
  if (range.to != null) conditions.push(lt(lineItems.createdAt, range.to));
  const rows = await ctx.db
    .select({
      line: lineItems,
      docType: documents.type,
      docNumber: documents.number,
      jobTitle: jobs.title,
      captureType: captures.type,
      captureExtraction: captures.extraction,
    })
    .from(lineItems)
    .leftJoin(documents, and(eq(documents.id, lineItems.documentId), eq(documents.contractorId, ctx.contractorId)))
    .leftJoin(jobs, and(eq(jobs.id, lineItems.jobId), eq(jobs.contractorId, ctx.contractorId)))
    .leftJoin(captures, and(eq(captures.id, lineItems.captureId), eq(captures.contractorId, ctx.contractorId)))
    .where(and(...conditions))
    .orderBy(desc(lineItems.createdAt))
    .limit(SCAN_LIMIT);

  const list = rows
    .map(({ line, docType, docNumber, jobTitle, captureType, captureExtraction }) => {
      const source: LineSource = docType === "quote" ? "quoted" : docType === "invoice" ? "invoiced" : captureType === "receipt" ? "receipt" : "tracked";
      const vendor = source === "receipt" ? (parseReceiptExtraction(captureExtraction)?.vendor ?? null) : null;
      return {
        id: line.id,
        description: line.description,
        kind: line.kind,
        quantity: line.quantity,
        unit: line.unit,
        unit_cost: line.unitCost,
        unit_price: line.unitPrice,
        line_total: line.lineTotal,
        job: jobTitle,
        job_id: line.jobId,
        source,
        reference: docNumber ?? (vendor ? `receipt from ${vendor}` : source === "receipt" ? "receipt" : "tracked on the job"),
        vendor,
        date: dayOf(line.createdAt),
      };
    })
    .filter((line) => !args.source || line.source === args.source)
    .filter((line) => matchesQuery(args.query, [line.description, line.vendor]));

  const prices = list.map((line) => line.unit_price);
  const { rows: shown, more } = capped(list);
  return {
    count: list.length,
    last_price: list[0] ? { unit_price: list[0].unit_price, reference: list[0].reference, date: list[0].date } : null,
    lowest_price: prices.length ? Math.min(...prices) : null,
    highest_price: prices.length ? Math.max(...prices) : null,
    total_cost: sumMoney(list.filter((line) => line.unit_cost != null).map((line) => roundMoney(line.quantity * (line.unit_cost ?? 0)))),
    total_sell: sumMoney(list.map((line) => line.line_total)),
    lines: shown,
    more,
  };
}

/** The line a price is copied from, scoped by contractor_id. Used to check a `price_source`. */
export async function priceSourceLine(ctx: ServiceContext, lineId: string) {
  const [row] = await ctx.db
    .select({ line: lineItems, docNumber: documents.number, captureType: captures.type, captureExtraction: captures.extraction })
    .from(lineItems)
    .leftJoin(documents, and(eq(documents.id, lineItems.documentId), eq(documents.contractorId, ctx.contractorId)))
    .leftJoin(captures, and(eq(captures.id, lineItems.captureId), eq(captures.contractorId, ctx.contractorId)))
    .where(and(eq(lineItems.id, lineId), eq(lineItems.contractorId, ctx.contractorId)))
    .limit(1);
  if (!row) return null;
  const vendor = row.captureType === "receipt" ? parseReceiptExtraction(row.captureExtraction)?.vendor : null;
  const where = row.docNumber ?? (vendor ? `a ${vendor} receipt` : "a tracked line");
  return { unitPrice: row.line.unitPrice, unitCost: row.line.unitCost, note: `From ${where}, ${dayOf(row.line.createdAt)}` };
}

// ---- Snapshot ----

export async function businessSnapshot(ctx: ServiceContext, args: { period?: "today" | "week" | "month" | null }, nowMs = Date.now()) {
  const today = localDate(nowMs);
  const period = args.period ?? "month";
  const periodFrom = localMidnightMs(periodStart(period, today)) ?? 0;
  const weekAgo = nowMs - 7 * 24 * 60 * 60 * 1000;

  const [docs, unbilledRows, waitingCards] = await Promise.all([
    ctx.db
      .select({ document: documents, clientName: clients.name })
      .from(documents)
      .leftJoin(clients, and(eq(clients.id, documents.clientId), eq(clients.contractorId, ctx.contractorId)))
      .where(eq(documents.contractorId, ctx.contractorId))
      .orderBy(desc(documents.updatedAt))
      .limit(SCAN_LIMIT),
    ctx.db
      .select({ jobId: lineItems.jobId, lineTotal: lineItems.lineTotal })
      .from(lineItems)
      .where(and(eq(lineItems.contractorId, ctx.contractorId), isNull(lineItems.documentId), isNull(lineItems.billedDocumentId))),
    ctx.db
      .select({ type: captures.type })
      .from(captures)
      .where(and(eq(captures.contractorId, ctx.contractorId), eq(captures.status, "needs_review"))),
  ]);

  const view = docs.map(({ document: doc, clientName }) => ({
    doc,
    clientName,
    overdue: isOverdue({ type: doc.type as DocType, status: doc.status as DocStatus, dueDate: doc.dueDate }, today),
  }));
  const unpaid = view.filter(({ doc }) => doc.type === "invoice" && doc.status === "sent");
  const overdue = unpaid.filter((row) => row.overdue);
  const waiting = view.filter(({ doc }) => doc.type === "quote" && doc.status === "sent");
  const staleQuotes = waiting.filter(({ doc }) => (doc.sentAt ?? doc.createdAt) < weekAgo);
  const drafts = view.filter(({ doc }) => doc.status === "draft");
  const paid = view.filter(({ doc }) => doc.type === "invoice" && doc.status === "paid" && (doc.closedAt ?? 0) >= periodFrom);
  const brief = ({ doc, clientName }: (typeof view)[number]) => ({
    id: doc.id,
    number: doc.number,
    client: clientName,
    total: doc.total,
    due: doc.dueDate,
    sent: dayOf(doc.sentAt),
  });

  return {
    today,
    period,
    owed: { count: unpaid.length, total: sumMoney(unpaid.map(({ doc }) => doc.total)) },
    overdue: { count: overdue.length, total: sumMoney(overdue.map(({ doc }) => doc.total)), invoices: overdue.slice(0, 10).map(brief) },
    quotes_waiting: { count: waiting.length, total: sumMoney(waiting.map(({ doc }) => doc.total)) },
    unbilled: { jobs: new Set(unbilledRows.map((row) => row.jobId)).size, total: sumMoney(unbilledRows.map((row) => row.lineTotal)) },
    paid_this_period: { count: paid.length, total: sumMoney(paid.map(({ doc }) => doc.total)) },
    to_do: {
      cards_waiting_for_confirm: waitingCards.filter((row) => row.type !== "receipt").length,
      receipts_to_review: waitingCards.filter((row) => row.type === "receipt").length,
      unsent_drafts: drafts.slice(0, 10).map(brief),
      unsent_draft_count: drafts.length,
      overdue_invoices: overdue.slice(0, 10).map(brief),
      quotes_waiting_over_7_days: staleQuotes.slice(0, 10).map(brief),
    },
  };
}

/**
 * A past line of the contractor's for the same item at exactly this price. A price the model copied from
 * their records without citing it is still theirs, so the card can say where it came from instead of
 * calling it unsaid. Null when nothing matches.
 */
export async function recordedPriceNote(ctx: ServiceContext, description: string, unitPrice: number) {
  const rows = await ctx.db
    .select({ id: lineItems.id })
    .from(lineItems)
    .where(
      and(
        eq(lineItems.contractorId, ctx.contractorId),
        gte(lineItems.unitPrice, unitPrice - 0.005),
        lt(lineItems.unitPrice, unitPrice + 0.005),
      ),
    )
    .orderBy(desc(lineItems.createdAt))
    .limit(50);
  if (!rows.length) return null;
  const described = await ctx.db
    .select({ id: lineItems.id, title: lineItems.description })
    .from(lineItems)
    .where(and(eq(lineItems.contractorId, ctx.contractorId), inArray(lineItems.id, rows.map((row) => row.id))));
  const match = fuzzyMatchJob(description, described);
  if (!match) return null;
  return (await priceSourceLine(ctx, match.id))?.note ?? null;
}
