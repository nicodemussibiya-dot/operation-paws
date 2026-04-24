/**
 * paws-2fa-verify Edge Function
 *
 * Validates a TOTP code server-side and issues a short-lived action_token.
 * This runs on Supabase infrastructure, never in the browser.
 *
 * SECURITY: The TOTP secret is stored in Supabase Vault (encrypted at rest).
 * It is NEVER exposed to the client, NEVER logged, NEVER in env vars.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? 'https://nicodemussibiya-dot.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  // ── 1. AUTHENTICATE THE CALLER ──────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );
  if (authErr || !user) return new Response('Invalid session', { status: 401, headers: CORS });

  // ── 2. CHECK ROLE (Commissioner only) ───────────────────────
  const { data: roleRow } = await supabase
    .from('paws_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!roleRow || roleRow.role !== 'commissioner') {
    await supabase.from('paws_audit_log').insert({
      actor_id: user.id, actor_role: roleRow?.role ?? 'unknown',
      action: '2FA_ATTEMPT_UNAUTHORIZED', metadata: { ip: req.headers.get('x-forwarded-for') }
    });
    return new Response('Forbidden', { status: 403, headers: CORS });
  }

  // ── 3. RATE LIMIT CHECK ─────────────────────────────────────
  const ipHash = await hashIp(req.headers.get('x-forwarded-for') ?? 'unknown');
  const { data: rateRow } = await supabase.from('paws_rate_limit')
    .select('*').eq('ip_hash', ipHash).eq('action', '2fa_verify').single();

  if (rateRow?.blocked_until && new Date(rateRow.blocked_until) > new Date()) {
    return new Response('Too Many Requests', { status: 429, headers: CORS });
  }

  // ── 4. VALIDATE TOTP ────────────────────────────────────────
  const { code, action, target_id } = await req.json();

  // Secret retrieved from Supabase Vault — never from env vars or code
  const { data: secretData } = await supabase.rpc('get_commissioner_totp_secret', { uid: user.id });

  const isValid = await validateTOTP(code, secretData?.secret);

  if (!isValid) {
    // Increment rate limit counter
    await supabase.from('paws_rate_limit').upsert({
      ip_hash: ipHash, action: '2fa_verify',
      attempts: (rateRow?.attempts ?? 0) + 1,
      last_attempt: new Date().toISOString(),
      blocked_until: (rateRow?.attempts ?? 0) >= 4
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null
    });
    await supabase.from('paws_audit_log').insert({
      actor_id: user.id, actor_role: 'commissioner',
      action: '2FA_FAILED', target_id,
      metadata: { ip: req.headers.get('x-forwarded-for'), attempts: (rateRow?.attempts ?? 0) + 1 }
    });
    return new Response(JSON.stringify({ error: 'Invalid code' }), { status: 401, headers: CORS });
  }

  // ── 5. ISSUE SHORT-LIVED ACTION TOKEN ───────────────────────
  const { data: tokenRow } = await supabase.from('paws_action_tokens').insert({
    actor_id: user.id, action, target_id,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
  }).select('token').single();

  await supabase.from('paws_audit_log').insert({
    actor_id: user.id, actor_role: 'commissioner',
    action: '2FA_SUCCESS', target_id, metadata: { action_token: tokenRow?.token }
  });

  return new Response(JSON.stringify({ action_token: tokenRow?.token }), { headers: CORS });
});

async function hashIp(ip: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function validateTOTP(code: string, secret: string): Promise<boolean> {
  // TOTP validation using RFC 6238
  const window = 1; // Allow 30s clock drift
  const epoch = Math.floor(Date.now() / 30000);
  for (let i = -window; i <= window; i++) {
    const expected = await generateTOTP(secret, epoch + i);
    if (expected === code) return true;
  }
  return false;
}

async function generateTOTP(secret: string, counter: number): Promise<string> {
  const keyBytes = base32Decode(secret);
  const counterBytes = new ArrayBuffer(8);
  const view = new DataView(counterBytes);
  view.setUint32(4, counter, false);
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, counterBytes);
  const arr = new Uint8Array(sig);
  const offset = arr[19] & 0xf;
  const code = ((arr[offset] & 0x7f) << 24 | arr[offset+1] << 16 | arr[offset+2] << 8 | arr[offset+3]) % 1000000;
  return code.toString().padStart(6, '0');
}

function base32Decode(input: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0;
  const output: number[] = [];
  for (const c of input.replace(/=+$/, '').toUpperCase()) {
    value = (value << 5) | chars.indexOf(c);
    bits += 5;
    if (bits >= 8) { output.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return new Uint8Array(output);
}
