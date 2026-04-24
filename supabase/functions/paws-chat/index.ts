import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

const SYSTEM_PROMPT = `
You are the PAWS Assistant.
Mission: Welfare-first, traceable K9 mobilization for SAPS.
Safety: No PII. No tactical secrets.
Routing: Use /start for WhatsApp, /donate for funding, /tracker for stats.
`.trim();

const FALLBACK_ANSWERS: Record<string, string> = {
  default:
    "I'm having trouble connecting to my AI brain right now. Please use the Start Hub to find official links for WhatsApp and our Transparency Tracker.",
  intake:
    "To donate a dog, please visit the Start Hub to join our official WhatsApp intake channel. This ensures traceability.",
  welfare:
    "Operation PAWS is welfare-first. Every dog is screened by an independent SPCA inspector.",
  traceability:
    "We use verified microchips and unique PAWS Reference numbers to reduce smuggling/diversion risk.",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const lastMessage = (messages[messages.length - 1]?.content || "").toLowerCase();

    // 1) Gemini
    if (GEMINI_API_KEY) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: `${SYSTEM_PROMPT}\n\nUser: ${messages[messages.length - 1]?.content ?? ""}` },
                  ],
                },
              ],
            }),
          },
        );

        const data = await res.json();
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) return json({ reply });
      } catch (_e) {
        // fall through
      }
    }

    // 2) OpenAI
    if (OPENAI_API_KEY) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
          }),
        });

        const data = await res.json();
        const reply = data?.choices?.[0]?.message?.content;
        if (reply) return json({ reply });
      } catch (_e) {
        // fall through
      }
    }

    // 3) OpenRouter
    if (OPENROUTER_API_KEY) {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/nicodemussibiya-dot/operation-paws",
            "X-Title": "Operation PAWS",
          },
          body: JSON.stringify({
            model: "google/gemini-flash-1.5",
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
          }),
        });

        const data = await res.json();
        const reply = data?.choices?.[0]?.message?.content;
        if (reply) return json({ reply });
      } catch (_e) {
        // fall through
      }
    }

    // 4) Static fallback
    let finalReply = FALLBACK_ANSWERS.default;
    if (lastMessage.includes("donate")) finalReply = FALLBACK_ANSWERS.intake;
    if (lastMessage.includes("welfare")) finalReply = FALLBACK_ANSWERS.welfare;
    if (lastMessage.includes("trace")) finalReply = FALLBACK_ANSWERS.traceability;

    return json({ reply: finalReply });
  } catch (_err) {
    return json({ reply: FALLBACK_ANSWERS.default }, 200);
  }
});
