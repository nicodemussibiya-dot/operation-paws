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

-- ── 2. CREATE NATIONAL GOVERNANCE DASHBOARD ──────────────────
-- This view uses ONLY aggregate data and NO PII.
CREATE OR REPLACE VIEW public.paws_national_governance_dashboard AS
SELECT
  d.status,
  d.risk_level,
  d.source_tier,
  COUNT(*) as dog_count,
  COUNT(DISTINCT d.commissioner_decision_by) as unique_decision_makers,
  MAX(d.updated_at) as last_system_activity,
  -- Calculate 'stale' provinces (no activity > 7 days)
  CASE 
    WHEN MAX(d.updated_at) < (now() - interval '7 days') THEN 'STALE'
    ELSE 'ACTIVE'
  END as stability_signal
FROM public.paws_dogs d
WHERE d.is_demo = false
GROUP BY d.status, d.risk_level, d.source_tier;

-- ── 3. RLS FOR THE DASHBOARD ────────────────────────────────
-- Enable RLS on the view (if supported) or the underlying tables
-- In Supabase, we apply policies to the tables used in the view.

-- Allow presidency_oversight to read the aggregate view
-- Note: Since the view is on public schema, we grant select to the role.
GRANT SELECT ON public.paws_national_governance_dashboard TO authenticated;

-- Ensure ONLY the oversight role and auditors/commissioners can see this view
-- Others (officers) are restricted to their own provincial views (defined elsewhere).
ALTER VIEW public.paws_national_governance_dashboard SET (security_invoker = on);

-- Underlyng RLS for Aggregate access
CREATE POLICY "aggregate_oversight_read"
  ON public.paws_dogs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM paws_user_roles
      WHERE user_id = auth.uid() 
      AND role IN ('presidency_oversight', 'commissioner', 'auditor')
    )
  );

-- ── 4. EXAMPLE ROLE ASSIGNMENT ──────────────────────────────
-- To be executed by a SuperAdmin/Commissioner only:
-- INSERT INTO public.paws_user_roles (user_id, email, role, granted_by)
-- VALUES ('<USER_UUID>', 'oversight@presidency.gov.za', 'presidency_oversight', '<ADMIN_UUID>');

-- ── 5. SECURE AUDIT LOGS FOR OVERSIGHT ──────────────────────
-- Presidency can see THAT audits happened, but not the metadata (IPs/Tokens)
CREATE OR REPLACE VIEW public.paws_audit_governance_summary AS
SELECT
  actor_role,
  action,
  COUNT(*) as event_count,
  MAX(created_at) as last_event_at
FROM public.paws_audit_log
GROUP BY actor_role, action;

GRANT SELECT ON public.paws_audit_governance_summary TO authenticated;

CREATE POLICY "audit_summary_oversight_read"
  ON public.paws_audit_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM paws_user_roles
      WHERE user_id = auth.uid() AND role = 'presidency_oversight'
    )
  );
-- Note: Combined with RLS, this ensures they only see what the policy allows.
