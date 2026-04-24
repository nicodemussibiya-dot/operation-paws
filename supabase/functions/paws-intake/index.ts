/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_PIN = Deno.env.get("ADMIN_PIN") || ""; // set in Supabase Secrets

// Supabase provides these to Edge Functions by default:
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function makeRef() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
  return `PAWS-${y}${m}-${rand}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  try {
    const body = await req.json();
    const { pin, dog_name, breed, microchip, source_tier } = body ?? {};

    if (!ADMIN_PIN || String(pin || "") !== ADMIN_PIN) {
      return json({ error: "Invalid PIN" }, 401);
    }

    // Stock image (turnkey demo)
    const photo = `https://placedog.net/900/600?id=${Math.floor(Math.random() * 200) + 1}`;

    const paws_ref = makeRef();

    const res = await fetch(`${SUPABASE_URL}/rest/v1/paws_dogs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify([{
        paws_ref,
        name: dog_name,
        breed,
        microchip_number: microchip,
        status: "pending_commissioner",
        photo_urls: [photo],
        source_tier: source_tier || "T3"
      }]),
    });

    const data = await res.json();
    if (!res.ok) return json({ error: data }, 400);

    return json({ ok: true, paws_ref, inserted: data, stock_photo: photo });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
