import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// NOTE: This is a LOCAL-ONLY demo gateway tool for development/presentation.
// It uses permissive CORS (*) to allow rapid prototyping without proxying.
import { load } from "https://deno.land/std@0.168.0/dotenv/mod.ts";
import {
  EXECUTIVE_SYSTEM_PROMPT,
  getRoleContext,
} from "./supabase/functions/_shared/prompts-executive.ts";

await load({ export: true, allowEmptyValues: true });

const GEMINI_API_KEY =
  Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_API_KEY");

// Primary model, with an automatic fallback if it is overloaded.
const PRIMARY_MODEL   = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const FALLBACK_MODEL  = "gemini-1.5-flash";           // lower-traffic, higher availability
const MAX_RETRIES     = 3;
const BASE_DELAY_MS   = 800;                          // first back-off delay

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ─── Static fallback used when ALL Gemini calls fail ──────────────────────────
const STATIC_FALLBACK =
  "PAWS-OS is experiencing high demand right now and couldn't reach its AI " +
  "backbone. Please try again in a moment — the system will be back shortly. " +
  "If you need urgent assistance, please contact your PAWS liaison officer directly.";

// ─── Helper: sleep for ms milliseconds ────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Core Gemini call with retry + model fallback ─────────────────────────────
async function callGemini(
  model: string,
  systemPrompt: string,
  contents: unknown[],
  attempt = 1,
): Promise<{ reply?: string; error?: string }> {
  if (!GEMINI_API_KEY) {
    return {
      error:
        "Missing API key. Add GEMINI_API_KEY or GOOGLE_API_KEY to your .env file.",
    };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents:
          contents.length > 0
            ? contents
            : [{ role: "user", parts: [{ text: "Hello" }] }],
      }),
    },
  );

  // Transient overload errors — retry with back-off
  if (res.status === 503 || res.status === 429) {
    if (attempt <= MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1); // 800ms, 1.6s, 3.2s
      console.warn(
        `[PAWS-GW] ${model} returned ${res.status} (attempt ${attempt}/${MAX_RETRIES}). ` +
        `Retrying in ${delay}ms…`,
      );
      await sleep(delay);
      return callGemini(model, systemPrompt, contents, attempt + 1);
    }

    // Primary model exhausted — try the fallback model (one pass only)
    if (model !== FALLBACK_MODEL) {
      console.warn(
        `[PAWS-GW] Primary model (${model}) exhausted after ${MAX_RETRIES} retries. ` +
        `Switching to fallback model (${FALLBACK_MODEL})…`,
      );
      return callGemini(FALLBACK_MODEL, systemPrompt, contents, 1);
    }

    // Both models exhausted — return static fallback
    console.error("[PAWS-GW] All models exhausted. Serving static fallback.");
    return { reply: STATIC_FALLBACK };
  }

  const data = await res.json();

  if (!res.ok) {
    return {
      error: `Gemini ${res.status}: ${data?.error?.message ?? "Unknown API error"}`,
    };
  }

  const reply = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p?.text ?? "")
    .join("")
    .trim();

  if (!reply) {
    return { error: "Gemini returned no text response.", ...{ _raw: data } };
  }

  return { reply };
}

// ─── HTTP Server ───────────────────────────────────────────────────────────────
serve(
  async (req) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    try {
      const { role, messages } = await req.json();

      const roleContext  = getRoleContext(role);
      const systemPrompt = `${EXECUTIVE_SYSTEM_PROMPT}\n\n${roleContext}`;
      const safeMessages = Array.isArray(messages) ? messages : [];

      const contents = safeMessages.map((m: { role: string; content?: string }) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: String(m.content ?? "") }],
      }));

      const result = await callGemini(PRIMARY_MODEL, systemPrompt, contents);

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  },
  { port: 9999 },
);

console.log(
  `PAWS AI Gateway running at http://localhost:9999 — ` +
  `primary: ${PRIMARY_MODEL} | fallback: ${FALLBACK_MODEL}`,
);
