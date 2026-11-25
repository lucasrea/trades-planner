/**
 * Change cards: Plan proposals that change existing paperwork. The preview reads what is there now and
 * says what will change; the confirm re-checks it and calls the existing service. Nothing here writes
 * until the contractor confirms, and every read is scoped by contractor_id.
 */
import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { parseDescribeExtraction } from "@/lib/ai/extraction-types";
import { captures, clients, contractors, documents, jobs, lineItems } from "@/lib/db/schema";
import { canTransition, isLocked, type DocStatus, type DocType } from "@/lib/documents";
import { isEmailProviderConfigured, type EmailMessage } from "@/lib/email";
import { cad, documentTotals, roundMoney, type DraftLine } from "@/lib/money";
import { changeHref, parsePlanChange, STATUS_VERBS, type ChangeLine, type PlanChange } from "@/lib/plan-changes";
import { localDate } from "@/lib/plan-lookup";
import type { PlanPreview, PlanPreviewLine } from "@/lib/plan-proposal";
import { priceAppearsInTranscript, UNSAID_PRICE } from "@/lib/plan-stated-price";
import { saveClient } from "@/lib/services/clients";
import { ConflictError, NotFoundError, ValidationError, type ServiceContext } from "@/lib/services/context";
import { sendDocumentEmailToClient } from "@/lib/services/document-email";
import {
  addTrackedLinesToInvoice,
  createInvoiceFromQuote,
  deleteDraftDocument,
  saveDocumentMeta,
  setDocumentStatus,
} from "@/lib/services/documents";
import { setJobStatus, updateJob, type JobStatus } from "@/lib/services/jobs";
import { deleteLine, moveTrackedLines, saveDocumentLine } from "@/lib/services/line-items";
import type { PlanConfirmResult } from "@/lib/services/plan-proposals";
import { saveSettings } from "@/lib/services/settings";

/** What a send needs from the caller: the site address for links, and a test hook for delivery. */
export type ChangeDeps = { authUrl?: string | null; sendEmail?: (message: EmailMessage) => Promise<void> };

const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

type Draft = Omit<PlanPreview, "action"> & { action: "change" };

function card(title: string, href: string): Draft {
  return {
    action: "change",
    title,
    jobId: null,
    jobTitle: null,
    jobIsNew: false,
    clientName: null,
    clientIsNew: false,
    siteAddress: null,
    notes: null,
    lines: [],
    warnings: [],
    blockers: [],
    canConfirm: true,
    changes: [],
    href,
  };
}

function done(preview: Draft): PlanPreview {
  return { ...preview, canConfirm: preview.blockers.length === 0 };
}

async function loadDocument(ctx: ServiceContext, documentId: string) {
  const [row] = await ctx.db
    .select({ document: documents, client: clients, jobTitle: jobs.title, jobStatus: jobs.status })
    .from(documents)
    .leftJoin(clients, and(eq(clients.id, documents.clientId), eq(clients.contractorId, ctx.contractorId)))
    .leftJoin(jobs, and(eq(jobs.id, documents.jobId), eq(jobs.contractorId, ctx.contractorId)))
    .where(and(eq(documents.id, documentId), eq(documents.contractorId, ctx.contractorId)))
    .limit(1);
  if (!row) throw new NotFoundError("Document not found.");
  return row;
}

async function loadJob(ctx: ServiceContext, jobId: string) {
  const [row] = await ctx.db
    .select({ job: jobs, clientName: clients.name })
    .from(jobs)
    .leftJoin(clients, and(eq(clients.id, jobs.clientId), eq(clients.contractorId, ctx.contractorId)))
    .where(and(eq(jobs.id, jobId), eq(jobs.contractorId, ctx.contractorId)))
    .limit(1);
  if (!row) throw new NotFoundError("Job not found.");
  return row;
}

async function loadContractor(ctx: ServiceContext) {
  const [row] = await ctx.db.select().from(contractors).where(eq(contractors.id, ctx.contractorId)).limit(1);
  if (!row) throw new NotFoundError("Contractor not found.");
  return row;
}

