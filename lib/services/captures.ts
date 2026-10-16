import { and, eq, isNull, max } from "drizzle-orm";
import {
  defaultDueDate,
  defaultValidUntil,
  documentNumber,
  type DocType,
} from "@/lib/documents";
import { captures, clients, contractors, documents, jobs, lineItems } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { toLineRow, validateLine, type LineInput } from "@/lib/line-items";
import { ConflictError, NotFoundError, ValidationError, type ServiceContext } from "@/lib/services/context";
import {
  lockContractorForNumbering,
  recomputeDocumentTotals,
  requireJob,
  touchJob,
} from "@/lib/services/internal";

type Tx = Parameters<Parameters<ServiceContext["db"]["transaction"]>[0]>[0];

export type ConfirmLineInput = {
  kind: "labour" | "material" | "other";
  description: string;
  quantity: number;
  unit: string;
  unitCost?: number | null;
  unitPrice: number;
  jobId?: string;
};

export type ConfirmCaptureInput = {
  captureId: string;
  createAs: "quote" | "invoice" | "log";
  client?: { id: string } | { name: string; email?: string; phone?: string; billingAddress?: string };
  job?: { id: string } | { title: string; siteAddress?: string };
  notes?: string;
  lines: ConfirmLineInput[];
};

export type ConfirmCaptureResult =
  | { kind: "document"; documentId: string }
  | { kind: "log"; jobIds: string[] };

function validateConfirmLines(lines: ConfirmLineInput[]) {
  if (!lines.length) throw new ValidationError("At least one line is required.");
  for (const line of lines) {
    const errors = validateLine({ ...line, unitPrice: line.unitPrice });
    if (errors.length) throw new ValidationError(errors[0]!);
  }
}

async function findExistingConfirmResult(
  db: ServiceContext["db"],
  contractorId: string,
  captureId: string,
): Promise<ConfirmCaptureResult | null> {
  const rows = await db
    .select({ documentId: lineItems.documentId, jobId: lineItems.jobId })
    .from(lineItems)
    .where(and(eq(lineItems.captureId, captureId), eq(lineItems.contractorId, contractorId)));
  if (!rows.length) return null;
  const documentId = rows.find((row) => row.documentId)?.documentId;
  if (documentId) return { kind: "document", documentId };
  const jobIds = [...new Set(rows.map((row) => row.jobId))];
  return { kind: "log", jobIds };
}

async function resolveClientId(tx: Tx, ctx: ServiceContext, client: ConfirmCaptureInput["client"]): Promise<string> {
  if (!client) throw new ValidationError("Client is required.");
  if ("id" in client) {
    const [owned] = await tx
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, client.id), eq(clients.contractorId, ctx.contractorId)))
      .limit(1);
    if (!owned) throw new NotFoundError("Client not found.");
    return owned.id;
  }
  const name = client.name.trim();
  if (!name) throw new ValidationError("Client name is required.");
  const clientId = newId();
  await tx.insert(clients).values({
    id: clientId,
    contractorId: ctx.contractorId,
    name,
    email: client.email?.trim() ?? "",
    phone: client.phone?.trim() ?? "",
    billingAddress: client.billingAddress?.trim() ?? "",
    createdAt: Date.now(),
  });
  return clientId;
}

async function resolveJobId(
  tx: Tx,
  ctx: ServiceContext,
  input: { clientId: string; job: NonNullable<ConfirmCaptureInput["job"]>; createAs: ConfirmCaptureInput["createAs"] },
): Promise<string> {
  if ("id" in input.job) {
    const job = await requireJob(tx, ctx.contractorId, input.job.id);
    if (job.clientId !== input.clientId) throw new ValidationError("Job does not belong to the selected client.");
    return job.id;
  }
  const title = input.job.title.trim();
  if (!title) throw new ValidationError("Job title is required.");
  const jobId = newId();
  const now = Date.now();
  const status = input.createAs === "quote" ? "quoted" : "active";
  await tx.insert(jobs).values({
    id: jobId,
    contractorId: ctx.contractorId,
    clientId: input.clientId,
    title,
    status,
    siteAddress: input.job.siteAddress?.trim() ?? "",
    notes: "",
    createdAt: now,
    updatedAt: now,
  });
  return jobId;
}

