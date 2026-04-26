import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY") || "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

import * as Prompts from "../_shared/prompts.ts";

const FALLBACK_ANSWERS: Record<string, string> = {
  default:
    "I'm having trouble connecting to my AI brain right now. Please use the Start Hub to find official links for WhatsApp and our Transparency Tracker.",
  intake:
    "To donate a dog, please visit the Start Hub to join our official WhatsApp intake channel. This ensures traceability.",
  traceability:
    "We use verified microchips and unique PAWS Reference numbers to reduce smuggling/diversion risk.",
};

async function getContext(supabase: any, query: string, apiKey: string, accessLevel: string) {
  if (!apiKey) return "";
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: query }] }
        }),
      }
    );
    const data = await res.json();
    const embedding = data?.embedding?.values;
    if (!embedding) return "";

    const { data: chunks, error } = await supabase.rpc('match_paws_knowledge', {
      query_embedding: embedding,
      match_count: 5,
      min_similarity: 0.2, // Lower threshold for better retrieval in demo
      p_access_level: accessLevel
    });

    if (error || !chunks || chunks.length === 0) return "";

    return chunks.map((c: any) => `[Source: ${c.source}]\n${c.content}`).join("\n\n---\n\n");
  } catch (e) {
    console.error("RAG Error:", e);
    return "";
  }
}

function json(data: unknown, origin: string | null, status = 200) {
  const headers = corsHeaders(origin) || {};
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function sanitizeMessages(input: unknown) {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  if (!Array.isArray(input)) return out;

  for (const m of input.slice(-12)) { // cap history
    const role = (m as any)?.role;
    const content = (m as any)?.content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;

    const trimmed = content.slice(0, 2000); // cap per message
    out.push({ role, content: trimmed });
  }
  return out;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);
  
  // ── 0. BYPASS FOR INTERNAL CALLS (e.g. Telegram) ────────────
  const internalSecret = Deno.env.get("INTERNAL_SECRET");
  const passedSecret = req.headers.get("x-internal-secret");
  const isInternal = internalSecret && passedSecret === internalSecret;

  if (req.method === "OPTIONS") {
    if (!headers) return new Response("Forbidden origin", { status: 403 });
    return new Response("ok", { headers });
  }

  if (!isInternal && !headers) {
    return new Response("Forbidden origin", { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const messages = sanitizeMessages(body?.messages);
    const lastMessage = (messages[messages.length - 1]?.content || "").toLowerCase();
    const role = body?.role || 'citizen';


    const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'unknown';
    const ipHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
      .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    
    const { data: rateRow } = await supabase.from('paws_chat_rate_limit')
      .select('*').eq('ip_hash', ipHash).single();

    let attempts = rateRow?.attempts ?? 0;
    const lastAttemptStr = rateRow?.last_attempt;
    const now = Date.now();
    const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

    const lastTime = lastAttemptStr ? Date.parse(lastAttemptStr) : 0;
    const withinWindow = lastTime && (now - lastTime) < WINDOW_MS;
    const nextAttempts = withinWindow ? (rateRow?.attempts ?? 0) + 1 : 1;

    if (rateRow?.blocked_until && new Date(rateRow.blocked_until).getTime() > now) {
      return json({ error: 'Too Many Requests' }, origin, 429);
    }

    // Update attempts
    await supabase.from('paws_chat_rate_limit').upsert({
      ip_hash: ipHash,
      attempts: nextAttempts,
      last_attempt: new Date(now).toISOString(),
      blocked_until: nextAttempts >= 30 
        ? new Date(now + 60 * 60 * 1000).toISOString() : null
    });

    // ── SELECT SYSTEM PROMPT BASED ON ROLE ──
    let activePrompt = Prompts.PAWS_CITIZEN_ASSISTANT_PROMPT;
    switch (role) {
      case 'clerk': activePrompt = Prompts.PAWS_GOVERNANCE_CLERK_PROMPT; break;
      case 'officer': activePrompt = Prompts.PAWS_OFFICER_ASSISTANT_PROMPT; break;
      case 'command': activePrompt = Prompts.PAWS_COMMAND_ASSISTANT_PROMPT; break;
      case 'citizen': activePrompt = Prompts.PAWS_CITIZEN_ASSISTANT_PROMPT; break;
    }

    // ── RAG RETRIEVAL ──
    const accessLevel = (role === 'presidency' || role === 'command' || role === 'officer') ? 'restricted' : 'public';
    const context = await getContext(supabase, lastMessage, GEMINI_API_KEY, accessLevel);

    if (context) {
      activePrompt = `${activePrompt}\n\n==================================================\nRETRIEVED CONTEXT (GROUND TRUTH)\n==================================================\nUse the following verified excerpts from the Operation PAWS knowledge base to answer the user's request. You MUST prioritize this information over your general knowledge and cite the specific [Source] provided.\n\n${context}`;
    }

    // 2) Gemini
    if (GEMINI_API_KEY) {
      try {
        // Format for Gemini API (user/model roles)
        const contents = [
          { role: "user", parts: [{ text: activePrompt }] },
          { role: "model", parts: [{ text: "Understood. I am online and grounded in the Operation PAWS repository. How can I assist the Presidency/Command oversight today?" }] },
          ...messages.map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }]
          }))
        ];

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents }),
          }
        );

        const data = await res.json();
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) return json({ reply }, origin);
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
            messages: [{ role: "system", content: activePrompt }, ...messages],
          }),
        });

        const data = await res.json();
        const reply = data?.choices?.[0]?.message?.content;
        if (reply) return json({ reply }, origin);
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
            messages: [{ role: "system", content: activePrompt }, ...messages],
          }),
        });

        const data = await res.json();
        const reply = data?.choices?.[0]?.message?.content;
        if (reply) return json({ reply }, origin);
      } catch (_e) {
        // fall through
      }
    }

    // 4) Static fallback
    let finalReply = FALLBACK_ANSWERS.default;
    if (lastMessage.includes("donate")) finalReply = FALLBACK_ANSWERS.intake;
    if (lastMessage.includes("welfare")) finalReply = FALLBACK_ANSWERS.welfare;
    if (lastMessage.includes("trace")) finalReply = FALLBACK_ANSWERS.traceability;

    return json({ reply: finalReply }, origin);
  } catch (_err) {
    return json({ reply: FALLBACK_ANSWERS.default }, origin, 200);
  }
});
