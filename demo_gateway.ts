import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// NOTE: This is a LOCAL-ONLY demo gateway tool for development/presentation.
// It uses permissive CORS (*) to allow rapid prototyping without proxying.
import { load } from "https://deno.land/std@0.168.0/dotenv/mod.ts";
import {
  EXECUTIVE_SYSTEM_PROMPT,
  getRoleContext,
} from "./supabase/functions/_shared/prompts-executive.ts";

await load({ export: true, allowEmptyValues: true });

// ─── Multi-key pool: load all available Gemini keys ──────────────────────────
// Add keys to .env as GEMINI_API_KEY_1, GEMINI_API_KEY_2, … GEMINI_API_KEY_5
// (Also checks legacy GEMINI_API_KEY / GOOGLE_API_KEY for backwards compat)
function loadGeminiKeys(): string[] {
  const keys: string[] = [];
  // legacy single-key
  const legacy = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_API_KEY");
  if (legacy) keys.push(legacy);
  // numbered keys
  for (let i = 1; i <= 10; i++) {
    const k = Deno.env.get(`GEMINI_API_KEY_${i}`);
    if (k && !keys.includes(k)) keys.push(k);
  }
  return keys;
}

const GEMINI_KEYS = loadGeminiKeys();
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

console.log(`[PAWS-GW] Loaded ${GEMINI_KEYS.length} Gemini key(s)${OPENROUTER_API_KEY ? " + OpenRouter" : ""}`);

// Track which keys are temporarily exhausted (reset every hour)
const exhaustedKeys = new Set<string>();
setInterval(() => exhaustedKeys.clear(), 60 * 60 * 1000);

function getAvailableKey(): string | null {
  return GEMINI_KEYS.find((k) => !exhaustedKeys.has(k)) ?? null;
}

// Primary model, with an automatic fallback if it is overloaded or not found.
const PRIMARY_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.0-flash";
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 800;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ─── Static fallback used when ALL Gemini calls fail ──────────────────────────
const STATIC_FALLBACK =
  "PAWS-OS is experiencing high demand right now and couldn't reach its AI " +
  "backbone. Please try again in a moment — the system will be back shortly. " +
  "If you need urgent assistance, please contact your PAWS liaison officer directly.";

// ─── Helper: sleep for ms milliseconds ────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── In-flight request queue (simple concurrency throttle) ────────────────────
// Free-tier Gemini keys often allow only 2-5 RPM. This serialises calls so
// the gateway doesn't blast the API with parallel requests.
let inFlight = 0;
const MAX_CONCURRENT = 1; // serialise to avoid bursting the rate limit
const queue: (() => void)[] = [];

async function acquireSlot(): Promise<void> {
  if (inFlight < MAX_CONCURRENT) {
    inFlight++;
    return;
  }
  await new Promise<void>((resolve) => queue.push(resolve));
  inFlight++;
}

function releaseSlot(): void {
  inFlight--;
  if (queue.length > 0) {
    const next = queue.shift()!;
    next();
  }
}

// ─── OpenRouter fallback ───────────────────────────────────────────────────────
async function callOpenRouter(
  systemPrompt: string,
  contents: unknown[],
): Promise<{ reply?: string; error?: string }> {
  if (!OPENROUTER_API_KEY) return { reply: STATIC_FALLBACK };

  // Free models available on OpenRouter (no billing required)
  const model = "google/gemini-2.0-flash-exp:free";
  console.log(`[PAWS-GW] Trying OpenRouter → ${model}`);

  const messages = [
    { role: "system", content: systemPrompt },
    ...(contents as Array<{ role: string; parts: Array<{ text: string }> }>).map(
      (c) => ({ role: c.role === "model" ? "assistant" : c.role, content: c.parts?.[0]?.text ?? "" }),
    ),
  ];

  if (messages.length === 1) messages.push({ role: "user", content: "Hello" });

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://operation-paws.demo",
        "X-Title": "PAWS Command Center",
      },
      body: JSON.stringify({ model, messages }),
    });

    if (!res.ok) {
      console.error(`[PAWS-GW] OpenRouter error: ${res.status}`);
      return { reply: STATIC_FALLBACK };
    }

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    return reply ? { reply } : { reply: STATIC_FALLBACK };
  } catch (e) {
    console.error("[PAWS-GW] OpenRouter network error:", e);
    return { reply: STATIC_FALLBACK };
  }
}

