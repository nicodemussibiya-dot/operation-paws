const allowList = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

export function corsHeaders(origin: string | null) {
  // If no allowlist is configured, use a safe default or env single origin
  const singleOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
  
  if (allowList.length === 0) {
    return {
      'Access-Control-Allow-Origin': singleOrigin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
    };
  }

  const effectiveOrigin = (origin && allowList.includes(origin)) ? origin : allowList[0];

  return {
    'Access-Control-Allow-Origin': effectiveOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  };
}
