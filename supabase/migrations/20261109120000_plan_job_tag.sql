-- Job named in a plan, shown as a tag in the sidebar. The title stays the summary.
ALTER TABLE plans ADD COLUMN IF NOT EXISTS job_title TEXT;
