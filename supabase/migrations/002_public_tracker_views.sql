-- 002_public_tracker_views.sql
-- Public tracker views — sourced EXCLUSIVELY from paws_public_dogs (zero-PII table).
-- This ensures anon access can NEVER accidentally reach paws_dogs (the private table).

-- ── 1. Public Tracker View ────────────────────────────────────
CREATE OR REPLACE VIEW public.paws_public_tracker AS
SELECT
  paws_ref,
  breed,
  status,
  intake_date,
  source_code,
  league,
  is_demo
FROM public.paws_public_dogs;

GRANT SELECT ON public.paws_public_tracker TO anon, authenticated;

-- ── 2. Public Stats View ──────────────────────────────────────
CREATE OR REPLACE VIEW public.paws_public_stats AS
SELECT
  status,
  COUNT(*) AS dog_count,
  COUNT(*) FILTER (WHERE is_demo = false) AS real_count,
  MAX(updated_at) AS last_updated
FROM public.paws_public_dogs
GROUP BY status;

GRANT SELECT ON public.paws_public_stats TO anon, authenticated;
