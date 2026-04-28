import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// NOTE: This is a LOCAL-ONLY demo gateway tool for development/presentation.
// It uses permissive CORS (*) to allow rapid prototyping without proxying.
import { load } from "https://deno.land/std@0.168.0/dotenv/mod.ts";
await load({ export: true, allowEmptyValues: true });
import { EXECUTIVE_SYSTEM_PROMPT, getRoleContext } from "./supabase/functions/_shared/prompts-executive.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { role, messages } = await req.json();

    const roleContext = getRoleContext(role);
    const systemPrompt = `${EXECUTIVE_SYSTEM_PROMPT}\n\n${roleContext}`;

    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ reply: "Error: GEMINI_API_KEY not found in .env file. Please add it to enable live AI." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const contents = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Hi there! I'm PAWS-OS. What can I help you with today?" }] },
      ...messages.map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }))
    ];

    // ── CALL GEMINI ──
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents }),
      }
    );

    const data = await res.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "The AI is silent. Check your API key.";

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}, { port: 9999 });

console.log("PAWS AI Gateway running at http://localhost:9999");
