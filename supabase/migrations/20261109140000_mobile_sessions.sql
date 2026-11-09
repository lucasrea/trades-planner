CREATE TABLE mobile_sessions (
  id text PRIMARY KEY,
  contractor_id text NOT NULL,
  user_id text NOT NULL,
  token_hash text NOT NULL,
  created_at bigint NOT NULL,
  expires_at bigint NOT NULL
);

CREATE INDEX mobile_sessions_token_hash_idx ON mobile_sessions (token_hash);

ALTER TABLE mobile_sessions ENABLE ROW LEVEL SECURITY;
