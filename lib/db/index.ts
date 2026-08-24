import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "fs";
import path from "path";
import * as schema from "./schema";

const dataDir = path.join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

const client = createClient({
  url: `file:${path.join(dataDir, "sitebook.db")}`,
});

export const db = drizzle(client, { schema });

let migrated = false;

export async function ensureDb() {
  if (migrated) return db;
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS contractors (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      business_name TEXT NOT NULL DEFAULT '',
      business_address TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      gst_hst_number TEXT NOT NULL DEFAULT '',
      labour_rate_hourly REAL NOT NULL DEFAULT 85,
      default_markup_pct REAL NOT NULL DEFAULT 20,
      tax_rate REAL NOT NULL DEFAULT 0.13,
      tax_label TEXT NOT NULL DEFAULT 'HST',
      etransfer_email TEXT NOT NULL DEFAULT '',
      etransfer_note TEXT NOT NULL DEFAULT '',
      plan TEXT NOT NULL DEFAULT 'pro',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      onboarding_completed_at INTEGER,
      next_quote_number INTEGER NOT NULL DEFAULT 1,
      next_invoice_number INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      contractor_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      billing_address TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      contractor_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'quoted',
      site_address TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      target_date TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      contractor_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      job_id TEXT,
      quote_number TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      notes TEXT NOT NULL DEFAULT '',
      valid_until TEXT,
      subtotal REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS quote_line_items (
      id TEXT PRIMARY KEY,
      quote_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      kind TEXT NOT NULL DEFAULT 'material',
      description TEXT NOT NULL DEFAULT '',
      quantity REAL NOT NULL DEFAULT 1,
      unit TEXT NOT NULL DEFAULT 'ea',
      unit_price REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      contractor_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      job_id TEXT,
      quote_id TEXT,
      invoice_number TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      notes TEXT NOT NULL DEFAULT '',
      due_date TEXT,
      subtotal REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS invoice_line_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      kind TEXT NOT NULL DEFAULT 'material',
      description TEXT NOT NULL DEFAULT '',
      quantity REAL NOT NULL DEFAULT 1,
      unit TEXT NOT NULL DEFAULT 'ea',
      unit_price REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL DEFAULT 0
    );
  `);
  migrated = true;
  return db;
}
