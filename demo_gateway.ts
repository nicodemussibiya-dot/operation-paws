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

// Primary model, with an automatic fallback if it is overloaded or not found.
// gemini-2.0-flash is the stable, widely-available fallback (not deprecated).
const PRIMARY_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.0-flash"; // ✅ current stable fallback
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // first back-off delay (slightly longer to respect rate limits)

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

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  let res: Response;
  try {
    res = await fetch(url, {
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
    });
  } catch (fetchErr) {
    // Network-level error (DNS, timeout, etc.)
    console.error(`[PAWS-GW] Network error calling ${model}:`, fetchErr);
    if (model !== FALLBACK_MODEL) {
      console.warn(`[PAWS-GW] Trying fallback model (${FALLBACK_MODEL})…`);
      return callGemini(FALLBACK_MODEL, systemPrompt, contents, 1);
    }
    return { reply: STATIC_FALLBACK };
  }

  // 404 = model name wrong/deprecated → skip retries, go straight to fallback
  if (res.status === 404) {
    if (model !== FALLBACK_MODEL) {
      console.warn(
        `[PAWS-GW] Model not found: ${model} (404). ` +
          `Switching immediately to fallback: ${FALLBACK_MODEL}`,
      );
      return callGemini(FALLBACK_MODEL, systemPrompt, contents, 1);
    }
    // Fallback also 404'd — serve static message
    console.error("[PAWS-GW] Fallback model also 404. Serving static response.");
    return { reply: STATIC_FALLBACK };
  }

  // 503 / 429 = transient overload — retry with exponential back-off + jitter
  if (res.status === 503 || res.status === 429) {
    if (attempt <= MAX_RETRIES) {
      const jitter = Math.random() * 500; // add 0-500ms jitter
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1) + jitter;
      console.warn(
        `[PAWS-GW] ${model} returned ${res.status} (attempt ${attempt}/${MAX_RETRIES}). ` +
          `Retrying in ${Math.round(delay)}ms…`,
      );
      await sleep(delay);
      return callGemini(model, systemPrompt, contents, attempt + 1);
    }

    // Primary exhausted → try fallback model (fresh retries)
    if (model !== FALLBACK_MODEL) {
      console.warn(
        `[PAWS-GW] Primary model (${model}) exhausted after ${MAX_RETRIES} retries. ` +
          `Switching to fallback: ${FALLBACK_MODEL}`,
      );
      return callGemini(FALLBACK_MODEL, systemPrompt, contents, 1);
    }

    // Both models exhausted → static fallback
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
    return { error: "Gemini returned no text response.", _raw: data } as {
      reply?: string;
      error?: string;
    };
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
