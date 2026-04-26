-- ============================================================
-- Operation PAWS — GOVERNANCE LOOP & IDENTITY v1.0
-- "AI proposes, Humans authorize, System enforces."
-- ============================================================

-- ── 1. ROLE CHANGE PROPOSALS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paws_role_change_proposals (
    id uuid primary key default gen_random_uuid(),
    target_user uuid not null references auth.users (id),
    target_email text,
    current_role text,
    proposed_role text not null check (proposed_role in ('officer','commissioner','auditor','breeder','intake_admin','presidency_oversight')),
    source text not null check (source in ('ai_detector', 'human_governance')),
    requested_by uuid references auth.users (id),
    justification text,
    evidence_url text,
    evidence_excerpt text,
    status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
    decided_by uuid references auth.users (id),
    decided_at timestamptz,
    decision_note text,
    created_at timestamptz not null default now(),
    metadata jsonb not null default '{}'::jsonb
);

ALTER TABLE public.paws_role_change_proposals ENABLE ROW LEVEL SECURITY;

-- ── 2. KYC ASSERTIONS (Identity Verification) ────────────────
CREATE TABLE IF NOT EXISTS public.paws_kyc_assertions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  provider text not null,
  provider_reference text not null,
  verified_name text,
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

ALTER TABLE public.paws_kyc_assertions ENABLE ROW LEVEL SECURITY;

-- ── 3. RLS POLICIES ──────────────────────────────────────────

-- Proposals: Users see their own; Governance roles see all.
CREATE POLICY "proposals_self_read" ON public.paws_role_change_proposals
  FOR SELECT TO authenticated USING (auth.uid() = target_user);

CREATE POLICY "proposals_governance_read" ON public.paws_role_change_proposals
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM paws_user_roles WHERE user_id = auth.uid() AND role IN ('commissioner','presidency_oversight','auditor'))
  );

CREATE POLICY "proposals_governance_insert" ON public.paws_role_change_proposals
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM paws_user_roles WHERE user_id = auth.uid() AND role IN ('commissioner','presidency_oversight','auditor'))
  );

-- KYC: Users see their own; Governance roles see all.
CREATE POLICY "kyc_self_read" ON public.paws_kyc_assertions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "kyc_governance_read" ON public.paws_kyc_assertions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM paws_user_roles WHERE user_id = auth.uid() AND role IN ('commissioner','presidency_oversight','auditor'))
  );
