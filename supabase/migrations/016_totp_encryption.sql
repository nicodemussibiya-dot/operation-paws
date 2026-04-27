-- Migration: 016_totp_encryption.sql
-- Goal: Encrypt TOTP secrets in paws_totp_secrets and update the RPC to decrypt.
-- This uses pgp_sym_encrypt/decrypt with a key sourced from 'app.settings.paws_crypto_key'.

-- 1. Alter table to use bytea for the encrypted secret
-- Note: We use a default placeholder if the setting is missing during migration, 
-- but it MUST be set in production via: ALTER DATABASE postgres SET "app.settings.paws_crypto_key" = 'your-secure-key';
ALTER TABLE paws_totp_secrets 
  ALTER COLUMN secret TYPE bytea USING pgp_sym_encrypt(secret, coalesce(current_setting('app.settings.paws_crypto_key', true), 'PAWS_REPLACE_THIS_KEY'));

-- 2. Update the RPC to decrypt the secret
CREATE OR REPLACE FUNCTION get_commissioner_totp_secret(uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER 
AS $$
DECLARE
    v_encrypted_secret bytea;
    v_decrypted_secret text;
    v_key text;
BEGIN
    -- Retrieve key from database settings (injectable via Supabase env)
    v_key := current_setting('app.settings.paws_crypto_key', true);
    
    IF v_key IS NULL THEN
        -- Fallback to placeholder for demo/CI only
        v_key := 'PAWS_REPLACE_THIS_KEY';
    END IF;

    SELECT secret INTO v_encrypted_secret FROM paws_totp_secrets WHERE user_id = uid;
    
    IF v_encrypted_secret IS NULL THEN
        RETURN '{"error": "Secret not found"}';
    END IF;

    -- Decrypt using the symmetric key
    v_decrypted_secret := pgp_sym_decrypt(v_encrypted_secret, v_key);
    
    RETURN json_build_object('secret', v_decrypted_secret);
EXCEPTION WHEN OTHERS THEN
    RETURN '{"error": "Decryption failed (Check app.settings.paws_crypto_key)"}';
END;
$$;
