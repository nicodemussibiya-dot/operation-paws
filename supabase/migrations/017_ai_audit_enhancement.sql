-- Migration: 017_ai_audit_enhancement.sql
-- Goal: Create a secure audit trail for AI reasoning and evidence
-- This satisfies the "Evidence Pyramid" and "Audit Trail" requirements for authorities.

-- ── 1. AI AUDIT STORAGE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS paws_ai_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id uuid NOT NULL,           -- Link to the specific chat/session
  agent_id text NOT NULL,                -- e.g., 'commissioner_agent', 'welfare_officer'
  reasoning_chain jsonb NOT NULL,        -- Step-by-step logic used by AI
  evidence_pyramid jsonb NOT NULL,       -- Sources, Methodology, Confidence
  metadata jsonb DEFAULT '{}'::jsonb,    -- System info, timestamps, model IDs
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookup by interaction ID (docket number)
CREATE INDEX IF NOT EXISTS idx_ai_audit_interaction ON paws_ai_audit(interaction_id);

-- ── 2. SECURITY & RLS ────────────────────────────────────────
ALTER TABLE paws_ai_audit ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for automated logging)
CREATE POLICY "Service role full access on ai audit"
  ON paws_ai_audit
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Auditors and Commissioners can read the audit trail
CREATE POLICY "Auditors can view ai audit"
  ON paws_ai_audit
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM paws_user_roles
      WHERE user_id = auth.uid()
      AND role IN ('auditor', 'commissioner', 'presidency_oversight')
    )
  );

-- ── 3. HELPER FUNCTIONS ──────────────────────────────────────
-- Function to log an AI interaction (called from Edge Functions)
CREATE OR REPLACE FUNCTION log_ai_interaction(
  p_interaction_id uuid,
  p_agent_id text,
  p_reasoning jsonb,
  p_evidence jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO paws_ai_audit (interaction_id, agent_id, reasoning_chain, evidence_pyramid, metadata)
  VALUES (p_interaction_id, p_agent_id, p_reasoning, p_evidence, p_metadata)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Grant execute to service_role only
REVOKE ALL ON FUNCTION log_ai_interaction FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_ai_interaction TO service_role;
