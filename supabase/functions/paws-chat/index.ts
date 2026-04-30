import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { EXECUTIVE_SYSTEM_PROMPT, getRoleContext } from "../_shared/prompts-executive.ts";

// ─── CORS ──────────────────────────────────────────────────────────────────────
function corsHeaders(origin: string | null): HeadersInit {
  const allowList = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);

  const allowed =
    !origin ||
    allowList.length === 0 ||
    allowList.includes(origin);

  return {
    "Access-Control-Allow-Origin": allowed ? (origin ?? "*") : "null",
    "Vary": "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-internal-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// ─── Fallback messages ─────────────────────────────────────────────────────────
const FALLBACK_MESSAGES = [
  "PAWS-OS is temporarily unavailable. Please try again in a moment — our team has been notified.",
  "PAWS-OS is taking a brief pause. Please try again shortly, or reach out to the PAWS team directly if this is urgent.",
  "PAWS-OS is not available right now. Please try again in a few moments.",
  "We're unable to reach PAWS-OS at the moment. Please try again shortly — apologies for the interruption.",
  "PAWS-OS is momentarily offline. Please try again in a moment.",
];

function getStaticFallback(): string {
  return FALLBACK_MESSAGES[Math.floor(Math.random() * FALLBACK_MESSAGES.length)];
}

// ─── Multi-key pool — supports up to GEMINI_API_KEY_20 ────────────────────────
function loadGeminiKeys(): string[] {
  const keys: string[] = [];
  const legacy = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_API_KEY");
  if (legacy) keys.push(legacy);
  for (let i = 1; i <= 20; i++) {  // ← raised ceiling from 10 → 20
    const k = Deno.env.get(`GEMINI_API_KEY_${i}`);
    if (k && !keys.includes(k)) keys.push(k);
  }
  return keys;
}

const GEMINI_KEYS    = loadGeminiKeys();
const OPENROUTER_KEY = Deno.env.get("OPENROUTER_API_KEY");
const GEMINI_MODEL   = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash";

console.log(
  `[PAWS-CHAT] ${GEMINI_KEYS.length} Gemini key(s) loaded | model: ${GEMINI_MODEL}` +
  `${OPENROUTER_KEY ? " | OpenRouter ✓" : " | OpenRouter ✗ (no key)"}`,
);

// Keys that hit quota — cleared every hour for a fresh attempt
const exhaustedKeys = new Set<string>();
setInterval(() => {
  console.log("[PAWS-CHAT] Clearing exhausted key cache");
  exhaustedKeys.clear();
}, 60 * 60 * 1000);

// ─── Rate limiting ─────────────────────────────────────────────────────────────
const RATE_LIMIT = new Map<string, { count: number; reset: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const rec = RATE_LIMIT.get(ip);
  if (!rec || rec.reset < now - 600_000) {
    RATE_LIMIT.set(ip, { count: 1, reset: now });
    return true;
  }
  if (rec.count >= 30) return false;
  rec.count++;
  return true;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── SSE stream builder ────────────────────────────────────────────────────────
function buildSSEStream(geminiStream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      const reader = geminiStream.getReader();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const textMatches = buffer.matchAll(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g);
          let lastIndex = 0;

          for (const match of textMatches) {
            const raw = match[1]
              .replace(/\\n/g, "\n")
              .replace(/\\t/g, "\t")
              .replace(/\\r/g, "\r")
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, "\\");

            if (raw) {
              controller.enqueue(encoder.encode(`data: ${raw}\n\n`));
            }
            lastIndex = (match.index ?? 0) + match[0].length;
          }

          if (lastIndex > 0) buffer = buffer.slice(lastIndex);
          if (buffer.length > 8192) buffer = buffer.slice(-4096);
        }
      } catch (e) {
        console.error("[PAWS-CHAT] stream error:", e);
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}

