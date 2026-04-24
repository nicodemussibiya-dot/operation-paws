/**
 * paws-secure-action Edge Function
 *
 * Executes destructive actions (DELETE, STATUS_CHANGE) ONLY with a valid,
 * unexpired, single-use action_token issued by the 2FA verification function.
 *
 * Flow:
 *   1. Client passes action_token + target details
 *   2. We verify the token exists, matches the action, is not expired, and is unused
 *   3. We execute the action
 *   4. We mark the token as consumed (single-use)
 *   5. We log everything to the immutable audit table
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? 'https://nicodemussibiya-dot.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  // ── 1. AUTHENTICATE ─────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return res(401, { error: 'Missing auth' });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );
  if (authErr || !user) return res(401, { error: 'Invalid session' });

  // ── 2. PARSE REQUEST ────────────────────────────────────────
  const { action_token, action, target_id } = await req.json();
  if (!action_token || !action || !target_id) {
    return res(400, { error: 'Missing required fields' });
  }

  // ── 3. VALIDATE ACTION TOKEN ────────────────────────────────
  const { data: tokenRow, error: tokenErr } = await supabase
    .from('paws_action_tokens')
    .select('*')
    .eq('token', action_token)
    .eq('actor_id', user.id)
    .eq('action', action)
    .eq('target_id', target_id)
    .is('used_at', null)
    .single();

  if (tokenErr || !tokenRow) {
    await auditLog(supabase, user.id, 'ACTION_TOKEN_INVALID', target_id, { action_token });
    return res(403, { error: 'Invalid or expired action token' });
  }

  // Check expiry
  if (new Date(tokenRow.expires_at) < new Date()) {
    await auditLog(supabase, user.id, 'ACTION_TOKEN_EXPIRED', target_id, { action_token });
    return res(403, { error: 'Action token expired' });
  }

  // ── 4. EXECUTE ACTION ───────────────────────────────────────
  let result;
  switch (action) {
    case 'DELETE_DOG':
      result = await supabase
        .from('paws_dogs')
        .delete()
        .eq('paws_reference', target_id);
      break;

    case 'APPROVE_DOG':
      result = await supabase
        .from('paws_dogs')
        .update({ status: 'DEPLOYED', approved_by: user.id, approved_at: new Date().toISOString() })
        .eq('paws_reference', target_id);
      break;

    case 'REJECT_DOG':
      result = await supabase
        .from('paws_dogs')
        .update({ status: 'REJECTED', approved_by: user.id, approved_at: new Date().toISOString() })
        .eq('paws_reference', target_id);
      break;

    default:
      return res(400, { error: `Unknown action: ${action}` });
  }

  if (result.error) {
    await auditLog(supabase, user.id, 'ACTION_FAILED', target_id, { action, db_error: result.error.message });
    return res(500, { error: 'Database operation failed' });
  }

  // ── 5. CONSUME TOKEN (single-use) ──────────────────────────
  await supabase
    .from('paws_action_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', action_token);

  // ── 6. AUDIT LOG ────────────────────────────────────────────
  await auditLog(supabase, user.id, `ACTION_${action}_SUCCESS`, target_id, { action_token });

  return res(200, { success: true, action, target_id });
});

// ── HELPERS ───────────────────────────────────────────────────
function res(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

async function auditLog(
  supabase: ReturnType<typeof createClient>,
  actorId: string, action: string, targetId: string,
  metadata: Record<string, unknown> = {}
) {
  await supabase.from('paws_audit_log').insert({
    actor_id: actorId,
    actor_role: 'commissioner',
    action,
    target_id: targetId,
    metadata,
  });
}
