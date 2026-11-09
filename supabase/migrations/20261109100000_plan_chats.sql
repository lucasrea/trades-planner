-- Saved Plan conversations. Every row carries contractor_id; the app scopes every query by it.
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  contractor_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS plans_contractor_idx ON plans (contractor_id, updated_at DESC);
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS plan_messages (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  contractor_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'plan')),
  body TEXT NOT NULL,
  capture_id TEXT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS plan_messages_plan_idx ON plan_messages (contractor_id, plan_id, created_at);
ALTER TABLE plan_messages ENABLE ROW LEVEL SECURITY;