async function insertDocumentWithLines(
  tx: Tx,
  ctx: ServiceContext,
  input: {
    jobId: string;
    type: DocType;
    notes: string;
    captureId: string;
    lines: ConfirmLineInput[];
  },
) {
  const job = await requireJob(tx, ctx.contractorId, input.jobId);
  const now = Date.now();
  await lockContractorForNumbering(tx, ctx.contractorId);
  const [contractor] = await tx.select().from(contractors).where(eq(contractors.id, ctx.contractorId)).limit(1);
  if (!contractor) throw new NotFoundError("Contractor not found.");
  const isQuote = input.type === "quote";
  const current = isQuote ? contractor.nextQuoteNumber : contractor.nextInvoiceNumber;
  const number = documentNumber(input.type, current);
  await tx
    .update(contractors)
    .set(isQuote ? { nextQuoteNumber: current + 1 } : { nextInvoiceNumber: current + 1 })
    .where(eq(contractors.id, ctx.contractorId));
  const documentId = newId();
  const date = new Date(now);
  await tx.insert(documents).values({
    id: documentId,
    contractorId: ctx.contractorId,
    clientId: job.clientId,
    jobId: job.id,
    type: input.type,
    number,
    status: "draft",
    notes: input.notes.trim(),
    validUntil: isQuote ? defaultValidUntil(date) : null,
    dueDate: isQuote ? null : defaultDueDate(date),
    sourceQuoteId: null,
    subtotal: 0,
    tax: 0,
    total: 0,
    sentAt: null,
    closedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  for (let index = 0; index < input.lines.length; index += 1) {
    const line = input.lines[index]!;
    const row = toLineRow(line as LineInput);
    await tx.insert(lineItems).values({
      id: newId(),
      contractorId: ctx.contractorId,
      jobId: input.jobId,
      documentId,
      billedDocumentId: null,
      captureId: input.captureId,
      sortOrder: index,
      kind: line.kind,
      description: row.description,
      quantity: row.quantity,
      unit: row.unit,
      unitCost: line.unitCost ?? null,
      unitPrice: row.unitPrice,
      lineTotal: row.lineTotal,
      createdAt: now,
    });
  }
  await recomputeDocumentTotals(tx, ctx.contractorId, documentId);
  await touchJob(tx, ctx.contractorId, input.jobId);
  return documentId;
}

async function insertTrackedLines(
  tx: Tx,
  ctx: ServiceContext,
  input: { captureId: string; lines: ConfirmLineInput[] },
) {
  const now = Date.now();
  const jobIds = new Set<string>();
  for (const line of input.lines) {
    const jobId = line.jobId;
    if (!jobId) throw new ValidationError("Every line needs a job.");
    await requireJob(tx, ctx.contractorId, jobId);
    jobIds.add(jobId);
    const row = toLineRow(line as LineInput);
    const [maxRow] = await tx
      .select({ value: max(lineItems.sortOrder) })
      .from(lineItems)
      .where(and(eq(lineItems.jobId, jobId), eq(lineItems.contractorId, ctx.contractorId), isNull(lineItems.documentId)));
    const sortOrder = (maxRow?.value ?? -1) + 1;
    await tx.insert(lineItems).values({
      id: newId(),
      contractorId: ctx.contractorId,
      jobId,
      documentId: null,
      billedDocumentId: null,
      captureId: input.captureId,
      sortOrder,
      kind: line.kind,
      description: row.description,
      quantity: row.quantity,
      unit: row.unit,
      unitCost: line.unitCost ?? null,
      unitPrice: row.unitPrice,
      lineTotal: row.lineTotal,
      createdAt: now,
    });
    await touchJob(tx, ctx.contractorId, jobId);
  }
  return [...jobIds];
}

export async function confirmCapture(ctx: ServiceContext, input: ConfirmCaptureInput): Promise<ConfirmCaptureResult> {
  validateConfirmLines(input.lines);
  const [capture] = await ctx.db
    .select()
    .from(captures)
    .where(and(eq(captures.id, input.captureId), eq(captures.contractorId, ctx.contractorId)))
    .limit(1);
  if (!capture) throw new NotFoundError("Capture not found.");
  if (capture.status === "confirmed") {
    const existing = await findExistingConfirmResult(ctx.db, ctx.contractorId, capture.id);
    if (existing) return existing;
    throw new ConflictError("Capture is already confirmed.");
  }
  if (capture.status !== "needs_review") throw new ConflictError("Capture cannot be confirmed.");

  const isReceipt = capture.type === "receipt";
  if (isReceipt && input.createAs !== "log") throw new ValidationError("Receipts can only be added to jobs.");

  return ctx.db.transaction(async (tx) => {
    if (isReceipt) {
      const jobIds = await insertTrackedLines(tx, ctx, { captureId: capture.id, lines: input.lines });
      await tx
        .update(captures)
        .set({ status: "confirmed", confirmedAt: Date.now() })
        .where(and(eq(captures.id, capture.id), eq(captures.contractorId, ctx.contractorId)));
      return { kind: "log", jobIds };
    }

    if (!input.client || !input.job) throw new ValidationError("Client and job are required.");
    const clientId = await resolveClientId(tx, ctx, input.client);
    const jobId = await resolveJobId(tx, ctx, { clientId, job: input.job, createAs: input.createAs });
    const lines = input.lines.map((line) => ({ ...line, jobId }));

    if (input.createAs === "log") {
      const jobIds = await insertTrackedLines(tx, ctx, { captureId: capture.id, lines });
      await tx
        .update(captures)
        .set({ status: "confirmed", confirmedAt: Date.now() })
        .where(and(eq(captures.id, capture.id), eq(captures.contractorId, ctx.contractorId)));
      return { kind: "log", jobIds };
    }

    const documentId = await insertDocumentWithLines(tx, ctx, {
      jobId,
      type: input.createAs,
      notes: input.notes ?? "",
      captureId: capture.id,
      lines,
    });
    await tx
      .update(captures)
      .set({ status: "confirmed", confirmedAt: Date.now() })
      .where(and(eq(captures.id, capture.id), eq(captures.contractorId, ctx.contractorId)));
    return { kind: "document", documentId };
  });
}

export async function discardCapture(ctx: ServiceContext, captureId: string) {
  const [capture] = await ctx.db
    .select()
    .from(captures)
    .where(and(eq(captures.id, captureId), eq(captures.contractorId, ctx.contractorId)))
    .limit(1);
  if (!capture) throw new NotFoundError("Capture not found.");
  if (capture.status === "confirmed") throw new ConflictError("Confirmed captures cannot be discarded.");
  if (capture.status === "discarded") return;
  await ctx.db
    .update(captures)
    .set({ status: "discarded" })
    .where(and(eq(captures.id, captureId), eq(captures.contractorId, ctx.contractorId)));
}
