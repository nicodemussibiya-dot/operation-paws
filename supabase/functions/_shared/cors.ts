// supabase/functions/_shared/cors.ts
// Fail-closed CORS allow-list. Returns null → caller must respond 403.
const allowList = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Fail-closed CORS allow-list helper.
 * Returns a HeadersInit object if the origin is allowed, otherwise returns null.
 * 
 * SECURITY: If this returns null, the caller MUST return a 403 Forbidden.
 * DO NOT use the spread operator on a null return value in a response.
 */
export function corsHeaders(origin: string | null): HeadersInit | null {
  // 1. If no origin is provided (e.g. server-to-server with no header), we fail-closed.
  if (!origin) return null;

  // 2. If the allow-list is empty, we fail-closed for safety.
  if (allowList.length === 0) return null;

  // 3. If the origin is not in the allow-list, we fail-closed.
  if (!allowList.includes(origin)) return null;

  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-internal-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
