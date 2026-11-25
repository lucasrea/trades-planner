-- Choices the Plan offers with a question ("Which job?"), so they still show after a refresh.
-- Only adds a column. Row Level Security is already on for plan_messages.
ALTER TABLE plan_messages ADD COLUMN IF NOT EXISTS options jsonb;
