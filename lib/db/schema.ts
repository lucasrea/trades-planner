import {
  bigint,
  doublePrecision,
  integer,
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
  plan: text("plan").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
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
  targetDate: text("target_date"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const jobReceipts = pgTable("job_receipts", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull(),
  contractorId: text("contractor_id").notNull(),
  imageUrl: text("image_url").notNull().default(""),
  vendor: text("vendor").notNull().default(""),
  purchasedAt: text("purchased_at"),
  receiptTotal: doublePrecision("receipt_total").notNull().default(0),
  status: text("status").notNull().default("uploaded"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const jobCosts = pgTable("job_costs", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull(),
  contractorId: text("contractor_id").notNull(),
  receiptId: text("receipt_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  kind: text("kind").notNull().default("material"),
  description: text("description").notNull().default(""),
  quantity: doublePrecision("quantity").notNull().default(1),
  unit: text("unit").notNull().default("ea"),
  cost: doublePrecision("cost").notNull().default(0),
  unitPrice: doublePrecision("unit_price").notNull().default(0),
  lineTotal: doublePrecision("line_total").notNull().default(0),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const quotes = pgTable("quotes", {
  id: text("id").primaryKey(),
  contractorId: text("contractor_id").notNull(),
  clientId: text("client_id").notNull(),
  jobId: text("job_id"),
  quoteNumber: text("quote_number").notNull(),
  status: text("status").notNull().default("draft"),
  notes: text("notes").notNull().default(""),
  validUntil: text("valid_until"),
  subtotal: doublePrecision("subtotal").notNull().default(0),
  tax: doublePrecision("tax").notNull().default(0),
  total: doublePrecision("total").notNull().default(0),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const quoteLineItems = pgTable("quote_line_items", {
  id: text("id").primaryKey(),
  quoteId: text("quote_id").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  kind: text("kind").notNull().default("material"),
  description: text("description").notNull().default(""),
  quantity: doublePrecision("quantity").notNull().default(1),
  unit: text("unit").notNull().default("ea"),
  unitPrice: doublePrecision("unit_price").notNull().default(0),
  lineTotal: doublePrecision("line_total").notNull().default(0),
});

export const invoices = pgTable("invoices", {
  id: text("id").primaryKey(),
  contractorId: text("contractor_id").notNull(),
  clientId: text("client_id").notNull(),
  jobId: text("job_id"),
  quoteId: text("quote_id"),
  invoiceNumber: text("invoice_number").notNull(),
  status: text("status").notNull().default("draft"),
  notes: text("notes").notNull().default(""),
  dueDate: text("due_date"),
  subtotal: doublePrecision("subtotal").notNull().default(0),
  tax: doublePrecision("tax").notNull().default(0),
  total: doublePrecision("total").notNull().default(0),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const invoiceLineItems = pgTable("invoice_line_items", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  kind: text("kind").notNull().default("material"),
  description: text("description").notNull().default(""),
  quantity: doublePrecision("quantity").notNull().default(1),
  unit: text("unit").notNull().default("ea"),
  unitPrice: doublePrecision("unit_price").notNull().default(0),
  lineTotal: doublePrecision("line_total").notNull().default(0),
});