function fromTo(before: string | number | null | undefined, after: string | number | null | undefined) {
  const show = (value: string | number | null | undefined) => (value === null || value === undefined || value === "" ? "(none)" : String(value));
  return `${show(before)} → ${show(after)}`;
}

/** A price on a change card must be one the contractor said, or one copied from their records. */
function priceSaid(said: string | null, line: { unit_price: number | null; quantity: number; source_note?: string | null }) {
  if (line.unit_price == null || line.source_note) return true;
  return priceAppearsInTranscript(said, line.unit_price) || priceAppearsInTranscript(said, roundMoney(line.unit_price * line.quantity));
}

function previewLine(line: ChangeLine, labourRate: number): PlanPreviewLine {
  const price = line.unit_price ?? (line.kind === "labour" ? labourRate : null);
  return {
    kind: line.kind,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unitPrice: price,
    note: line.source_note ?? (line.unit_price == null && line.kind === "labour" ? "Using your labour rate" : price == null ? "No price" : null),
  };
}

// ---- Preview ----

/**
 * The card for a change. `said` is what the contractor wrote in this plan; prices are checked against it.
 * Blockers say why Confirm is off, in words the contractor can act on.
 */
export async function previewChange(ctx: ServiceContext, change: PlanChange, said: string | null, nowMs = Date.now()): Promise<PlanPreview> {
  const href = changeHref(change);
  switch (change.kind) {
    case "document_status": {
      const { document: doc, client, jobTitle, jobStatus } = await loadDocument(ctx, change.document_id);
      const preview = card(
        `Mark ${doc.number} ${STATUS_VERBS[change.to]}${change.to === "paid" ? ` (${cad(doc.total)})` : ""}`,
        href,
      );
      preview.jobId = doc.jobId;
      preview.jobTitle = jobTitle;
      preview.clientName = client?.name ?? null;
      preview.changes = [{ label: "Status", value: fromTo(doc.status, change.to) }];
      if (doc.type === "quote" && change.to === "approved" && jobStatus === "quoted") {
        preview.changes.push({ label: "Job", value: `${jobTitle} becomes active` });
      }
      if (doc.status === change.to) preview.blockers.push(`${doc.number} is already ${change.to}.`);
      else if (!canTransition(doc.type as DocType, doc.status as DocStatus, change.to)) {
        preview.blockers.push(`${doc.number} is ${doc.status}, so it can't be marked ${change.to}.`);
      }
      return done(preview);
    }

    case "document_lines": {
      const { document: doc, jobTitle } = await loadDocument(ctx, change.document_id);
      const contractor = await loadContractor(ctx);
      const preview = card(`Change the lines on ${doc.number}`, href);
      preview.jobId = doc.jobId;
      preview.jobTitle = jobTitle;
      if (isLocked(doc.status as DocStatus)) {
        preview.blockers.push(`${doc.number} is ${doc.status}, so its lines can't change. Only a draft can be edited.`);
      }
      const current = await ctx.db
        .select()
        .from(lineItems)
        .where(and(eq(lineItems.contractorId, ctx.contractorId), eq(lineItems.documentId, doc.id)))
        .orderBy(lineItems.sortOrder);
      const byId = new Map(current.map((line) => [line.id, line]));
      for (const lineId of change.remove) {
        const line = byId.get(lineId);
        if (!line) preview.blockers.push("A line to remove is not on this document.");
        else preview.changes!.push({ label: "Remove", value: `${line.description} (${cad(line.lineTotal)})` });
      }
      for (const edit of change.update) {
        const line = byId.get(edit.line_id);
        if (!line) {
          preview.blockers.push("A line to change is not on this document.");
          continue;
        }
        const parts: string[] = [];
        if (edit.description !== undefined && edit.description !== line.description) parts.push(`name ${fromTo(line.description, edit.description)}`);
        if (edit.quantity !== undefined && edit.quantity !== line.quantity) parts.push(`quantity ${fromTo(line.quantity, edit.quantity)}`);
        if (edit.unit !== undefined && edit.unit !== line.unit) parts.push(`unit ${fromTo(line.unit, edit.unit)}`);
        if (edit.unit_price !== undefined && edit.unit_price !== line.unitPrice) {
          parts.push(`price ${fromTo(cad(line.unitPrice), cad(edit.unit_price))}`);
          if (!priceSaid(said, { unit_price: edit.unit_price, quantity: edit.quantity ?? line.quantity, source_note: edit.source_note })) {
            preview.blockers.push(UNSAID_PRICE);
          }
        }
        if (parts.length) preview.changes!.push({ label: line.description, value: parts.join(", ") });
      }
      preview.lines = change.add.map((line) => previewLine(line, contractor.labourRateHourly));
      for (const line of change.add) {
        if (line.unit_price == null && line.kind !== "labour") preview.blockers.push("Add a price to every line.");
        else if (!priceSaid(said, line)) preview.blockers.push(UNSAID_PRICE);
      }
      if (!change.add.length && !change.update.length && !change.remove.length) preview.blockers.push("There is nothing to change.");
      // The new total, so the contractor sees the effect. Computed by lib/money.ts, never by the model.
      const after: DraftLine[] = current
        .filter((line) => !change.remove.includes(line.id))
        .map((line) => {
          const edit = change.update.find((item) => item.line_id === line.id);
          return {
            id: line.id,
            kind: line.kind as DraftLine["kind"],
            description: edit?.description ?? line.description,
            quantity: edit?.quantity ?? line.quantity,
            unit: edit?.unit ?? line.unit,
            unitPrice: edit?.unit_price ?? line.unitPrice,
          };
        })
        .concat(
          change.add.map((line, index) => ({
            id: `new-${index}`,
            kind: line.kind,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            unitPrice: line.unit_price ?? (line.kind === "labour" ? contractor.labourRateHourly : 0),
          })),
        );
      preview.changes!.push({ label: "Total", value: fromTo(cad(doc.total), cad(documentTotals(after, contractor.taxRate).total)) });
      preview.blockers = [...new Set(preview.blockers)];
      return done(preview);
    }

    case "document_details": {
      const { document: doc, jobTitle } = await loadDocument(ctx, change.document_id);
      const preview = card(`Update ${doc.number}`, href);
      preview.jobId = doc.jobId;
      preview.jobTitle = jobTitle;
      if (isLocked(doc.status as DocStatus)) preview.blockers.push(`${doc.number} is ${doc.status}. Only a draft can be edited.`);
      if (change.due_date !== undefined) {
        if (doc.type !== "invoice") preview.blockers.push("Only an invoice has a due date.");
        preview.changes!.push({ label: "Due", value: fromTo(doc.dueDate, change.due_date) });
      }
      if (change.valid_until !== undefined) {
        if (doc.type !== "quote") preview.blockers.push("Only a quote has a valid-until date.");
        preview.changes!.push({ label: "Valid until", value: fromTo(doc.validUntil, change.valid_until) });
      }
      if (change.notes !== undefined) preview.changes!.push({ label: "Notes", value: change.notes.trim() || "(none)" });
      if (!preview.changes!.length) preview.blockers.push("There is nothing to change.");
      return done(preview);
    }

    case "invoice_from_quote": {
      const { document: quote, client, jobTitle } = await loadDocument(ctx, change.quote_id);
      const preview = card(`Invoice ${quote.number}${client ? ` for ${client.name}` : ""} (${cad(quote.total)})`, href);
      preview.jobId = quote.jobId;
      preview.jobTitle = jobTitle;
      preview.clientName = client?.name ?? null;
      if (quote.type !== "quote") preview.blockers.push(`${quote.number} is not a quote.`);
      else if (quote.status !== "approved") preview.blockers.push(`${quote.number} is ${quote.status}. Mark it approved first.`);
      const [existing] = await ctx.db
        .select({ number: documents.number })
        .from(documents)
        .where(and(eq(documents.contractorId, ctx.contractorId), eq(documents.sourceQuoteId, quote.id), eq(documents.type, "invoice")))
        .limit(1);
      if (existing) preview.warnings.push(`${existing.number} was already made from this quote. Confirm opens it.`);
      preview.changes = [{ label: "Lines", value: "Copied from the quote, so nothing is retyped" }];
      return done(preview);
    }

    case "add_unbilled_to_invoice": {
      const { document: invoice, jobTitle } = await loadDocument(ctx, change.invoice_id);
      const preview = card(`Add the unbilled work to ${invoice.number}`, href);
      preview.jobId = invoice.jobId;
      preview.jobTitle = jobTitle;
      if (invoice.type !== "invoice" || invoice.status !== "draft") preview.blockers.push(`${invoice.number} is not a draft invoice.`);
      const unbilled = await ctx.db
        .select()
        .from(lineItems)
        .where(
          and(
            eq(lineItems.contractorId, ctx.contractorId),
            eq(lineItems.jobId, invoice.jobId),
            isNull(lineItems.documentId),
            isNull(lineItems.billedDocumentId),
          ),
        );
      if (!unbilled.length) preview.blockers.push(`${jobTitle ?? "This job"} has no unbilled work.`);
      preview.lines = unbilled.map((line) => ({
        kind: line.kind as PlanPreviewLine["kind"],
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitPrice: line.unitPrice,
        note: null,
      }));
      return done(preview);
    }

    case "delete_draft": {
      const { document: doc, jobTitle } = await loadDocument(ctx, change.document_id);
      const preview = card(`Delete draft ${doc.number}`, href);
      preview.jobId = doc.jobId;
      preview.jobTitle = jobTitle;
      preview.changes = [{ label: "Document", value: `${doc.number} (${cad(doc.total)}) is deleted` }];
      if (doc.status !== "draft") preview.blockers.push(`${doc.number} is ${doc.status}. Only a draft can be deleted.`);
      else if (doc.type === "invoice") preview.warnings.push("Any tracked lines on it go back to unbilled.");
      return done(preview);
    }

    case "job_status": {
      const { job, clientName } = await loadJob(ctx, change.job_id);
      const preview = card(`Mark ${job.title} ${STATUS_VERBS[change.to]}`, href);
      preview.jobId = job.id;
      preview.jobTitle = job.title;
      preview.clientName = clientName;
      preview.changes = [{ label: "Status", value: fromTo(job.status, change.to) }];
      if (job.status === change.to) preview.blockers.push(`${job.title} is already ${change.to}.`);
      return done(preview);
    }

    case "job_details": {
      const { job, clientName } = await loadJob(ctx, change.job_id);
      const preview = card(`Update ${job.title}`, href);
      preview.jobId = job.id;
      preview.jobTitle = job.title;
      preview.clientName = clientName;
      if (change.title !== undefined) preview.changes!.push({ label: "Title", value: fromTo(job.title, change.title) });
      if (change.site_address !== undefined) preview.changes!.push({ label: "Site", value: fromTo(job.siteAddress, change.site_address) });
      if (change.notes !== undefined) preview.changes!.push({ label: "Notes", value: change.notes || "(none)" });
      if (!preview.changes!.length) preview.blockers.push("There is nothing to change.");
      return done(preview);
    }

    case "move_lines": {
      const [{ job: from }, { job: to }] = await Promise.all([loadJob(ctx, change.job_id), loadJob(ctx, change.to_job_id)]);
      const rows = await ctx.db
        .select()
        .from(lineItems)
        .where(and(eq(lineItems.contractorId, ctx.contractorId), inArray(lineItems.id, change.line_ids)));
      const preview = card(`Move ${rows.length} ${rows.length === 1 ? "line" : "lines"} from ${from.title} to ${to.title}`, href);
      preview.jobId = to.id;
      preview.jobTitle = to.title;
      preview.lines = rows.map((line) => ({
        kind: line.kind as PlanPreviewLine["kind"],
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitPrice: line.unitPrice,
        note: null,
      }));
      const movable = rows.filter((line) => line.jobId === from.id && !line.documentId && !line.billedDocumentId);
      if (from.id === to.id) preview.blockers.push("Pick a different job.");
      if (rows.length !== change.line_ids.length || movable.length !== rows.length) {
        preview.blockers.push(`Only unbilled lines on ${from.title} can be moved.`);
      }
      return done(preview);
    }

    case "client": {
      if (!change.client_id) {
        const preview = card(`Add the client ${change.name ?? ""}`.trim(), href);
        preview.clientName = change.name ?? null;
        preview.clientIsNew = true;
        if (!change.name) preview.blockers.push("Add the client's name.");
        if (change.email) preview.changes!.push({ label: "Email", value: change.email });
        if (change.phone) preview.changes!.push({ label: "Phone", value: change.phone });
        if (change.billing_address) preview.changes!.push({ label: "Address", value: change.billing_address });
        const same = change.name
          ? await ctx.db
              .select({ name: clients.name })
              .from(clients)
              .where(and(eq(clients.contractorId, ctx.contractorId), eq(clients.name, change.name)))
              .limit(1)
          : [];
        if (same.length) preview.warnings.push(`You already have a client called ${change.name}.`);
        return done(preview);
      }
      const [client] = await ctx.db
        .select()
        .from(clients)
        .where(and(eq(clients.id, change.client_id), eq(clients.contractorId, ctx.contractorId)))
        .limit(1);
      if (!client) throw new NotFoundError("Client not found.");
      const preview = card(`Update ${client.name}`, href);
      preview.clientName = client.name;
      if (change.name !== undefined) preview.changes!.push({ label: "Name", value: fromTo(client.name, change.name) });
      if (change.email !== undefined) preview.changes!.push({ label: "Email", value: fromTo(client.email, change.email) });
      if (change.phone !== undefined) preview.changes!.push({ label: "Phone", value: fromTo(client.phone, change.phone) });
      if (change.billing_address !== undefined) preview.changes!.push({ label: "Address", value: fromTo(client.billingAddress, change.billing_address) });
      if (!preview.changes!.length) preview.blockers.push("There is nothing to change.");
      return done(preview);
    }

    case "send": {
      const { document: doc, client, jobTitle } = await loadDocument(ctx, change.document_id);
      const email = client?.email?.trim() || null;
      const who = client?.name ?? "the client";
      const daysOverdue =
        doc.dueDate && doc.status === "sent"
          ? Math.round((Date.parse(localDate(nowMs)) - Date.parse(doc.dueDate)) / (24 * 60 * 60 * 1000))
          : 0;
      const preview = card(
        change.reminder
          ? `Remind ${who} about ${doc.number} (${cad(doc.total)}${daysOverdue > 0 ? `, ${daysOverdue} days overdue` : ""})`
          : `Email ${doc.number} to ${who}`,
        href,
      );
      preview.jobId = doc.jobId;
      preview.jobTitle = jobTitle;
      preview.clientName = client?.name ?? null;
      preview.changes = [{ label: "To", value: email ?? "(no email)" }];
      if (!change.reminder && doc.status === "draft") preview.changes.push({ label: "Status", value: "draft → sent" });
      if (!email) preview.blockers.push(`${who} has no email. Add one first, or share the link from the document page.`);
      if (!isEmailProviderConfigured()) preview.blockers.push("Email isn't set up for this account. Share the link from the document page.");
      if (change.reminder && !(doc.type === "invoice" && doc.status === "sent")) {
        preview.blockers.push("Only a sent, unpaid invoice gets a reminder.");
      } else if (!change.reminder && doc.status !== "draft" && doc.status !== "sent") {
        preview.blockers.push(`${doc.number} is ${doc.status}, so it isn't sent again.`);
      }
      return done(preview);
    }

    case "settings": {
      const contractor = await loadContractor(ctx);
      const preview = card("Update your settings", href);
      const rows: [string, unknown, unknown][] = [
        ["Labour rate", change.labour_rate !== undefined && `${cad(contractor.labourRateHourly)}/h`, change.labour_rate !== undefined && `${cad(change.labour_rate)}/h`],
        ["Material markup", change.markup_pct !== undefined && `${contractor.defaultMarkupPct} %`, change.markup_pct !== undefined && `${change.markup_pct} %`],
        ["Tax rate", change.tax_rate_pct !== undefined && `${roundMoney(contractor.taxRate * 100)} %`, change.tax_rate_pct !== undefined && `${change.tax_rate_pct} %`],
        ["Tax label", change.tax_label !== undefined && contractor.taxLabel, change.tax_label],
        ["e-Transfer email", change.etransfer_email !== undefined && contractor.etransferEmail, change.etransfer_email],
        ["Payment note", change.etransfer_note !== undefined && contractor.etransferNote, change.etransfer_note],
      ];
      for (const [label, before, after] of rows) {
        if (after === undefined || after === false) continue;
        preview.changes!.push({ label, value: fromTo(before as string, after as string) });
      }
      if (!preview.changes!.length) preview.blockers.push("There is nothing to change.");
      else preview.warnings.push("Applies to new lines and documents. Existing documents keep their numbers.");
      return done(preview);
    }

    case "undo": {
      const plan = await undoPlan(ctx, change.capture_id);
      const preview = card(plan.title, href);
      preview.changes = plan.rows;
      if (plan.problem) preview.blockers.push(plan.problem);
      return done(preview);
    }
  }
}

