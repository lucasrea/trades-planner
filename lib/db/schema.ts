import { sql } from "drizzle-orm";
import {
  bigint,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  image: text("image").notNull().default(""),
  googleId: text("google_id"),
  passwordHash: text("password_hash").notNull().default(""),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const contractors = pgTable("contractors", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  businessName: text("business_name").notNull().default(""),
  businessAddress: text("business_address").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  gstHstNumber: text("gst_hst_number").notNull().default(""),
  labourRateHourly: doublePrecision("labour_rate_hourly").notNull().default(85),
  defaultMarkupPct: doublePrecision("default_markup_pct").notNull().default(20),
  taxRate: doublePrecision("tax_rate").notNull().default(0.13),
  taxLabel: text("tax_label").notNull().default("HST"),
  etransferEmail: text("etransfer_email").notNull().default(""),
  etransferNote: text("etransfer_note").notNull().default(""),
  stripeCustomerId: text("stripe_customer_id"),
  onboardingCompletedAt: bigint("onboarding_completed_at", { mode: "number" }),
  nextQuoteNumber: integer("next_quote_number").notNull().default(1),
  nextInvoiceNumber: integer("next_invoice_number").notNull().default(1),
});

export const clients = pgTable("clients", {
  id: text("id").primaryKey(),
  contractorId: text("contractor_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  billingAddress: text("billing_address").notNull().default(""),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  contractorId: text("contractor_id").notNull(),
  clientId: text("client_id").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("quoted"),
  siteAddress: text("site_address").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
});

export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  contractorId: text("contractor_id").notNull(),
  clientId: text("client_id").notNull(),
  jobId: text("job_id").notNull(),
  type: text("type").notNull(),
  number: text("number").notNull(),
  status: text("status").notNull().default("draft"),
  notes: text("notes").notNull().default(""),
  validUntil: text("valid_until"),
  dueDate: text("due_date"),
  sourceQuoteId: text("source_quote_id"),
  subtotal: doublePrecision("subtotal").notNull().default(0),
  tax: doublePrecision("tax").notNull().default(0),
  total: doublePrecision("total").notNull().default(0),
  sentAt: bigint("sent_at", { mode: "number" }),
  closedAt: bigint("closed_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const lineItems = pgTable("line_items", {
  id: text("id").primaryKey(),
  contractorId: text("contractor_id").notNull(),
  jobId: text("job_id").notNull(),
  documentId: text("document_id"),
  billedDocumentId: text("billed_document_id"),
  captureId: text("capture_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  kind: text("kind").notNull().default("material"),
  description: text("description").notNull().default(""),
  quantity: doublePrecision("quantity").notNull().default(1),
  unit: text("unit").notNull().default("ea"),
  unitCost: doublePrecision("unit_cost"),
  unitPrice: doublePrecision("unit_price").notNull().default(0),
  lineTotal: doublePrecision("line_total").notNull().default(0),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const captures = pgTable("captures", {
  id: text("id").primaryKey(),
  contractorId: text("contractor_id").notNull(),
  jobId: text("job_id"),
  type: text("type").notNull(),
  status: text("status").notNull().default("processing"),
  imagePath: text("image_path"),
  transcript: text("transcript"),
  extraction: jsonb("extraction"),
  model: text("model"),
  error: text("error"),
  latencyMs: integer("latency_ms"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  promptVersion: text("prompt_version"),
  feedback: text("feedback"),
  editSummary: jsonb("edit_summary"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  confirmedAt: bigint("confirmed_at", { mode: "number" }),
});
