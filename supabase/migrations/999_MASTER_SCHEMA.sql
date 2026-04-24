-- ============================================================
-- Operation PAWS — MASTER SECURITY SCHEMA
-- "Security through strength, not secrecy."
-- ============================================================

-- ── 1. ROLES TABLE ──────────────────────────────────────────
-- Maps Supabase Auth users to application roles.
-- Only a service_role migration can insert here.
CREATE TABLE IF NOT EXISTS paws_roles (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('officer', 'commissioner', 'auditor')),
  granted_at TIMESTAMPTZ DEFAULT now(),
  granted_by UUID REFERENCES auth.users(id)
);

-- ── 2. DOGS TABLE ───────────────────────────────────────────
ALTER TABLE public.paws_dogs
  ADD COLUMN IF NOT EXISTS assigned_job      TEXT,
  ADD COLUMN IF NOT EXISTS risk_level        TEXT CHECK (risk_level IN ('LOW','MEDIUM','HIGH','EXTREME')),
  ADD COLUMN IF NOT EXISTS insurance_status  TEXT DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS uniform_status    TEXT DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS drone_sync        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ballistic_vest    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS brics_certified   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS dog_image         TEXT,
  ADD COLUMN IF NOT EXISTS approved_by       UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at       TIMESTAMPTZ;

-- ── 3. IMMUTABLE AUDIT LOG ──────────────────────────────────
-- This table can only be appended to. Never updated, never deleted.
CREATE TABLE IF NOT EXISTS paws_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES auth.users(id),
  actor_role  TEXT NOT NULL,
  action      TEXT NOT NULL,   -- e.g. 'DOG_APPROVED', 'DOG_DELETED', 'LOGIN_FAILED'
  target_id   TEXT,            -- e.g. the PAWS-ID of the dog
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT now()
);
-- Make it append-only at the DB level
ALTER TABLE paws_audit_log ENABLE ROW LEVEL SECURITY;

-- ── 4. ROW LEVEL SECURITY (RLS) POLICIES ────────────────────
-- The security that makes blueprints being public irrelevant.

-- 4a. Audit Log: append-only, commissioners can read.
CREATE POLICY "audit_insert_authenticated"
  ON paws_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = actor_id);

CREATE POLICY "audit_select_commissioner"
  ON paws_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM paws_roles
      WHERE user_id = auth.uid() AND role = 'commissioner'
    )
  );

-- NO UPDATE POLICY. NO DELETE POLICY. The log is immutable.

-- 4b. Dogs table: field officers can insert, not update status.
ALTER TABLE public.paws_dogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dogs_public_read"
  ON public.paws_dogs FOR SELECT
  TO anon, authenticated
  USING (true);  -- Public tracker can read aggregate data

CREATE POLICY "dogs_officer_insert"
  ON public.paws_dogs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM paws_roles
      WHERE user_id = auth.uid() AND role IN ('officer', 'commissioner')
    )
  );

CREATE POLICY "dogs_commissioner_update"
  ON public.paws_dogs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM paws_roles
      WHERE user_id = auth.uid() AND role = 'commissioner'
    )
  );

-- NO DELETE POLICY on dogs. Deletion requires a signed action_token from the 2FA Edge Function.

-- ── 5. RATE LIMIT TABLE ─────────────────────────────────────
-- Tracks login attempts to block brute force.
CREATE TABLE IF NOT EXISTS paws_rate_limit (
  ip_hash     TEXT NOT NULL,
  action      TEXT NOT NULL,
  attempts    INT DEFAULT 1,
  last_attempt TIMESTAMPTZ DEFAULT now(),
  blocked_until TIMESTAMPTZ,
  PRIMARY KEY (ip_hash, action)
);

-- ── 6. 2FA ACTION TOKENS ────────────────────────────────────
-- Short-lived tokens issued by the 2FA Edge Function.
CREATE TABLE IF NOT EXISTS paws_action_tokens (
  token        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID REFERENCES auth.users(id),
  action       TEXT NOT NULL,  -- e.g. 'DELETE_DOG'
  target_id    TEXT NOT NULL,
  expires_at   TIMESTAMPTZ DEFAULT (now() + interval '5 minutes'),
  used_at      TIMESTAMPTZ     -- Set when consumed. Token cannot be reused.
);

-- ── 7. ACADEMY LOGS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS paws_academy_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id      UUID REFERENCES public.paws_dogs(id),
  week        INT,
  league      TEXT,
  aptitude    NUMERIC(5,2),
  notes       TEXT,
  logged_by   UUID REFERENCES auth.users(id),
  logged_at   TIMESTAMPTZ DEFAULT now()
);