// ─── Core Gemini call with key rotation + model fallback ──────────────────────
async function callGemini(
  model: string,
  systemPrompt: string,
  contents: unknown[],
  attempt = 1,
  usedKeys: Set<string> = new Set(),
): Promise<{ reply?: string; error?: string }> {
  // Pick the next available key not already tried in this request chain
  const apiKey = GEMINI_KEYS.find((k) => !exhaustedKeys.has(k) && !usedKeys.has(k)) ?? null;

  if (!apiKey) {
    // All Gemini keys exhausted — try OpenRouter
    console.warn("[PAWS-GW] All Gemini keys exhausted. Trying OpenRouter…");
    return callOpenRouter(systemPrompt, contents);
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents:
          contents.length > 0
            ? contents
            : [{ role: "user", parts: [{ text: "Hello" }] }],
      }),
    });
  } catch (fetchErr) {
    console.error(`[PAWS-GW] Network error calling ${model}:`, fetchErr);
    if (model !== FALLBACK_MODEL) {
      console.warn(`[PAWS-GW] Trying fallback model (${FALLBACK_MODEL})…`);
      return callGemini(FALLBACK_MODEL, systemPrompt, contents, 1, usedKeys);
    }
    return callOpenRouter(systemPrompt, contents);
  }

  // 404 = model not found → switch model immediately
  if (res.status === 404) {
    if (model !== FALLBACK_MODEL) {
      console.warn(`[PAWS-GW] Model 404: ${model} → switching to ${FALLBACK_MODEL}`);
      return callGemini(FALLBACK_MODEL, systemPrompt, contents, 1, usedKeys);
    }
    return callOpenRouter(systemPrompt, contents);
  }

  // 429 = quota exhausted → mark this key, rotate to next key
  if (res.status === 429) {
    console.warn(`[PAWS-GW] Key quota exhausted (429). Rotating to next key…`);
    exhaustedKeys.add(apiKey);
    usedKeys.add(apiKey);
    return callGemini(model, systemPrompt, contents, 1, usedKeys);
  }

  // 503 = transient overload → retry with back-off (same key)
  if (res.status === 503) {
    if (attempt <= MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 400;
      console.warn(`[PAWS-GW] 503 (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${Math.round(delay)}ms…`);
      await sleep(delay);
      return callGemini(model, systemPrompt, contents, attempt + 1, usedKeys);
    }
    // Try next key on repeated 503s
    usedKeys.add(apiKey);
    return callGemini(model, systemPrompt, contents, 1, usedKeys);
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
    return { error: "Gemini returned no text response." };
  }

  return { reply };
}

// ─── Graceful port check ──────────────────────────────────────────────────────
const PORT = 9999;

async function isPortFree(port: number): Promise<boolean> {
  try {
    const listener = Deno.listen({ port });
    listener.close();
    return true;
  } catch {
    return false;
  }
}

const portFree = await isPortFree(PORT);
if (!portFree) {
  console.error(
    `\n❌  Port ${PORT} is already in use.\n` +
      `   Run:  kill -9 $(lsof -ti :${PORT})\n` +
      `   Then: deno run -A demo_gateway.ts\n`,
  );
  Deno.exit(1);
}

// ─── HTTP Server ───────────────────────────────────────────────────────────────
console.log(
  `\n🐾 PAWS AI Gateway starting on http://localhost:${PORT}` +
    `\n   primary: ${PRIMARY_MODEL} | fallback: ${FALLBACK_MODEL}\n`,
);

serve(
  async (req) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    // Health endpoint — lets the client check if the gateway is alive
    if (req.method === "GET") {
      return new Response(
        JSON.stringify({
          status: "ok",
          primary: PRIMARY_MODEL,
          fallback: FALLBACK_MODEL,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Throttle: wait for a slot before calling Gemini
    await acquireSlot();
    try {
      const { role, messages } = await req.json();

      const roleContext = getRoleContext(role);
      const systemPrompt = `${EXECUTIVE_SYSTEM_PROMPT}\n\n${roleContext}`;
      const safeMessages = Array.isArray(messages) ? messages : [];

      const contents = safeMessages.map(
        (m: { role: string; content?: string }) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: String(m.content ?? "") }],
        }),
      );

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
    } finally {
      releaseSlot();
    }
  },
  { port: PORT },
);
