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

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers });

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
  if (authErr || !user) return res(401, { error: 'Invalid session' }, headers);

  // ── 2. PARSE REQUEST ────────────────────────────────────────
  const { action_token, action, target_id } = await req.json();
  if (!action_token || !action || !target_id) {
    return res(400, { error: 'Missing required fields' }, headers);
  }

  // ── 3. ATOMIC EXECUTION (Prevent Race Conditions) ───────────
  // We delegate the token verification, consumption, and execution
  // to a single PostgreSQL transaction (RPC) to prevent replay attacks.
  
  if (action === 'APPROVE_DOG_BATCH') {
    // Handling batch requires a different RPC or loop. For standard atomic:
    return res(501, { error: 'Batch processing requires the updated batch RPC' }, headers);
  }

  const { data: result, error: rpcErr } = await supabase.rpc('consume_action_token_and_execute', {
    p_action_token: action_token,
    p_action: action,
    p_target_id: target_id,
    p_actor_id: user.id
  });

  if (rpcErr) {
    // The RPC handles its own failure logging where possible.
    return res(403, { error: rpcErr.message || 'Action failed or token invalid' }, headers);
  }

  return res(200, { success: true, action, target_id, details: result }, headers);
});

// ── HELPERS ───────────────────────────────────────────────────
function res(status: number, body: Record<string, unknown>, headers: any) {
  return new Response(JSON.stringify(body), { status, headers });
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
