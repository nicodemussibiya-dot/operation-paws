-- ============================================================
-- Operation PAWS — SECURITY HARDENING v1.0
-- "Sealing the perimeter."
-- ============================================================

-- ── 1. TIGHTEN DOG PII ACCESS ────────────────────────────────
-- Drop the permissive policy that allowed ANY authenticated user to see PII
DROP POLICY IF EXISTS "dogs_officer_read" ON public.paws_dogs;

-- Create restricted policy: only specific roles can see full dog data
CREATE POLICY "dogs_role_restricted_read"
  ON public.paws_dogs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM paws_user_roles
      WHERE user_id = auth.uid() 
      AND role IN ('officer', 'commissioner', 'auditor', 'intake_admin')
    )
  );

-- ── 2. SECURE ROLE MANAGEMENT ───────────────────────────────
ALTER TABLE public.paws_user_roles ENABLE ROW LEVEL SECURITY;

-- Users can see their own role
CREATE POLICY "roles_self_read"
  ON public.paws_user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Commissioners and Auditors can see everyone's role
CREATE POLICY "roles_admin_read"
  ON public.paws_user_roles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM paws_user_roles
      WHERE user_id = auth.uid() AND role IN ('commissioner', 'auditor')
    )
  );

-- Only Commissioners can grant/change roles
CREATE POLICY "roles_commissioner_all"
  ON public.paws_user_roles FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM paws_user_roles
      WHERE user_id = auth.uid() AND role = 'commissioner'
    )
  );

-- ── 3. SECURE ACADEMY LOGS ──────────────────────────────────
ALTER TABLE public.paws_academy_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_staff_read"
  ON public.paws_academy_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM paws_user_roles
      WHERE user_id = auth.uid() AND role IN ('officer', 'commissioner', 'auditor')
    )
  );

CREATE POLICY "academy_officer_insert"
  ON public.paws_academy_logs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM paws_user_roles
      WHERE user_id = auth.uid() AND role IN ('officer', 'commissioner')
    )
  );

-- ── 4. SECURE SECURITY TABLES ───────────────────────────────
-- Rate limit data should only be accessible by the system/admin
ALTER TABLE public.paws_rate_limit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate_limit_admin" ON public.paws_rate_limit 
  FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM paws_user_roles WHERE user_id = auth.uid() AND role = 'commissioner'));

-- Action tokens (2FA) should be private to the actor or admin
ALTER TABLE public.paws_action_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tokens_self_or_admin" ON public.paws_action_tokens
  FOR SELECT TO authenticated
  USING (
    auth.uid() = actor_id OR 
    EXISTS (SELECT 1 FROM paws_user_roles WHERE user_id = auth.uid() AND role = 'commissioner')
  );

-- ── 5. UPDATE AUDIT LOGS ─────────────────────────────────────
-- Add Auditor to the read policy
DROP POLICY IF EXISTS "audit_select_commissioner" ON paws_audit_log;
CREATE POLICY "audit_select_authorized"
  ON paws_audit_log FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM paws_user_roles WHERE user_id = auth.uid() AND role IN ('commissioner', 'auditor'))
  );
