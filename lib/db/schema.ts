import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const contractors = sqliteTable("contractors", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  businessName: text("business_name").notNull().default(""),
  businessAddress: text("business_address").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  gstHstNumber: text("gst_hst_number").notNull().default(""),
  labourRateHourly: real("labour_rate_hourly").notNull().default(85),
  defaultMarkupPct: real("default_markup_pct").notNull().default(20),
  taxRate: real("tax_rate").notNull().default(0.13),
  taxLabel: text("tax_label").notNull().default("HST"),
  etransferEmail: text("etransfer_email").notNull().default(""),
  etransferNote: text("etransfer_note").notNull().default(""),
  plan: text("plan").notNull().default("pro"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  onboardingCompletedAt: integer("onboarding_completed_at"),
  nextQuoteNumber: integer("next_quote_number").notNull().default(1),
  nextInvoiceNumber: integer("next_invoice_number").notNull().default(1),
});

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  contractorId: text("contractor_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  billingAddress: text("billing_address").notNull().default(""),
  createdAt: integer("created_at").notNull(),
});

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  contractorId: text("contractor_id").notNull(),
  clientId: text("client_id").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("quoted"),
  siteAddress: text("site_address").notNull().default(""),
  notes: text("notes").notNull().default(""),
  targetDate: text("target_date"),
  createdAt: integer("created_at").notNull(),
});

export const quotes = sqliteTable("quotes", {
  id: text("id").primaryKey(),
  contractorId: text("contractor_id").notNull(),
  clientId: text("client_id").notNull(),
  jobId: text("job_id"),
  quoteNumber: text("quote_number").notNull(),
  status: text("status").notNull().default("draft"),
  notes: text("notes").notNull().default(""),
  validUntil: text("valid_until"),
  subtotal: real("subtotal").notNull().default(0),
  tax: real("tax").notNull().default(0),
  total: real("total").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const quoteLineItems = sqliteTable("quote_line_items", {
  id: text("id").primaryKey(),
  quoteId: text("quote_id").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  kind: text("kind").notNull().default("material"),
  description: text("description").notNull().default(""),
  quantity: real("quantity").notNull().default(1),
  unit: text("unit").notNull().default("ea"),
  unitPrice: real("unit_price").notNull().default(0),
  lineTotal: real("line_total").notNull().default(0),
});

export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey(),
  contractorId: text("contractor_id").notNull(),
  clientId: text("client_id").notNull(),
  jobId: text("job_id"),
  quoteId: text("quote_id"),
  invoiceNumber: text("invoice_number").notNull(),
  status: text("status").notNull().default("draft"),
  notes: text("notes").notNull().default(""),
  dueDate: text("due_date"),
  subtotal: real("subtotal").notNull().default(0),
  tax: real("tax").notNull().default(0),
  total: real("total").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const invoiceLineItems = sqliteTable("invoice_line_items", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  kind: text("kind").notNull().default("material"),
  description: text("description").notNull().default(""),
  quantity: real("quantity").notNull().default(1),
  unit: text("unit").notNull().default("ea"),
  unitPrice: real("unit_price").notNull().default(0),
  lineTotal: real("line_total").notNull().default(0),
});
