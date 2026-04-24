/// <reference lib="deno.ns" />
// Supabase Edge Function: paws-chat
// Optimized for FREE MODELS (Gemini 1.5 Flash) with robust fallbacks.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configurable keys via Supabase Secrets
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || ""; 

const SYSTEM_PROMPT = `
You are the PAWS Assistant. 
Mission: Welfare-first, traceable K9 mobilization for SAPS.
Safety: No PII. No tactical secrets.
Routing: Use /start for WhatsApp, /donate for funding, /tracker for stats.
`;

// Static Fallback Responses if APIs fail
const FALLBACK_ANSWERS: Record<string, string> = {
  "default": "I'm having trouble connecting to my AI brain right now. Please use the 'Start Hub' to find official links for WhatsApp and our Transparency Tracker.",
  "intake": "To donate a dog, please scan our QR code or visit the Start Hub to join our WhatsApp intake channel. This ensures 100% traceability.",
  "welfare": "Operation PAWS is welfare-first. Every dog is screened by an independent SPCA inspector to ensure they are healthy and suitable for service.",
  "traceability": "We use verified microchips and unique PAWS Reference numbers to ensure no dog is smuggled or diverted."
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || "";

    // 1. Primary Attempt: Gemini 1.5 Flash (Free Tier Friendly)
    if (GEMINI_API_KEY) {
      try {
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: SYSTEM_PROMPT + "\nUser Question: " + lastMessage }] }]
          })
        });
        const data = await geminiRes.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) return new Response(JSON.stringify({ reply }), { headers: corsHeaders });
      } catch (e) {
        console.error("Gemini failed, trying next fallback...");
      }
    }

    // 2. Secondary Attempt: OpenAI (If key provided)
    if (OPENAI_API_KEY) {
      try {
        const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages]
          })
        });
        const data = await openaiRes.json();
        const reply = data.choices?.[0]?.message?.content;
        if (reply) return new Response(JSON.stringify({ reply }), { headers: corsHeaders });
      } catch (e) {
        console.error("OpenAI failed, trying static fallback...");
      }
    }

    // 3. Final Fallback: Keyword-based Static Answers
    let finalReply = FALLBACK_ANSWERS.default;
    if (lastMessage.includes("donate") || lastMessage.includes("intake")) finalReply = FALLBACK_ANSWERS.intake;
    if (lastMessage.includes("welfare") || lastMessage.includes("spca")) finalReply = FALLBACK_ANSWERS.welfare;
    if (lastMessage.includes("trace") || lastMessage.includes("smuggle") || lastMessage.includes("chip")) finalReply = FALLBACK_ANSWERS.traceability;

    return new Response(JSON.stringify({ reply: finalReply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ reply: FALLBACK_ANSWERS.default }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
