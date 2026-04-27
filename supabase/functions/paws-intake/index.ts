import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";

// Supabase provides these to Edge Functions by default:
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Standardized JSON response helper with CORS enforcement.
 */
function json(data: unknown, origin: string | null, status = 200) {
  const headers = corsHeaders(origin);
  // If headers is null, it means origin is forbidden.
  // In a real flow, we'd have blocked this earlier, but we fallback to empty if needed.
  const cors = headers || {};
  
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      ...cors, 
      "Content-Type": "application/json" 
    },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  // 1. Handle Preflight
  if (req.method === "OPTIONS") {
    if (!headers) {
      return new Response("Forbidden: Invalid Origin", { status: 403 });
    }
    return new Response("ok", { headers });
  }

  // 2. Enforce Origin (Fail-Closed)
  if (!headers) {
    return new Response("Forbidden: Invalid Origin", { status: 403 });
  }

  // 3. Enforce POST
  if (req.method !== "POST") {
    return json({ error: "Method Not Allowed. Use POST." }, origin, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, origin, 401);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    
    if (authErr || !user) {
      return json({ error: 'Invalid or expired session' }, origin, 401);
    }

    // ── 4. RBAC CHECK ──────────────────────────────────────────
    const { data: roleRow } = await supabase
      .from('paws_user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const allowedRoles = ['officer', 'intake_admin', 'commissioner'];
    if (!roleRow || !allowedRoles.includes(roleRow.role)) {
      return json({ error: 'Unauthorized: Insufficient privileges' }, origin, 403);
    }

    const body = await req.json();
    const { dog_name, breed, microchip, source_tier } = body ?? {};

    // ── 5. DATABASE INSERT ──────────────────────────────────────
    const res = await fetch(`${SUPABASE_URL}/rest/v1/paws_dogs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify([{
        name: dog_name,
        breed,
        microchip_number: microchip,
        status: "pending_commissioner",
        photo_urls: [],
        source_tier: source_tier || "T3"
      }]),
    });

    const data = await res.json();
    if (!res.ok) {
      return json({ error: 'Database insertion failed', details: data }, origin, 400);
    }

    const assignedRef = data?.[0]?.paws_ref;

    // ── 6. AUDIT LOGGING ────────────────────────────────────────
    const microchipStr = String(microchip ?? "");
    const microchipLast4 = microchipStr.slice(-4);
    const microchipHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(microchipStr))
      .then(b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, "0")).join(""));

    await supabase.from('paws_audit_log').insert({
      actor_id: user.id,
      actor_role: roleRow.role,
      action: 'DOG_INTAKE_SUCCESS',
      target_id: assignedRef || 'UNKNOWN_REF',
      metadata: { 
        dog_name, 
        breed, 
        microchip_last4: microchipLast4, 
        microchip_hash: microchipHash 
      }
    });

    return json({ 
      ok: true, 
      paws_ref: assignedRef, 
      message: "Dog intake successful and audited." 
    }, origin);

  } catch (e) {
    console.error("Intake Error:", e);
    return json({ error: "Internal Server Error", details: String(e) }, origin, 500);
  }
});