// ---- Undo ----

/** The most recent card confirmed in the last day, other than an undo. What "undo that" means. */
export async function lastConfirmedCapture(ctx: ServiceContext, nowMs = Date.now()) {
  const rows = await ctx.db
    .select({ id: captures.id, extraction: captures.extraction })
    .from(captures)
    .where(and(eq(captures.contractorId, ctx.contractorId), eq(captures.status, "confirmed"), gte(captures.confirmedAt, nowMs - UNDO_WINDOW_MS)))
    .orderBy(desc(captures.confirmedAt))
    .limit(10);
  for (const row of rows) {
    const proposal = parseDescribeExtraction(row.extraction);
    if (proposal?.action === "change" && parsePlanChange(proposal.change)?.kind === "undo") continue;
    return row.id;
  }
  return null;
}

type UndoPlan = {
  title: string;
  rows: { label: string; value: string }[];
  problem: string | null;
  run?: (ctx: ServiceContext) => Promise<void>;
};

/**
 * What undoing a confirmed card would do. Only work that is still a draft or unbilled can be undone;
 * anything sent, billed, or a status change is refused with the reason.
 */
async function undoPlan(ctx: ServiceContext, captureId: string): Promise<UndoPlan> {
  const [capture] = await ctx.db
    .select()
    .from(captures)
    .where(and(eq(captures.id, captureId), eq(captures.contractorId, ctx.contractorId)))
    .limit(1);
  if (!capture) throw new NotFoundError("Capture not found.");
  if (capture.status !== "confirmed") return { title: "Undo", rows: [], problem: "That card was not confirmed, so there is nothing to undo." };
  const proposal = capture.type === "receipt" ? null : parseDescribeExtraction(capture.extraction);

  async function draftDocument(documentId: string): Promise<UndoPlan> {
    const [doc] = await ctx.db
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.contractorId, ctx.contractorId)))
      .limit(1);
    if (!doc) return { title: "Undo", rows: [], problem: "That document is already gone." };
    const title = `Undo: delete draft ${doc.number}`;
    if (doc.status !== "draft") return { title, rows: [], problem: `${doc.number} was already ${doc.status}, so it can't be undone from Plan.` };
    return {
      title,
      rows: [{ label: "Document", value: `${doc.number} (${cad(doc.total)}) is deleted` }],
      problem: null,
      run: (inner) => deleteDraftDocument(inner, doc.id),
    };
  }

  if (proposal?.action === "change") {
    const result = proposal.result as PlanConfirmResult | null;
    const change = parsePlanChange(proposal.change);
    if (change?.kind === "invoice_from_quote" && result?.kind === "document") return draftDocument(result.documentId);
    return { title: "Undo", rows: [], problem: "That change can't be undone from Plan. Change it back on the document or the job." };
  }
  if (proposal?.action === "invoice_tracked") {
    return proposal.document_id ? draftDocument(proposal.document_id) : { title: "Undo", rows: [], problem: "Nothing to undo." };
  }
  if (proposal?.action === "create_job") return { title: "Undo", rows: [], problem: "A new job can't be undone from Plan." };

  const lines = await ctx.db
    .select()
    .from(lineItems)
    .where(and(eq(lineItems.contractorId, ctx.contractorId), eq(lineItems.captureId, capture.id)));
  if (proposal?.action === "make_quote" || proposal?.action === "make_invoice") {
    const documentId = lines.find((line) => line.documentId)?.documentId;
    return documentId ? draftDocument(documentId) : { title: "Undo", rows: [], problem: "That document is already gone." };
  }
  const tracked = lines.filter((line) => !line.documentId);
  if (!tracked.length) return { title: "Undo", rows: [], problem: "Those lines are already gone." };
  const title = `Undo: remove ${tracked.length} ${tracked.length === 1 ? "line" : "lines"}`;
  if (tracked.some((line) => line.billedDocumentId)) {
    return { title, rows: [], problem: "Those lines were already invoiced, so they can't be undone from Plan." };
  }
  return {
    title,
    rows: tracked.map((line) => ({ label: "Remove", value: `${line.quantity} ${line.unit} ${line.description} (${cad(line.lineTotal)})` })),
    problem: null,
    run: async (inner) => {
      for (const line of tracked) await deleteLine(inner, line.id);
    },
  };
}

