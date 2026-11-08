-- Private Storage bucket for receipt photos. Object key: receipts/{contractor_id}/{capture_id}.jpg
-- The app reads and writes with the service role key only, so no storage.objects policies are added:
-- with RLS on and no policy, anon and authenticated users cannot read or write these objects.
-- Guarded so plain Postgres (CI, local) without the Supabase storage schema still applies cleanly.
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('receipts', 'receipts', false, 4194304, ARRAY['image/jpeg', 'image/png', 'image/webp'])
    ON CONFLICT (id) DO NOTHING;
  END IF;
END
$$;
