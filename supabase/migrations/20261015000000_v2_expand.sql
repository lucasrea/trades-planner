BEGIN;

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  contractor_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  type TEXT NOT NULL,
  number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT NOT NULL DEFAULT '',
  valid_until TEXT,
  due_date TEXT,
  source_quote_id TEXT,
  subtotal DOUBLE PRECISION NOT NULL DEFAULT 0,
  tax DOUBLE PRECISION NOT NULL DEFAULT 0,
  total DOUBLE PRECISION NOT NULL DEFAULT 0,
  sent_at BIGINT,
  closed_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS documents_contractor_number_uniq ON documents (contractor_id, number);
CREATE INDEX IF NOT EXISTS documents_job_idx ON documents (job_id);
CREATE INDEX IF NOT EXISTS documents_contractor_type_idx ON documents (contractor_id, type, status);
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS line_items (
  id TEXT PRIMARY KEY,
  contractor_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  document_id TEXT,
  billed_document_id TEXT,
  capture_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'material',
  description TEXT NOT NULL DEFAULT '',
  quantity DOUBLE PRECISION NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'ea',
  unit_cost DOUBLE PRECISION,
  unit_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  line_total DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS line_items_job_idx ON line_items (job_id);
CREATE INDEX IF NOT EXISTS line_items_document_idx ON line_items (document_id);
CREATE INDEX IF NOT EXISTS line_items_contractor_idx ON line_items (contractor_id);
ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS captures (
  id TEXT PRIMARY KEY,
  contractor_id TEXT NOT NULL,
  job_id TEXT,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  image_path TEXT,
  transcript TEXT,
  extraction JSONB,
  model TEXT,
  error TEXT,
  created_at BIGINT NOT NULL,
  confirmed_at BIGINT
);
CREATE INDEX IF NOT EXISTS captures_contractor_idx ON captures (contractor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS captures_job_idx ON captures (job_id);
ALTER TABLE captures ENABLE ROW LEVEL SECURITY;

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_at BIGINT;
UPDATE jobs SET updated_at = created_at WHERE updated_at IS NULL;
ALTER TABLE jobs ALTER COLUMN updated_at SET DEFAULT ((extract(epoch FROM now()) * 1000)::bigint);
ALTER TABLE jobs ALTER COLUMN updated_at SET NOT NULL;
UPDATE jobs SET status = 'done' WHERE status IN ('completed', 'archived');

INSERT INTO jobs (id, contractor_id, client_id, title, status, site_address, notes, created_at, updated_at)
SELECT 'job_imp_' || q.id, q.contractor_id, q.client_id, 'Imported ' || q.quote_number, 'quoted', '', '', q.created_at, q.created_at
FROM quotes q WHERE q.job_id IS NULL ON CONFLICT (id) DO NOTHING;
UPDATE quotes SET job_id = 'job_imp_' || id WHERE job_id IS NULL;

INSERT INTO jobs (id, contractor_id, client_id, title, status, site_address, notes, created_at, updated_at)
SELECT 'job_imp_' || i.id, i.contractor_id, i.client_id, 'Imported ' || i.invoice_number, 'active', '', '', i.created_at, i.created_at
FROM invoices i WHERE i.job_id IS NULL ON CONFLICT (id) DO NOTHING;
UPDATE invoices SET job_id = 'job_imp_' || id WHERE job_id IS NULL;

INSERT INTO documents (id, contractor_id, client_id, job_id, type, number, status, notes, valid_until, subtotal, tax, total, created_at, updated_at)
SELECT id, contractor_id, client_id, job_id, 'quote', quote_number, status, notes, valid_until, subtotal, tax, total, created_at, updated_at
FROM quotes ON CONFLICT (id) DO NOTHING;

INSERT INTO documents (id, contractor_id, client_id, job_id, type, number, status, notes, due_date, source_quote_id, subtotal, tax, total, created_at, updated_at)
SELECT id, contractor_id, client_id, job_id, 'invoice', invoice_number, CASE WHEN status = 'overdue' THEN 'sent' ELSE status END, notes, due_date, quote_id, subtotal, tax, total, created_at, updated_at
FROM invoices ON CONFLICT (id) DO NOTHING;

INSERT INTO line_items (id, contractor_id, job_id, document_id, sort_order, kind, description, quantity, unit, unit_price, line_total, created_at)
SELECT l.id, q.contractor_id, q.job_id, l.quote_id, l.sort_order, l.kind, l.description, l.quantity, l.unit, l.unit_price, l.line_total, q.created_at
FROM quote_line_items l JOIN quotes q ON q.id = l.quote_id ON CONFLICT (id) DO NOTHING;

INSERT INTO line_items (id, contractor_id, job_id, document_id, sort_order, kind, description, quantity, unit, unit_price, line_total, created_at)
SELECT l.id, i.contractor_id, i.job_id, l.invoice_id, l.sort_order, l.kind, l.description, l.quantity, l.unit, l.unit_price, l.line_total, i.created_at
FROM invoice_line_items l JOIN invoices i ON i.id = l.invoice_id ON CONFLICT (id) DO NOTHING;

INSERT INTO line_items (id, contractor_id, job_id, document_id, sort_order, kind, description, quantity, unit, unit_cost, unit_price, line_total, created_at)
SELECT 'jc_' || c.id, c.contractor_id, c.job_id, NULL, c.sort_order, CASE WHEN c.kind = 'expense' THEN 'other' ELSE c.kind END, c.description, c.quantity, c.unit, c.cost, c.unit_price, c.line_total, c.created_at
FROM job_costs c WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.job_id = c.job_id) ON CONFLICT (id) DO NOTHING;

COMMIT;
