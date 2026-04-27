-- Migration: 012_totp_secrets.sql
-- Goal: Create secure storage and RPC for Commissioner TOTP secrets
-- SECURITY: Secrets are encrypted at rest using AES-256-GCM via pgcrypto

-- Ensure pgcrypto extension is available for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS paws_totp_secrets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  secret_encrypted bytea NOT NULL,  -- AES-256 encrypted secret (NOT plaintext!)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Completely lock down the table (only service role can access)
ALTER TABLE paws_totp_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on totp secrets"
  ON paws_totp_secrets
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Block all access for authenticated users (they must use RPC)
CREATE POLICY "No direct access for authenticated users"
  ON paws_totp_secrets
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Function to store TOTP secret (encrypts before storage)
-- Usage: SELECT store_commissioner_totp_secret('user-uuid-here', 'JBSWY3DPEHPK3PXP');
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
  -- Get encryption key from database configuration
  -- Set this with: ALTER DATABASE postgres SET app.totp_encryption_key = 'your-key';
  BEGIN
    v_encryption_key := current_setting('app.totp_encryption_key');
  EXCEPTION WHEN OTHERS THEN
    RETURN '{"success": false, "error": "Encryption key not configured. Run: ALTER DATABASE postgres SET app.totp_encryption_key = ''your-key'';"}';
  END IF;
  
  IF v_encryption_key IS NULL OR length(v_encryption_key) < 16 THEN
    RETURN '{"success": false, "error": "Encryption key too short or not set"}';
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

-- RPC for paws-2fa-verify to fetch and decrypt the secret securely
-- Returns: {"secret": "decrypted-value"} or {"error": "..."}
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
  -- Get encryption key
  BEGIN
    v_encryption_key := current_setting('app.totp_encryption_key');
  EXCEPTION WHEN OTHERS THEN
    RETURN '{"error": "Encryption key not configured"}';
  END IF;
  
  IF v_encryption_key IS NULL OR length(v_encryption_key) < 16 THEN
    RETURN '{"error": "Encryption key invalid"}';
  END IF;
  
  SELECT secret_encrypted INTO v_secret_encrypted 
  FROM paws_totp_secrets 
  WHERE user_id = uid;
  
  IF v_secret_encrypted IS NULL THEN
    RETURN '{"error": "Secret not found"}';
  END IF;
  
  -- Decrypt the secret
  BEGIN
    v_decrypted_secret := pgp_sym_decrypt(v_secret_encrypted, v_encryption_key);
  EXCEPTION WHEN OTHERS THEN
    RETURN '{"error": "Decryption failed - wrong key or corrupted data"}';
  END;
  
  RETURN json_build_object('secret', v_decrypted_secret);
END;
$$;

-- Strict access control: only service_role can use these functions
REVOKE ALL ON FUNCTION store_commissioner_totp_secret(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION store_commissioner_totp_secret(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION store_commissioner_totp_secret(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION get_commissioner_totp_secret(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_commissioner_totp_secret(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION get_commissioner_totp_secret(uuid) TO service_role;
