import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { dog_name, breed, microchip_id, source_tier, pin } = await req.json();

    // 1. Check PIN against Secret
    const ADMIN_PIN = Deno.env.get("ADMIN_PIN");
    if (pin !== ADMIN_PIN) {
      return new Response(JSON.stringify({ error: "Unauthorized: Incorrect PIN" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Initialize Supabase with Service Role Key (Server-side only)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 3. Insert the Dog
    const { data, error } = await supabaseAdmin
      .from("paws_dogs")
      .insert([{ dog_name, breed, microchip_id, source_tier }])
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
