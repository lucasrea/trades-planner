-- Job actuals: materials/expenses/labour on the job, plus receipt photos (parse later).

CREATE TABLE IF NOT EXISTS job_receipts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  contractor_id TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  vendor TEXT NOT NULL DEFAULT '',
  purchased_at TEXT,
  receipt_total DOUBLE PRECISION NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'uploaded',
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS job_costs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  contractor_id TEXT NOT NULL,
  receipt_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'material',
  description TEXT NOT NULL DEFAULT '',
  quantity DOUBLE PRECISION NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'ea',
  cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  unit_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  line_total DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS job_receipts_job_id_idx ON job_receipts (job_id);
CREATE INDEX IF NOT EXISTS job_receipts_contractor_id_idx ON job_receipts (contractor_id);
CREATE INDEX IF NOT EXISTS job_costs_job_id_idx ON job_costs (job_id);
CREATE INDEX IF NOT EXISTS job_costs_contractor_id_idx ON job_costs (contractor_id);
CREATE INDEX IF NOT EXISTS job_costs_receipt_id_idx ON job_costs (receipt_id);
