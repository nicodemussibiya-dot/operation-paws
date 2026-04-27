-- Migration: 016_totp_encryption.sql
-- Goal: Encrypt TOTP secrets in paws_totp_secrets and update the RPC to decrypt.
-- This uses a symmetric key (placeholder: 'PAWS_SYSTEM_KEY').
-- In a real production deployment, this key should be managed via Supabase Vault or KMS.

-- 1. Alter table to use bytea for the encrypted secret
ALTER TABLE paws_totp_secrets 
  ALTER COLUMN secret TYPE bytea USING pgp_sym_encrypt(secret, 'PAWS_SYSTEM_KEY');

-- 2. Update the RPC to decrypt the secret
CREATE OR REPLACE FUNCTION get_commissioner_totp_secret(uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER 
AS $$
DECLARE
    v_encrypted_secret bytea;
    v_decrypted_secret text;
BEGIN
    SELECT secret INTO v_encrypted_secret FROM paws_totp_secrets WHERE user_id = uid;
    
    IF v_encrypted_secret IS NULL THEN
        RETURN '{"error": "Secret not found"}';
    END IF;

    -- Decrypt using the same symmetric key
    v_decrypted_secret := pgp_sym_decrypt(v_encrypted_secret, 'PAWS_SYSTEM_KEY');
    
    RETURN json_build_object('secret', v_decrypted_secret);
EXCEPTION WHEN OTHERS THEN
    RETURN '{"error": "Decryption failed or internal error"}';
END;
$$;