// ---- Confirm ----

async function applyChange(
  ctx: ServiceContext,
  change: PlanChange,
  deps: ChangeDeps,
  preview: PlanPreview,
): Promise<PlanConfirmResult> {
  const href = changeHref(change);
  const doneWith = (message: string): PlanConfirmResult => ({ kind: "done", message, href });
  switch (change.kind) {
    case "document_status":
      await setDocumentStatus(ctx, change.document_id, change.to);
      return doneWith(preview.title);
    case "document_lines": {
      const { document: doc } = await loadDocument(ctx, change.document_id);
      const contractor = await loadContractor(ctx);
      for (const lineId of change.remove) await deleteLine(ctx, lineId);
      for (const edit of change.update) {
        const [line] = await ctx.db
          .select()
          .from(lineItems)
          .where(and(eq(lineItems.id, edit.line_id), eq(lineItems.contractorId, ctx.contractorId), eq(lineItems.documentId, doc.id)))
          .limit(1);
        if (!line) throw new NotFoundError("Line not found.");
        await saveDocumentLine(ctx, {
          id: line.id,
          jobId: doc.jobId,
          documentId: doc.id,
          kind: line.kind as ChangeLine["kind"],
          description: edit.description ?? line.description,
          quantity: edit.quantity ?? line.quantity,
          unit: edit.unit ?? line.unit,
          unitCost: line.unitCost,
          unitPrice: edit.unit_price ?? line.unitPrice,
        });
      }
      for (const line of change.add) {
        await saveDocumentLine(ctx, {
          jobId: doc.jobId,
          documentId: doc.id,
          kind: line.kind,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unitPrice: line.unit_price ?? contractor.labourRateHourly,
        });
      }
      return doneWith(`Changed ${doc.number}`);
    }
    case "document_details":
      await saveDocumentMeta(ctx, {
        documentId: change.document_id,
        notes: change.notes,
        dueDate: change.due_date,
        validUntil: change.valid_until,
      });
      return doneWith(preview.title);
    case "invoice_from_quote":
      return { kind: "document", documentId: await createInvoiceFromQuote(ctx, change.quote_id) };
    case "add_unbilled_to_invoice":
      return { kind: "document", documentId: await addTrackedLinesToInvoice(ctx, change.invoice_id) };
    case "delete_draft":
      await deleteDraftDocument(ctx, change.document_id);
      return doneWith(preview.title);
    case "job_status":
      await setJobStatus(ctx, change.job_id, change.to as JobStatus);
      return doneWith(preview.title);
    case "job_details": {
      const { job } = await loadJob(ctx, change.job_id);
      await updateJob(ctx, job.id, {
        title: change.title ?? job.title,
        siteAddress: change.site_address ?? job.siteAddress,
        notes: change.notes ?? job.notes,
        clientId: job.clientId,
      });
      return doneWith(preview.title);
    }
    case "move_lines":
      await moveTrackedLines(ctx, { fromJobId: change.job_id, toJobId: change.to_job_id, lineIds: change.line_ids });
      return doneWith(preview.title);
    case "client": {
      if (!change.client_id) {
        await saveClient(ctx, { name: change.name ?? "", email: change.email, phone: change.phone, billingAddress: change.billing_address });
        return doneWith(preview.title);
      }
      const [client] = await ctx.db
        .select()
        .from(clients)
        .where(and(eq(clients.id, change.client_id), eq(clients.contractorId, ctx.contractorId)))
        .limit(1);
      if (!client) throw new NotFoundError("Client not found.");
      // saveClient replaces every field, so carry over the ones this change leaves alone.
      await saveClient(ctx, {
        id: client.id,
        name: change.name ?? client.name,
        email: change.email ?? client.email,
        phone: change.phone ?? client.phone,
        billingAddress: change.billing_address ?? client.billingAddress,
      });
      return doneWith(preview.title);
    }
    case "send": {
      const authUrl = deps.authUrl?.trim();
      if (!authUrl) throw new ValidationError("Email isn't set up for this account. Share the link from the document page.");
      const { document: doc } = await loadDocument(ctx, change.document_id);
      await sendDocumentEmailToClient(ctx, doc.id, { authUrl, reminder: change.reminder, send: deps.sendEmail });
      if (!change.reminder && doc.status === "draft") await setDocumentStatus(ctx, doc.id, "sent");
      return doneWith(change.reminder ? `Reminder sent for ${doc.number}` : `Emailed ${doc.number}`);
    }
    case "settings":
      await saveSettings(ctx, {
        labourRateHourly: change.labour_rate,
        defaultMarkupPct: change.markup_pct,
        taxRate: change.tax_rate_pct === undefined ? undefined : roundMoney(change.tax_rate_pct) / 100,
        taxLabel: change.tax_label,
        etransferEmail: change.etransfer_email,
        etransferNote: change.etransfer_note,
      });
      return doneWith("Settings updated");
    case "undo": {
      const plan = await undoPlan(ctx, change.capture_id);
      if (plan.problem || !plan.run) throw new ValidationError(plan.problem ?? "Nothing to undo.");
      await plan.run(ctx);
      await ctx.db
        .update(captures)
        .set({ status: "discarded" })
        .where(and(eq(captures.id, change.capture_id), eq(captures.contractorId, ctx.contractorId)));
      return doneWith("Undone");
    }
  }
}

