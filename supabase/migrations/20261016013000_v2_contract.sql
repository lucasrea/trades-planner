BEGIN;

INSERT INTO jobs (id, contractor_id, client_id, title, status, site_address, notes, created_at, updated_at)
SELECT 'job_imp_' || q.id, q.contractor_id, q.client_id, 'Imported ' || q.quote_number, 'quoted', '', '', q.created_at, q.created_at
FROM quotes q
WHERE q.job_id IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE quotes SET job_id = 'job_imp_' || id WHERE job_id IS NULL;

INSERT INTO jobs (id, contractor_id, client_id, title, status, site_address, notes, created_at, updated_at)
SELECT 'job_imp_' || i.id, i.contractor_id, i.client_id, 'Imported ' || i.invoice_number, 'active', '', '', i.created_at, i.created_at
FROM invoices i
WHERE i.job_id IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE invoices SET job_id = 'job_imp_' || id WHERE job_id IS NULL;

INSERT INTO documents (id, contractor_id, client_id, job_id, type, number, status, notes, valid_until, subtotal, tax, total, created_at, updated_at)
SELECT id, contractor_id, client_id, job_id, 'quote', quote_number, status, notes, valid_until, subtotal, tax, total, created_at, updated_at
FROM quotes
ON CONFLICT (id) DO NOTHING;

INSERT INTO documents (id, contractor_id, client_id, job_id, type, number, status, notes, due_date, source_quote_id, subtotal, tax, total, created_at, updated_at)
SELECT id, contractor_id, client_id, job_id, 'invoice', invoice_number, CASE WHEN status = 'overdue' THEN 'sent' ELSE status END, notes, due_date, quote_id, subtotal, tax, total, created_at, updated_at
FROM invoices
ON CONFLICT (id) DO NOTHING;

INSERT INTO line_items (id, contractor_id, job_id, document_id, sort_order, kind, description, quantity, unit, unit_price, line_total, created_at)
SELECT l.id, q.contractor_id, q.job_id, l.quote_id, l.sort_order, l.kind, l.description, l.quantity, l.unit, l.unit_price, l.line_total, q.created_at
FROM quote_line_items l
JOIN quotes q ON q.id = l.quote_id
ON CONFLICT (id) DO NOTHING;

INSERT INTO line_items (id, contractor_id, job_id, document_id, sort_order, kind, description, quantity, unit, unit_price, line_total, created_at)
SELECT l.id, i.contractor_id, i.job_id, l.invoice_id, l.sort_order, l.kind, l.description, l.quantity, l.unit, l.unit_price, l.line_total, i.created_at
FROM invoice_line_items l
JOIN invoices i ON i.id = l.invoice_id
ON CONFLICT (id) DO NOTHING;

INSERT INTO line_items (id, contractor_id, job_id, document_id, sort_order, kind, description, quantity, unit, unit_cost, unit_price, line_total, created_at)
SELECT 'jc_' || c.id, c.contractor_id, c.job_id, NULL, c.sort_order, CASE WHEN c.kind = 'expense' THEN 'other' ELSE c.kind END, c.description, c.quantity, c.unit, c.cost, c.unit_price, c.line_total, c.created_at
FROM job_costs c
WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.job_id = c.job_id)
ON CONFLICT (id) DO NOTHING;

UPDATE jobs SET status = 'done' WHERE status IN ('completed', 'archived');
ALTER TABLE jobs DROP COLUMN IF EXISTS target_date;

ALTER TABLE contractors DROP COLUMN IF EXISTS plan;
ALTER TABLE contractors DROP COLUMN IF EXISTS stripe_subscription_id;

DROP TABLE IF EXISTS invoice_line_items;
DROP TABLE IF EXISTS quote_line_items;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS quotes;
DROP TABLE IF EXISTS job_costs;
DROP TABLE IF EXISTS job_receipts;

COMMIT;