// ─── OpenRouter fallback — tries 4 free models in sequence ────────────────────
async function callOpenRouterText(
  systemPrompt: string,
  contents: Array<{ role: string; parts: Array<{ text: string }> }>,
): Promise<string> {
  if (!OPENROUTER_KEY) {
    console.warn("[PAWS-CHAT] No OpenRouter key — returning static fallback");
    return getStaticFallback();
  }

  const models = [
    "google/gemini-2.0-flash-exp:free",
    "google/gemini-flash-1.5:free",
    "meta-llama/llama-3.1-8b-instruct:free",
    "mistralai/mistral-7b-instruct:free",
  ];

  const messages = [
    { role: "system", content: systemPrompt },
    ...contents.map((c) => ({
      role: c.role === "model" ? "assistant" : c.role,
      content: c.parts?.[0]?.text ?? "",
    })),
  ];
  if (messages.length === 1) messages.push({ role: "user", content: "Hello" });

  for (const model of models) {
    try {
      console.log(`[PAWS-CHAT] Trying OpenRouter model: ${model}`);
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENROUTER_KEY}`,
          "HTTP-Referer": "https://operationpaws.netlify.app",
          "X-Title": "PAWS Command Center",
        },
        body: JSON.stringify({ model, messages }),
      });

      if (!res.ok) {
        console.warn(`[PAWS-CHAT] OpenRouter ${model} → ${res.status}`);
        continue;
      }

      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content?.trim();
      if (reply) {
        console.log(`[PAWS-CHAT] OpenRouter success via ${model}`);
        return reply;
      }
    } catch (e) {
      console.warn(`[PAWS-CHAT] OpenRouter ${model} error:`, e);
    }
  }

  console.warn("[PAWS-CHAT] All OpenRouter models failed — static fallback");
  return getStaticFallback();
}

// ─── Gemini streaming call with automatic key rotation ────────────────────────
async function callGeminiStream(
  systemPrompt: string,
  contents: Array<{ role: string; parts: Array<{ text: string }> }>,
  usedKeys: Set<string> = new Set(),
  attempt = 1,
): Promise<ReadableStream<Uint8Array> | string> {

  const apiKey = GEMINI_KEYS.find((k) => !exhaustedKeys.has(k) && !usedKeys.has(k)) ?? null;

  if (!apiKey) {
    console.warn("[PAWS-CHAT] All Gemini keys exhausted — falling back to OpenRouter");
    return await callOpenRouterText(systemPrompt, contents);
  }

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: contents.length > 0
      ? contents
      : [{ role: "user", parts: [{ text: "Hello" }] }],
  });

  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body,
      },
    );
  } catch (e) {
    console.warn("[PAWS-CHAT] Gemini network error — rotating key:", e);
    usedKeys.add(apiKey);
    return callGeminiStream(systemPrompt, contents, usedKeys, 1);
  }

  if (res.status === 429) {
    console.warn("[PAWS-CHAT] 429 quota hit — rotating key");
    exhaustedKeys.add(apiKey);
    usedKeys.add(apiKey);
    return callGeminiStream(systemPrompt, contents, usedKeys, 1);
  }

  if (res.status === 503) {
    if (attempt <= 2) {
      console.warn(`[PAWS-CHAT] 503 — retrying (attempt ${attempt})`);
      await sleep(800 * attempt);
      return callGeminiStream(systemPrompt, contents, usedKeys, attempt + 1);
    }
    usedKeys.add(apiKey);
    return callGeminiStream(systemPrompt, contents, usedKeys, 1);
  }

  if (!res.ok) {
    console.warn(`[PAWS-CHAT] Gemini returned ${res.status} — rotating key`);
    usedKeys.add(apiKey);
    return callGeminiStream(systemPrompt, contents, usedKeys, 1);
  }

  return buildSSEStream(res.body!);
}

// ─── HTTP Server ───────────────────────────────────────────────────────────────
serve(async (req) => {
  const origin  = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") return new Response("ok", { headers });

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({ reply: "You've sent a lot of messages recently. Please wait a few minutes and try again." }),
      { status: 429, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  try {
    const body  = await req.json();
    const msgs: Array<{ role: string; content: string }> = body?.messages ?? [];
    const role: string = body?.role ?? "citizen";

    const systemPrompt = `${EXECUTIVE_SYSTEM_PROMPT}\n\n${getRoleContext(role)}`;

    const contents = msgs.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content ?? "") }],
    }));

    const result = await callGeminiStream(systemPrompt, contents);

    if (typeof result !== "string") {
      return new Response(result, {
        headers: {
          ...headers,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "X-Accel-Buffering": "no",
        },
      });
    }

    return new Response(
      JSON.stringify({ reply: result }),
      { headers: { ...headers, "Content-Type": "application/json" } },
    );

  } catch (err) {
    console.error("[PAWS-CHAT] Unhandled error:", err);
    return new Response(
      JSON.stringify({ reply: getStaticFallback() }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }
});
