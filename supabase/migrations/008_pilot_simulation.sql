-- ============================================================
-- Operation PAWS — PILOT SIMULATION v1.0
-- "Stress Testing the National K9 League."
-- ============================================================

-- ── 1. UPDATE DOGS FOR COHORT TRACKING ───────────────────────
ALTER TABLE public.paws_dogs ADD COLUMN IF NOT EXISTS cohort text DEFAULT 'pilot' CHECK (cohort IN ('pilot', 'league'));

-- ── 2. DOG OPERATIONS (Operational History) ──────────────────
CREATE TABLE IF NOT EXISTS public.paws_dog_operations (
    id uuid primary key default gen_random_uuid(),
    dog_id uuid not null references public.paws_dogs(id),
    operation_date timestamptz not null default now(),
    operation_type text not null, -- patrol, raid, SAR, checkpoint, etc.
    province text not null,
    risk_level text not null check (risk_level in ('low', 'medium', 'high')),
    suspects_arrested int default 0,
    contraband_value_zar numeric default 0,
    firearms_recovered int default 0,
    persons_located int default 0,
    officer_injuries int default 0,
    civilian_injuries int default 0,
    civilian_deaths int default 0,
    notes_sanitized text,
    created_at timestamptz default now()
);

ALTER TABLE public.paws_dog_operations ENABLE ROW LEVEL SECURITY;

-- ── 3. INSURANCE & LOSS EVENTS ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paws_dog_insurance_events (
    id uuid primary key default gen_random_uuid(),
    dog_id uuid not null references public.paws_dogs(id),
    event_date timestamptz not null default now(),
    premium_paid_zar numeric not null,
    claim_flag boolean default false,
    claim_amount_zar numeric default 0,
    claim_reason text, -- death, injury, third_party_damage
    mitigation_features jsonb default '{}'::jsonb,
    created_at timestamptz default now()
);

ALTER TABLE public.paws_dog_insurance_events ENABLE ROW LEVEL SECURITY;

-- ── 4. SYSTEM STATE (The Phase Switch) ────────────────────────
CREATE TABLE IF NOT EXISTS public.paws_system_state (
    id int primary key default 1 check (id = 1),
    phase text not null default 'pilot' check (phase in ('pilot', 'closeout', 'league')),
    pilot_target int not null default 500,
    pilot_dogs_count int not null default 0,
    pilot_completed_at timestamptz,
    updated_at timestamptz default now()
);

INSERT INTO public.paws_system_state (id, phase) VALUES (1, 'pilot') ON CONFLICT (id) DO NOTHING;

-- ── 5. RLS POLICIES ──────────────────────────────────────────

-- Operations: Read-only for all authenticated (anonymized fields), Managed by Officers.
CREATE POLICY "ops_read_all" ON public.paws_dog_operations FOR SELECT TO authenticated USING (true);
CREATE POLICY "ops_insert_officer" ON public.paws_dog_operations FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM paws_user_roles WHERE user_id = auth.uid() AND role IN ('officer', 'commissioner'))
);

-- Insurance: Restricted to Auditors and Commissioners.
CREATE POLICY "insurance_read_governance" ON public.paws_dog_insurance_events FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM paws_user_roles WHERE user_id = auth.uid() AND role IN ('commissioner', 'auditor', 'presidency_oversight'))
);

-- System State: Read for all, Write for Commissioner/Oversight only.
CREATE POLICY "state_read_all" ON public.paws_system_state FOR SELECT TO authenticated USING (true);
CREATE POLICY "state_update_governance" ON public.paws_system_state FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM paws_user_roles WHERE user_id = auth.uid() AND role IN ('commissioner', 'presidency_oversight'))
);
