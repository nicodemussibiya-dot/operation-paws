-- Migration: 010_atomic_secure_action.sql
-- Goal: Make destructive actions completely atomic to prevent race conditions or token replay.

CREATE OR REPLACE FUNCTION consume_action_token_and_execute(
    p_action_token text,
    p_action text,
    p_target_id text,
    p_actor_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Run as DB owner to bypass RLS for token consumption
AS $$
DECLARE
    -- v_token_id is removed as token is the PK
    v_expires_at timestamptz;
    v_used_at timestamptz;
    v_result jsonb;
    v_proposal record;
    v_dog record;
    v_new_ref text;
BEGIN
    -- 1. Find and lock the token row FOR UPDATE to prevent race conditions
    SELECT expires_at, used_at INTO v_expires_at, v_used_at
    FROM paws_action_tokens
    WHERE token = p_action_token
      AND actor_id = p_actor_id
      AND action = p_action
      AND target_id = p_target_id
    FOR UPDATE NOWAIT;

    -- 2. Verify token existence and state
    -- In Postgres, we check if the row exists by checking a non-null column
    IF NOT FOUND THEN
        PERFORM insert_audit_log(p_actor_id, 'commissioner', 'ACTION_TOKEN_INVALID', p_target_id, '{"error": "Token not found or mismatch"}');
        RAISE EXCEPTION 'Invalid action token';
    END IF;

    IF v_used_at IS NOT NULL THEN
        PERFORM insert_audit_log(p_actor_id, 'commissioner', 'ACTION_TOKEN_REPLAY_ATTEMPT', p_target_id, '{"error": "Token already consumed"}');
        RAISE EXCEPTION 'Action token already used';
    END IF;

    IF v_expires_at < now() THEN
        PERFORM insert_audit_log(p_actor_id, 'commissioner', 'ACTION_TOKEN_EXPIRED', p_target_id, '{"error": "Token expired"}');
        RAISE EXCEPTION 'Action token expired';
    END IF;

    -- 3. Mark token as consumed IMMEDIATELY
    UPDATE paws_action_tokens SET used_at = now() WHERE token = p_action_token;

    -- 4. Execute the requested action
    IF p_action = 'DELETE_DOG' THEN
        DELETE FROM paws_dogs WHERE paws_ref = p_target_id;
        v_result := '{"success": true, "action": "DELETE_DOG"}';
        
    ELSIF p_action = 'APPROVE_DOG' THEN
        UPDATE paws_dogs SET status = 'approved', approved_by = p_actor_id, approved_at = now(),
                             commissioner_decision = 'approved', commissioner_decision_at = now(), commissioner_decision_by = p_actor_id
        WHERE paws_ref = p_target_id;
        v_result := '{"success": true, "action": "APPROVE_DOG"}';
        
    ELSIF p_action = 'REJECT_DOG' THEN
        UPDATE paws_dogs SET status = 'rejected', approved_by = p_actor_id, approved_at = now(),
                             commissioner_decision = 'rejected', commissioner_decision_at = now(), commissioner_decision_by = p_actor_id
        WHERE paws_ref = p_target_id;
        v_result := '{"success": true, "action": "REJECT_DOG"}';
        
    ELSIF p_action = 'UPDATE_ROLE_FROM_PROPOSAL' THEN
        SELECT * INTO v_proposal FROM paws_role_change_proposals WHERE id = p_target_id::uuid FOR UPDATE;
        IF v_proposal IS NULL OR v_proposal.status != 'pending' THEN
            RAISE EXCEPTION 'Invalid or already processed proposal';
        END IF;
        
        UPDATE paws_role_change_proposals SET status = 'approved', decided_by = p_actor_id, decided_at = now() WHERE id = v_proposal.id;
        IF v_proposal.current_role IS NOT NULL THEN
            DELETE FROM paws_user_roles WHERE user_id = v_proposal.target_user AND role = v_proposal.current_role;
        END IF;
        INSERT INTO paws_user_roles (user_id, role) VALUES (v_proposal.target_user, v_proposal.proposed_role)
        ON CONFLICT (user_id, role) DO NOTHING;
        
        v_result := '{"success": true, "action": "UPDATE_ROLE"}';
        
    ELSE
        RAISE EXCEPTION 'Unknown action %', p_action;
    END IF;

    -- 5. Write success audit log (with redacted token)
    PERFORM insert_audit_log(p_actor_id, 'commissioner', 'ACTION_SUCCESS', p_target_id, '{"action": "' || p_action || '", "token_used": true}');

    RETURN v_result;
END;
$$;

-- Helper for audit logging inside RPCs
CREATE OR REPLACE FUNCTION insert_audit_log(
    p_actor_id uuid,
    p_actor_role text,
    p_action text,
    p_target_id text,
    p_metadata jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO paws_audit_log (actor_id, actor_role, action, target_id, metadata)
    VALUES (p_actor_id, p_actor_role, p_action, p_target_id, p_metadata);
END;
$$;
