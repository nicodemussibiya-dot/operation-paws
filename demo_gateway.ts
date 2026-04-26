import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/std@0.168.0/dotenv/load.ts";
import * as Prompts from "./supabase/functions/_shared/prompts.ts";

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
    const userMessage = messages[messages.length - 1].content;

    // ── SELECT SYSTEM PROMPT ──
    let activePrompt = Prompts.PAWS_CITIZEN_ASSISTANT_PROMPT;
    switch (role) {
      case 'clerk': activePrompt = Prompts.PAWS_GOVERNANCE_CLERK_PROMPT; break;
      case 'officer': activePrompt = Prompts.PAWS_OFFICER_ASSISTANT_PROMPT; break;
      case 'command': activePrompt = Prompts.PAWS_COMMAND_ASSISTANT_PROMPT; break;
      case 'presidency': activePrompt = Prompts.PAWS_PRESIDENCY_ASSISTANT_PROMPT; break;
      case 'citizen': activePrompt = Prompts.PAWS_CITIZEN_ASSISTANT_PROMPT; break;
    }

    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ reply: "Error: GEMINI_API_KEY not found in .env file. Please add it to enable live AI." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── CALL GEMINI ──
    const res = await fetch(
      \`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=\${GEMINI_API_KEY}\`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: \`\${activePrompt}\n\nUser: \${userMessage}\` }]
          }]
        }),
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
});

console.log("PAWS AI Gateway running at http://localhost:9999");
