-- Migration: 012_totp_secrets.sql
-- Goal: Create secure storage and RPC for Commissioner TOTP secrets

CREATE TABLE IF NOT EXISTS paws_totp_secrets (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    secret text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Completely lock down the table (only service role can access)
ALTER TABLE paws_totp_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on totp secrets"
    ON paws_totp_secrets
    TO service_role
    USING (true)
    WITH CHECK (true);

-- RPC for paws-2fa-verify to fetch the secret securely
CREATE OR REPLACE FUNCTION get_commissioner_totp_secret(uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Run as DB owner to bypass RLS for internal lookup
AS $$
DECLARE
    v_secret text;
BEGIN
    SELECT secret INTO v_secret FROM paws_totp_secrets WHERE user_id = uid;
    IF v_secret IS NULL THEN
        RETURN '{"error": "Secret not found"}';
    END IF;
    RETURN json_build_object('secret', v_secret);
END;
$$;
