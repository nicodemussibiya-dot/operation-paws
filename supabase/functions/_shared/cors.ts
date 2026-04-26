// supabase/functions/_shared/cors.ts
// Fail-closed CORS allow-list. Returns null → caller must respond 403.
const allowList = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function corsHeaders(origin: string | null): HeadersInit | null {
  // Fail-closed by default (stakeholder-safe)
  if (!origin) return null;
  if (allowList.length === 0) return null;
  if (!allowList.includes(origin)) return null;

  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-internal-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
