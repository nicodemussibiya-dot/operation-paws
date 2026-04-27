-- Migration: 012_totp_secrets.sql (IDEMPOTENT VERSION)
-- Goal: Create secure storage and RPC for Commissioner TOTP secrets
-- SECURITY: Secrets are encrypted at rest using AES-256-GCM via pgcrypto

-- Ensure pgcrypto extension is available for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ENCRYPTION KEY STORAGE
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Store the master encryption key (ONE row only, service_role only)
CREATE TABLE IF NOT EXISTS paws_config (
  key_name TEXT PRIMARY KEY,
  key_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE paws_config ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure clean state
DROP POLICY IF EXISTS "service_role_config_access" ON paws_config;
CREATE POLICY "service_role_config_access"
  ON paws_config
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "no_public_config_access" ON paws_config;
CREATE POLICY "no_public_config_access"
  ON paws_config
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- Function to set encryption key (run once during setup)
CREATE OR REPLACE FUNCTION set_totp_encryption_key(p_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF length(p_key) < 16 THEN
    RAISE EXCEPTION 'Encryption key must be at least 16 characters';
  END IF;
  
  INSERT INTO paws_config (key_name, key_value)
  VALUES ('totp_encryption_key', p_key)
  ON CONFLICT (key_name)
  DO UPDATE SET 
    key_value = p_key,
    updated_at = now();
END;
$$;

-- Function to get encryption key (internal use only)
CREATE OR REPLACE FUNCTION get_totp_encryption_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT;
BEGIN
  SELECT key_value INTO v_key
  FROM paws_config
  WHERE key_name = 'totp_encryption_key';
  
  RETURN v_key;
END;
$$;

-- Lock down these functions
REVOKE ALL ON FUNCTION set_totp_encryption_key(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_totp_encryption_key(TEXT) TO service_role;

REVOKE ALL ON FUNCTION get_totp_encryption_key() FROM PUBLIC;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TOTP SECRETS TABLE (Encrypted)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS paws_totp_secrets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  secret_encrypted bytea NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE paws_totp_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on totp secrets" ON paws_totp_secrets;
CREATE POLICY "Service role full access on totp secrets"
  ON paws_totp_secrets
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "No direct access for authenticated users" ON paws_totp_secrets;
CREATE POLICY "No direct access for authenticated users"
  ON paws_totp_secrets
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STORE/RETRIEVE FUNCTIONS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION store_commissioner_totp_secret(
  p_user_id uuid,
  p_plaintext_secret text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encryption_key text;
BEGIN
  v_encryption_key := get_totp_encryption_key();
  
  IF v_encryption_key IS NULL THEN
    RETURN '{"success": false, "error": "Encryption key not configured"}';
  END IF;
  
  IF length(v_encryption_key) < 16 THEN
    RETURN '{"success": false, "error": "Encryption key too short"}';
  END IF;

  INSERT INTO paws_totp_secrets (user_id, secret_encrypted)
  VALUES (
    p_user_id,
    pgp_sym_encrypt(p_plaintext_secret, v_encryption_key, 'cipher-algo=aes256')
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    secret_encrypted = pgp_sym_encrypt(p_plaintext_secret, v_encryption_key, 'cipher-algo=aes256'),
    updated_at = now();

  RETURN '{"success": true}';
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION get_commissioner_totp_secret(uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret_encrypted bytea;
  v_encryption_key text;
  v_decrypted_secret text;
BEGIN
  v_encryption_key := get_totp_encryption_key();
  
  IF v_encryption_key IS NULL THEN
    RETURN '{"error": "Encryption key not configured"}';
  END IF;

  IF length(v_encryption_key) < 16 THEN
    RETURN '{"error": "Encryption key invalid"}';
  END IF;

  SELECT secret_encrypted INTO v_secret_encrypted
  FROM paws_totp_secrets
  WHERE user_id = uid;

  IF v_secret_encrypted IS NULL THEN
    RETURN '{"error": "Secret not found"}';
  END IF;

  BEGIN
    v_decrypted_secret := pgp_sym_decrypt(v_secret_encrypted, v_encryption_key);
  EXCEPTION WHEN OTHERS THEN
    RETURN '{"error": "Decryption failed"}';
  END;

  RETURN json_build_object('secret', v_decrypted_secret);
END;
$$;

REVOKE ALL ON FUNCTION store_commissioner_totp_secret(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION store_commissioner_totp_secret(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION store_commissioner_totp_secret(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION get_commissioner_totp_secret(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_commissioner_totp_secret(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION get_commissioner_totp_secret(uuid) TO service_role;