/**
 * Confirm a change card. The capture is locked so a double tap runs the change once; a second confirm
 * returns the stored result. The card is re-checked against the data as it is now, and refused with the
 * reason when it no longer holds.
 */
export async function confirmChange(ctx: ServiceContext, captureId: string, deps: ChangeDeps = {}): Promise<PlanConfirmResult> {
  return ctx.db.transaction(async (tx) => {
    const [capture] = await tx
      .select()
      .from(captures)
      .where(and(eq(captures.id, captureId), eq(captures.contractorId, ctx.contractorId)))
      .for("update")
      .limit(1);
    if (!capture) throw new NotFoundError("Capture not found.");
    const proposal = parseDescribeExtraction(capture.extraction);
    const change = parsePlanChange(proposal?.change);
    if (!proposal || !change) throw new ValidationError("There is nothing to confirm for this message.");
    if (capture.status === "confirmed" && proposal.result) return proposal.result as PlanConfirmResult;
    if (capture.status !== "needs_review") throw new ConflictError("This message was already confirmed or cancelled.");

    const inner = { db: tx, contractorId: ctx.contractorId };
    const said = [proposal.evidence, capture.transcript].filter(Boolean).join("\n") || null;
    const preview = await previewChange(inner, change, said);
    if (!preview.canConfirm) throw new ValidationError(preview.blockers[0]!);
    const result = await applyChange(inner, change, deps, preview);
    await tx
      .update(captures)
      .set({ status: "confirmed", confirmedAt: Date.now(), extraction: { ...proposal, result } })
      .where(and(eq(captures.id, captureId), eq(captures.contractorId, ctx.contractorId)));
    return result;
  });
}
