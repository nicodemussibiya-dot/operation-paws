/// <reference lib="deno.ns" />
// Supabase Edge Function: paws-chat
// Optimized for FREE MODELS & Multi-Layer Fallbacks (Gemini -> OpenAI -> OpenRouter -> Static).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configurable keys via Supabase Secrets
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || ""; 
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

const SYSTEM_PROMPT = `
You are the PAWS Assistant. 
Mission: Welfare-first, traceable K9 mobilization for SAPS.
Safety: No PII. No tactical secrets.
Routing: Use /start for WhatsApp, /donate for funding, /tracker for stats.
`;

const FALLBACK_ANSWERS: Record<string, string> = {
  "default": "I'm having trouble connecting to my AI brain right now. Please use the 'Start Hub' to find official links for WhatsApp and our Transparency Tracker.",
  "intake": "To donate a dog, please visit the Start Hub to join our official WhatsApp intake channel. This ensures 100% traceability.",
  "welfare": "Operation PAWS is welfare-first. Every dog is screened by an independent SPCA inspector.",
  "traceability": "We use verified microchips and unique PAWS Reference numbers to ensure no dog is smuggled or diverted."
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || "";

    // 1. Primary: Gemini 1.5 Flash
    if (GEMINI_API_KEY) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: SYSTEM_PROMPT + "\nUser Question: " + lastMessage }] }]
          })
        });
        const data = await res.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) return new Response(JSON.stringify({ reply }), { headers: corsHeaders });
      } catch (e) { console.error("Gemini failed"); }
    }

    // 2. Secondary: OpenAI
    if (OPENAI_API_KEY) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages]
          })
        });
        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content;
        if (reply) return new Response(JSON.stringify({ reply }), { headers: corsHeaders });
      } catch (e) { console.error("OpenAI failed"); }
    }

    // 3. Tertiary: OpenRouter (Universal Fallback)
    if (OPENROUTER_API_KEY) {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/nicodemussibiya-dot/operation-paws",
            "X-Title": "Operation PAWS"
          },
          body: JSON.stringify({
            model: "google/gemini-flash-1.5",
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages]
          })
        });
        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content;
        if (reply) return new Response(JSON.stringify({ reply }), { headers: corsHeaders });
      } catch (e) { console.error("OpenRouter failed"); }
    }

    // 4. Final: Static
    let finalReply = FALLBACK_ANSWERS.default;
    if (lastMessage.includes("donate")) finalReply = FALLBACK_ANSWERS.intake;
    if (lastMessage.includes("welfare")) finalReply = FALLBACK_ANSWERS.welfare;
    if (lastMessage.includes("trace")) finalReply = FALLBACK_ANSWERS.traceability;

    return new Response(JSON.stringify({ reply: finalReply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ reply: FALLBACK_ANSWERS.default }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
