ALTER TABLE document_links ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;
ALTER TABLE document_links ADD COLUMN IF NOT EXISTS attempt_window_start bigint;
