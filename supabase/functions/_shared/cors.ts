const allowList = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

export function corsHeaders(origin: string | null) {
  // If no allowlist is configured, fail closed (stakeholder-safe default).
  if (allowList.length === 0) return null;

  // Fail if no origin provided for browser-facing requests
  if (!origin) return null;

  if (!allowList.includes(origin)) {
    return null; // Return null to trigger 403 gate in functions
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  };
}
