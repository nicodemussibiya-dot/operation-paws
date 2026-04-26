-- ============================================================
-- Operation PAWS — PRESIDENCY OVERSIGHT LAYER v1.0
-- "Institutional Continuity through Transparency."
-- ============================================================

-- ── 1. EXPAND ROLE ENUM ──────────────────────────────────────
-- We update the check constraint to include 'presidency_oversight'
ALTER TABLE public.paws_user_roles 
  DROP CONSTRAINT IF EXISTS paws_user_roles_role_check;

ALTER TABLE public.paws_user_roles 
  ADD CONSTRAINT paws_user_roles_role_check 
  CHECK (role IN ('officer','commissioner','auditor','breeder','intake_admin','presidency_oversight'));

-- ── 2. CREATE NATIONAL GOVERNANCE DASHBOARD (Aggregate-Only) ──
-- This function runs with SECURITY DEFINER (owner privileges) 
-- to allow oversight roles to see summaries without needing SELECT on the base tables.
CREATE OR REPLACE FUNCTION public.get_paws_national_governance_dashboard()
RETURNS TABLE (
  status text,
  risk_level text,
  source_tier text,
  dog_count bigint,
  unique_decision_makers bigint,
  last_system_activity timestamptz,
  stability_signal text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.status,
    d.risk_level,
    d.source_tier,
    COUNT(*) as dog_count,
    COUNT(DISTINCT d.commissioner_decision_by) as unique_decision_makers,
    MAX(d.updated_at) as last_system_activity,
    CASE WHEN MAX(d.updated_at) < (now() - interval '7 days') THEN 'STALE' ELSE 'ACTIVE' END as stability_signal
  FROM public.paws_dogs d
  WHERE d.is_demo = false
    AND EXISTS (
      SELECT 1 FROM public.paws_user_roles r
      WHERE r.user_id = auth.uid()
        AND r.role IN ('presidency_oversight','auditor','commissioner')
    )
  GROUP BY d.status, d.risk_level, d.source_tier;
$$;

-- ── 3. SECURE AUDIT GOVERNANCE SUMMARY ──────────────────────
CREATE OR REPLACE FUNCTION public.get_paws_audit_governance_summary()
RETURNS TABLE (
  actor_role text,
  action text,
  event_count bigint,
  last_event_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    actor_role,
    action,
    COUNT(*) as event_count,
    MAX(created_at) as last_event_at
  FROM public.paws_audit_log
  WHERE EXISTS (
    SELECT 1 FROM public.paws_user_roles r
    WHERE r.user_id = auth.uid()
      AND r.role IN ('presidency_oversight','auditor','commissioner')
  )
  GROUP BY actor_role, action;
$$;

-- ── 4. ACCESS CONTROL ────────────────────────────────────────
REVOKE ALL ON FUNCTION public.get_paws_national_governance_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_paws_national_governance_dashboard() TO authenticated;

REVOKE ALL ON FUNCTION public.get_paws_audit_governance_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_paws_audit_governance_summary() TO authenticated;

-- Ensure NO base-table SELECT for oversight roles
-- (Handled by 005_security_hardening.sql which excludes 'presidency_oversight')
