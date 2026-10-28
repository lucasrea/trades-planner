#!/usr/bin/env node
/**
 * Dev-only: insert sample captures for the review UI (T24).
 * Usage: node scripts/seed-captures.mjs
 * Requires DATABASE_URL (or .env.local with DATABASE_URL).
 */
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
  console.error("Refusing to seed captures in production.");
  process.exit(1);
}

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });

const describeQuote = {
  intent: "quote",
  client_name: "Patel",
  job_title: "Water heater replacement",
  site_address: "14 Elm Street",
  scope_notes: "Replace tank and fittings.",
  lines: [
    { kind: "labour", description: "Install and connect", quantity: 4, unit: "hr", unit_price: null },
    { kind: "material", description: "Water heater tank", quantity: 1, unit: "ea", unit_price: 780 },
  ],
  warnings: [],
};

const describeInvoice = {
  ...describeQuote,
  intent: "invoice",
  scope_notes: "Completed install — bill for labour and materials.",
};

const describeLog = {
  intent: "log",
  client_name: "Patel",
  job_title: "Water heater replacement",
  site_address: "14 Elm Street",
  scope_notes: "Log extra fittings used on site.",
  lines: [{ kind: "material", description: "Extra PEX", quantity: 2, unit: "ea", unit_price: 12.5 }],
  warnings: [],
};

const receipt = {
  vendor: "Home Depot",
  purchased_at: "2026-10-01",
  currency: "CAD",
  subtotal: 45,
  tax: 5.85,
  total: 50.85,
  lines: [{ description: "PEX fittings", quantity: 1, unit_price: 45, line_total: 45 }],
  warnings: ["Assign each line to a job before confirming."],
};

const now = Date.now();
const ids = {
  quote: `cap_seed_quote_${now}`,
  invoice: `cap_seed_inv_${now}`,
  log: `cap_seed_log_${now}`,
  receipt: `cap_seed_rcpt_${now}`,
  failed: `cap_seed_fail_${now}`,
};

try {
  const contractors = await sql`SELECT id FROM contractors ORDER BY id LIMIT 1`;
  if (!contractors.length) {
    console.error("No contractor row found. Sign in once or run integration seed first.");
    process.exit(1);
  }
  const contractorId = contractors[0].id;

  const rows = [
    {
      id: ids.quote,
      type: "text",
      status: "needs_review",
      transcript: "Quote Mrs Patel at 14 Elm, replace water heater, four hours labour, tank is 780.",
      extraction: describeQuote,
    },
    {
      id: ids.invoice,
      type: "text",
      status: "needs_review",
      transcript: "Invoice Patel for the water heater job we finished yesterday.",
      extraction: describeInvoice,
    },
    {
      id: ids.log,
      type: "voice",
      status: "needs_review",
      transcript: "Log two extra PEX fittings on the Patel job.",
      extraction: describeLog,
    },
    {
      id: ids.receipt,
      type: "receipt",
      status: "needs_review",
      image_path: "seed/receipt-home-depot.jpg",
      extraction: receipt,
    },
    {
      id: ids.failed,
      type: "text",
      status: "failed",
      transcript: "mumble mumble unclear audio",
      error: "Could not extract structured lines.",
      extraction: null,
    },
  ];

  for (const row of rows) {
    await sql`
      INSERT INTO captures (id, contractor_id, job_id, type, status, image_path, transcript, extraction, model, error, created_at)
      VALUES (
        ${row.id},
        ${contractorId},
        NULL,
        ${row.type},
        ${row.status},
        ${row.image_path ?? null},
        ${row.transcript ?? null},
        ${row.extraction ? sql.json(row.extraction) : null},
        ${row.status === "failed" ? null : "seed"},
        ${row.error ?? null},
        ${now}
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        transcript = EXCLUDED.transcript,
        extraction = EXCLUDED.extraction,
        error = EXCLUDED.error
    `;
  }

  console.log("Seeded captures for contractor", contractorId);
  for (const [label, id] of Object.entries(ids)) {
    console.log(`  ${label}: /app/captures/${id}`);
  }
} finally {
  await sql.end();
}
