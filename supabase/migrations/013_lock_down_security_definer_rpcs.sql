-- 013_lock_down_security_definer_rpcs.sql
-- Goal: Prevent PUBLIC from executing SECURITY DEFINER RPCs.

-- Lock down TOTP secret RPC
REVOKE ALL ON FUNCTION public.get_commissioner_totp_secret(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_commissioner_totp_secret(uuid) TO service_role;

-- Lock down atomic action RPC
REVOKE ALL ON FUNCTION public.consume_action_token_and_execute(text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_action_token_and_execute(text, text, text, uuid) TO service_role;

-- Lock down helper too (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'insert_audit_log') THEN
        REVOKE ALL ON FUNCTION public.insert_audit_log(uuid, text, text, text, jsonb) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.insert_audit_log(uuid, text, text, text, jsonb) TO service_role;
    END IF;
END $$;
