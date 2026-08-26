-- Default new contractors to Free. Existing rows keep their current plan.

ALTER TABLE contractors ALTER COLUMN plan SET DEFAULT 'free';
