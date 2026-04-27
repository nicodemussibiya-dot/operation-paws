-- 001_ops_tables.sql
-- Core tables for Operation PAWS operations.
-- These tables should be private/protected via RLS.

-- ── 1. USER ROLES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paws_user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('officer','commissioner','auditor','breeder','intake_admin','presidency_oversight','partner')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, role)
);

-- Dogs table (Sensitive info)
CREATE TABLE IF NOT EXISTS public.paws_dogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paws_ref TEXT UNIQUE NOT NULL,
    microchip_number TEXT,
    name TEXT,
    breed TEXT,
    dob DATE,
    owner_name TEXT,
    owner_contact TEXT,
    status TEXT DEFAULT 'lead', -- lead, screened, assessed, accepted, deployed, rejected
    
    -- Added for coherence with later migrations:
    risk_level TEXT DEFAULT 'MEDIUM',
    source_tier TEXT DEFAULT 'T3',
    is_demo BOOLEAN DEFAULT false,
    
    -- Decision fields
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    commissioner_decision TEXT, -- approved, rejected
    commissioner_decision_at TIMESTAMPTZ,
    commissioner_decision_by UUID REFERENCES auth.users(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assessment logs
CREATE TABLE IF NOT EXISTS paws_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dog_id UUID REFERENCES paws_dogs(id),
    assessor_name TEXT,
    outcome TEXT,
    notes TEXT,
    assessment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Donation logs (Fiat)
CREATE TABLE IF NOT EXISTS paws_donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_name TEXT,
    amount DECIMAL,
    currency TEXT DEFAULT 'ZAR',
    purpose TEXT,
    transaction_ref TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- Default policy: Deny all to anon, allow all to service_role/authenticated admins
-- (Add specific admin roles as needed)


-- ── 3. PUBLIC DOGS TABLE (newspaper-safe, zero PII) ─────────
CREATE TABLE IF NOT EXISTS public.paws_public_dogs (
  paws_ref      TEXT PRIMARY KEY,
  breed         TEXT,
  status        TEXT,
  intake_date   DATE DEFAULT CURRENT_DATE,
  source_code   TEXT,   -- e.g. BR012 — no name, no address
  league        TEXT,   -- e.g. Narcotics, Tracking
  is_demo       BOOLEAN DEFAULT false,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.paws_public_dogs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_dogs_read"
  ON public.paws_public_dogs FOR SELECT TO anon, authenticated
  USING (true);


-- ── 6. IMMUTABLE AUDIT LOG ───────────────────────────────────
CREATE TABLE IF NOT EXISTS paws_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES auth.users(id),
  actor_role  TEXT NOT NULL,
  action      TEXT NOT NULL,
  target_id   TEXT,
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE paws_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_insert_authenticated"
  ON paws_audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = actor_id);

CREATE POLICY "audit_select_commissioner"
  ON paws_audit_log FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM paws_user_roles WHERE user_id = auth.uid() AND role = 'commissioner')
  );
-- NO UPDATE. NO DELETE. Append-only by design.


-- ── 7. RATE LIMIT ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS paws_rate_limit (
  ip_hash      TEXT NOT NULL,
  action       TEXT NOT NULL,
  attempts     INT DEFAULT 1,
  last_attempt TIMESTAMPTZ DEFAULT now(),
  blocked_until TIMESTAMPTZ,
  PRIMARY KEY (ip_hash, action)
);


-- ── 8. 2FA ACTION TOKENS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS paws_action_tokens (
  token      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   UUID REFERENCES auth.users(id),
  action     TEXT NOT NULL,
  target_id  TEXT NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '5 minutes'),
  used_at    TIMESTAMPTZ
);


-- ── 9. ACADEMY / LEAGUE LOGS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS paws_academy_logs (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id    UUID REFERENCES public.paws_dogs(id),
  week      INT,
  league    TEXT,
  aptitude  NUMERIC(5,2),
  notes     TEXT,
  logged_by UUID REFERENCES auth.users(id),
  logged_at TIMESTAMPTZ DEFAULT now()
);


-- ── 10. NATIONAL ESCROW ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paws_escrow (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_name TEXT NOT NULL,
  amount_zar   NUMERIC(15,2) NOT NULL,
  status       TEXT DEFAULT 'SECURED',
  purpose      TEXT,
  audited_at   TIMESTAMPTZ DEFAULT now(),
  created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.paws_escrow ENABLE ROW LEVEL SECURITY;
CREATE POLICY "escrow_read_authorized" ON public.paws_escrow FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM paws_user_roles WHERE user_id = auth.uid() AND role IN ('commissioner', 'auditor', 'partner'))
);


-- ── 11. DEAD MAN'S SWITCH ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paws_dead_mans_switch (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commissioner_id UUID REFERENCES auth.users(id),
  last_check_in   TIMESTAMPTZ DEFAULT now(),
  trigger_delay   INTERVAL DEFAULT '7 days',
  deputy_id       UUID REFERENCES auth.users(id),
  status          TEXT DEFAULT 'ARMED',
  triggered_at    TIMESTAMPTZ
);
ALTER TABLE public.paws_dead_mans_switch ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dms_commissioner_manage" ON public.paws_dead_mans_switch
  FOR ALL TO authenticated USING (auth.uid() = commissioner_id);


-- ── 12. SYSTEM FALLBACKS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paws_fallbacks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   TEXT NOT NULL,
  severity     TEXT CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  action_taken TEXT,
  resolved     BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.paws_fallbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fallbacks_read_commissioner" ON public.paws_fallbacks
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM paws_user_roles WHERE user_id = auth.uid() AND role = 'commissioner')
  );