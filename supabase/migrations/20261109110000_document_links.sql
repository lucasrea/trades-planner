-- Share links for quotes and invoices. The public page /d/[token] looks up by token only.
-- The app reads and writes with the server database role; RLS is on with no policy so anon and
-- authenticated Supabase roles cannot read tokens.
CREATE TABLE IF NOT EXISTS document_links (
  id TEXT PRIMARY KEY,
  contractor_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  token TEXT NOT NULL,
  revoked_at BIGINT,
  created_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS document_links_token_uniq ON document_links (token);
CREATE UNIQUE INDEX IF NOT EXISTS document_links_one_active_uniq ON document_links (document_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS document_links_contractor_idx ON document_links (contractor_id, document_id);
ALTER TABLE document_links ENABLE ROW LEVEL SECURITY;
