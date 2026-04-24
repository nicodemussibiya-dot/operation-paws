-- 002_public_tracker_views.sql
-- Anonymized views for the public-facing tracker.
-- These views are safe for public consumption.

CREATE OR REPLACE VIEW paws_public_tracker AS
SELECT 
    paws_ref,
    breed,
    status,
    created_at::DATE as intake_date
FROM paws_dogs
ORDER BY created_at DESC;

-- Grant access to anon for the tracker view
GRANT SELECT ON paws_public_tracker TO anon;

-- Summary counts for the dashboard
CREATE OR REPLACE VIEW paws_public_stats AS
SELECT 
    status,
    COUNT(*) as total
FROM paws_dogs
GROUP BY status;

GRANT SELECT ON paws_public_stats TO anon;
