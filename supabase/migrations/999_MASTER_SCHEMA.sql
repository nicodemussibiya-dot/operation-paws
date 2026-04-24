-- ============================================================
-- Operation PAWS — MASTER SECURITY SCHEMA v3.0
-- "Security through strength, not secrecy."
-- All changes to this file require CODEOWNER approval.
-- ============================================================

-- ── 1. ROLES TABLE ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS paws_user_roles (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  role       TEXT NOT NULL CHECK (role IN ('officer','commissioner','auditor','breeder','intake_admin')),
  granted_at TIMESTAMPTZ DEFAULT now(),
  granted_by UUID REFERENCES auth.users(id)
);

-- ── 2. PRIVATE DOGS TABLE (PII — never exposed to anon) ─────
-- Contains microchip, owner, biometric data.
-- RLS: authenticated officers/commissioners only.
ALTER TABLE public.paws_dogs
  ADD COLUMN IF NOT EXISTS source_code      TEXT,         -- e.g. BR012 (anonymized)
  ADD COLUMN IF NOT EXISTS source_tier      TEXT DEFAULT 'T3',
  ADD COLUMN IF NOT EXISTS photo_urls       TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS intake_notes     TEXT,
  ADD COLUMN IF NOT EXISTS biometric_id     TEXT,         -- SHA256 of facial scan hash
  ADD COLUMN IF NOT EXISTS assigned_job     TEXT,
  ADD COLUMN IF NOT EXISTS risk_level       TEXT CHECK (risk_level IN ('LOW','MEDIUM','HIGH','EXTREME')),
  ADD COLUMN IF NOT EXISTS commissioner_decision    TEXT,
  ADD COLUMN IF NOT EXISTS commissioner_notes       TEXT,
  ADD COLUMN IF NOT EXISTS commissioner_decision_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS commissioner_decision_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_by      UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ;

ALTER TABLE public.paws_dogs ENABLE ROW LEVEL SECURITY;

-- Private: authenticated roles only — NO anon access
CREATE POLICY "dogs_officer_read"
  ON public.paws_dogs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "dogs_officer_insert"
  ON public.paws_dogs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM paws_user_roles
      WHERE user_id = auth.uid() AND role IN ('officer','commissioner','intake_admin')
    )
  );

CREATE POLICY "dogs_commissioner_update"
  ON public.paws_dogs FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM paws_user_roles
      WHERE user_id = auth.uid() AND role = 'commissioner'
    )
  );

-- NO DELETE POLICY. Deletion requires a signed 2FA action_token.

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

-- ── 4. SOURCE LEADERBOARD VIEW (merit-based, non-gameable) ──
CREATE OR REPLACE VIEW public.public_source_stats AS
SELECT
  COALESCE(source_code, 'UNKNOWN') AS source_code,
  COUNT(*)                         AS candidates_sent,
  COUNT(*) FILTER (WHERE status IN ('approved','accepted','deployed')) AS saps_accepted,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status IN ('approved','accepted','deployed'))
    / NULLIF(COUNT(*), 0), 1
  )                                AS service_rate_pct,
  CASE
    WHEN COUNT(*) FILTER (WHERE status IN ('approved','accepted','deployed')) >= 10
         AND ROUND(100.0 * COUNT(*) FILTER (WHERE status IN ('approved','accepted','deployed')) / NULLIF(COUNT(*),0),1) >= 30
    THEN 'Premier Partner'
    WHEN COUNT(*) FILTER (WHERE status IN ('approved','accepted','deployed')) >= 5
         AND ROUND(100.0 * COUNT(*) FILTER (WHERE status IN ('approved','accepted','deployed')) / NULLIF(COUNT(*),0),1) >= 20
    THEN 'Gold'
    WHEN COUNT(*) FILTER (WHERE status IN ('approved','accepted','deployed')) >= 2
    THEN 'Silver'
    ELSE 'Standard'
  END                              AS tier_label
FROM public.paws_public_dogs
GROUP BY 1
ORDER BY saps_accepted DESC, service_rate_pct DESC;

GRANT SELECT ON public.public_source_stats TO anon, authenticated;

-- ── 5. SEED 500 DEMO DOGS (marked is_demo = true) ───────────
INSERT INTO public.paws_public_dogs (paws_ref, breed, status, intake_date, source_code, league, is_demo)
SELECT
  'PAWS-26-' || LPAD(gs::text, 5, '0'),
  (ARRAY['Belgian Malinois','German Shepherd','Labrador','Dutch Shepherd'])[1 + (random()*3)::int],
  (ARRAY['lead','pending_commissioner','approved','accepted','training','deployed'])[1 + (random()*5)::int],
  (DATE '2026-01-01' + ((random()*110)::int)),
  'BR' || LPAD((1 + (random()*49)::int)::text, 3, '0'),
  (ARRAY['Narcotics','Explosives','Tracking','Search & Rescue'])[1 + (random()*3)::int],
  true
FROM generate_series(1, 500) gs
ON CONFLICT (paws_ref) DO NOTHING;

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
CREATE POLICY "escrow_read_authenticated" ON public.paws_escrow FOR SELECT TO authenticated USING (true);

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
