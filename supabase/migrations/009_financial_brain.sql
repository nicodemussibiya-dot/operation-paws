-- ============================================================
-- Operation PAWS — FINANCIAL BRAIN & APPROVALS v1.0
-- "Institutional ROI through Secure Approvals."
-- ============================================================

-- ── 1. FUNDING POOLS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paws_funding_pools (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    pool_type text not null check (pool_type in ('donor_restricted', 'spca_restricted', 'saps_budget', 'unrestricted_reserve')),
    amount_committed numeric default 0,
    amount_spent numeric default 0,
    amount_reserved numeric default 0,
    rules jsonb default '{"on_unspent": "carry_forward"}'::jsonb,
    created_at timestamptz default now()
);

ALTER TABLE public.paws_funding_pools ENABLE ROW LEVEL SECURITY;

-- ── 2. INTAKE PROPOSALS (The Approval Deck Backend) ──────────
CREATE TABLE IF NOT EXISTS public.paws_dog_intake_proposals (
    id uuid primary key default gen_random_uuid(),
    call_sign text not null,
    breed text not null,
    specialisation text not null,
    province text not null,
    risk_band text check (risk_band in ('low', 'medium', 'high')),
    capex_zar numeric not null,
    annual_opex_zar numeric not null,
    suggested_pool_id uuid references public.paws_funding_pools(id),
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'deferred')),
    submitted_by uuid references auth.users(id),
    decided_by uuid references auth.users(id),
    decided_at timestamptz,
    metadata jsonb default '{}'::jsonb, -- impact signal, AI summary
    created_at timestamptz default now()
);

ALTER TABLE public.paws_dog_intake_proposals ENABLE ROW LEVEL SECURITY;

-- ── 3. DOG FINANCIALS (Operational Portfolio) ────────────────
CREATE TABLE IF NOT EXISTS public.paws_dog_financials (
    dog_id uuid primary key references public.paws_dogs(id) on delete cascade,
    funding_pool_id uuid references public.paws_funding_pools(id),
    total_capex numeric default 0,
    total_opex_to_date numeric default 0,
    insured_value_zar numeric default 0,
    updated_at timestamptz default now()
);

ALTER TABLE public.paws_dog_financials ENABLE ROW LEVEL SECURITY;

-- ── 4. RLS POLICIES ──────────────────────────────────────────

-- Funding Pools: Read for Governance, Hidden for others.
CREATE POLICY "pools_governance_read" ON public.paws_funding_pools FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM paws_user_roles WHERE user_id = auth.uid() AND role IN ('commissioner', 'auditor', 'presidency_oversight'))
);

-- Intake Proposals: Users see their submissions; Governance see all.
CREATE POLICY "proposals_self_read" ON public.paws_dog_intake_proposals FOR SELECT TO authenticated USING (auth.uid() = submitted_by);
CREATE POLICY "proposals_governance_read" ON public.paws_dog_intake_proposals FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM paws_user_roles WHERE user_id = auth.uid() AND role IN ('commissioner', 'auditor', 'presidency_oversight'))
);

-- Dog Financials: Restricted to Governance.
CREATE POLICY "financials_governance_read" ON public.paws_dog_financials FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM paws_user_roles WHERE user_id = auth.uid() AND role IN ('commissioner', 'auditor', 'presidency_oversight'))
);

-- ── 5. SEED INITIAL POOLS (Example) ─────────────────────────
INSERT INTO public.paws_funding_pools (name, pool_type, amount_committed, rules)
VALUES 
  ('SAPS National K9 Vote 2026', 'saps_budget', 150000000, '{"on_unspent": "revert_to_treasury"}'),
  ('SPCA K9 Welfare Fund', 'spca_restricted', 25000000, '{"on_unspent": "carry_forward_for_welfare"}'),
  ('International Donor Pool A', 'donor_restricted', 50000000, '{"on_unspent": "return_to_donor"}')
ON CONFLICT DO NOTHING;

-- ── 6. FINANCIAL RPCs ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reserve_pool_funds(pool_id uuid, amount numeric)
RETURNS void AS $$
BEGIN
  UPDATE public.paws_funding_pools
  SET amount_reserved = amount_reserved + amount
  WHERE id = pool_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
