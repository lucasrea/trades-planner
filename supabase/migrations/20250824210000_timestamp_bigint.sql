-- Millisecond timestamps (Date.now()) exceed INTEGER max; use BIGINT.

ALTER TABLE users ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE clients ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE jobs ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE quotes ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE quotes ALTER COLUMN updated_at TYPE BIGINT;
ALTER TABLE invoices ALTER COLUMN created_at TYPE BIGINT;
ALTER TABLE invoices ALTER COLUMN updated_at TYPE BIGINT;
ALTER TABLE contractors ALTER COLUMN onboarding_completed_at TYPE BIGINT;
