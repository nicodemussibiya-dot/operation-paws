-- 014_public_source_stats.sql
-- Ensures public_source_stats leaderboard view exists and is correctly sourced
-- from paws_public_dogs only (zero PII).

CREATE OR REPLACE VIEW public.public_source_stats AS
SELECT
  source_code,
  league                                                  AS tier_label,
  COUNT(*)                                                AS total_dogs,
  COUNT(*) FILTER (WHERE status IN ('approved', 'accepted', 'deployed')) AS saps_accepted,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status IN ('approved', 'accepted', 'deployed'))
    / NULLIF(COUNT(*), 0),
    1
  )                                                       AS service_rate_pct
FROM public.paws_public_dogs
WHERE source_code IS NOT NULL
GROUP BY source_code, league
ORDER BY saps_accepted DESC;

GRANT SELECT ON public.public_source_stats TO anon, authenticated;
