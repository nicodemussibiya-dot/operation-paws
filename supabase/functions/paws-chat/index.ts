import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { EXECUTIVE_SYSTEM_PROMPT, getRoleContext } from "../_shared/prompts-executive.ts";

// ─── CORS ──────────────────────────────────────────────────────────────────────
function corsHeaders(origin: string | null): HeadersInit {
  const allowList = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);

  const allowed =
    !origin ||                          // server-to-server — allow
    allowList.length === 0 ||           // no list configured — allow all (dev)
    allowList.includes(origin);         // origin is in the list

  return {
    "Access-Control-Allow-Origin": allowed ? (origin ?? "*") : "null",
    "Vary": "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-internal-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// ─── Multi-key pool ────────────────────────────────────────────────────────────
function loadGeminiKeys(): string[] {
  const keys: string[] = [];
  const legacy = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_API_KEY");
  if (legacy) keys.push(legacy);
  for (let i = 1; i <= 10; i++) {
    const k = Deno.env.get(`GEMINI_API_KEY_${i}`);
    if (k && !keys.includes(k)) keys.push(k);
  }
  return keys;
}

const GEMINI_KEYS      = loadGeminiKeys();
const OPENROUTER_KEY   = Deno.env.get("OPENROUTER_API_KEY");
const GEMINI_MODEL     = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash";

console.log(`[PAWS-CHAT] ${GEMINI_KEYS.length} Gemini key(s) | model: ${GEMINI_MODEL}${OPENROUTER_KEY ? " | OpenRouter ✓" : ""}`);

const exhaustedKeys = new Set<string>();
setInterval(() => exhaustedKeys.clear(), 60 * 60 * 1000);

// ─── Rate limiting ─────────────────────────────────────────────────────────────
const RATE_LIMIT = new Map<string, { count: number; reset: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const rec = RATE_LIMIT.get(ip);
  if (!rec || rec.reset < now - 600_000) { RATE_LIMIT.set(ip, { count: 1, reset: now }); return true; }
  if (rec.count >= 30) return false;
  rec.count++;
  return true;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── SSE stream builder ────────────────────────────────────────────────────────
// Wraps a ReadableStream from Gemini's streaming API into our SSE format.
// Each chunk becomes: "data: <text>\n\n"
function buildSSEStream(
  geminiStream: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
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

          // Gemini streaming returns a JSON array fragment per chunk.
          // We parse complete JSON objects out of the buffer.
          // Each chunk looks like: ,\n{"candidates":[{"content":{"parts":[{"text":"..."}]}}]}
          // We extract the text field and forward it.
          const textMatches = buffer.matchAll(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g);
          let lastIndex = 0;

          for (const match of textMatches) {
            // Unescape JSON string escapes
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

          // Keep only unparsed tail in buffer (avoid it growing unbounded)
          if (lastIndex > 0) buffer = buffer.slice(lastIndex);
          if (buffer.length > 8192) buffer = buffer.slice(-4096); // safety trim
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

// ─── Gemini streaming call ─────────────────────────────────────────────────────
async function callGeminiStream(
  systemPrompt: string,
  contents: Array<{ role: string; parts: Array<{ text: string }> }>,
  usedKeys: Set<string> = new Set(),
  attempt = 1,
): Promise<ReadableStream<Uint8Array> | string> {

  const apiKey = GEMINI_KEYS.find((k) => !exhaustedKeys.has(k) && !usedKeys.has(k)) ?? null;

  // No keys left — fall back to OpenRouter (non-streaming) or static
  if (!apiKey) {
    console.warn("[PAWS-CHAT] All Gemini keys exhausted → OpenRouter / static");
    return await callOpenRouterText(systemPrompt, contents);
  }

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: contents.length > 0 ? contents : [{ role: "user", parts: [{ text: "Hello" }] }],
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
  } catch {
    usedKeys.add(apiKey);
    return callGeminiStream(systemPrompt, contents, usedKeys, 1);
  }

  if (res.status === 429) {
    console.warn("[PAWS-CHAT] 429 quota — rotating key");
    exhaustedKeys.add(apiKey);
    usedKeys.add(apiKey);
    return callGeminiStream(systemPrompt, contents, usedKeys, 1);
  }

  if (res.status === 503) {
    if (attempt <= 2) { await sleep(800 * attempt); return callGeminiStream(systemPrompt, contents, usedKeys, attempt + 1); }
    usedKeys.add(apiKey);
    return callGeminiStream(systemPrompt, contents, usedKeys, 1);
  }

  if (!res.ok) {
    usedKeys.add(apiKey);
    return callGeminiStream(systemPrompt, contents, usedKeys, 1);
  }

  // res.body is the raw SSE stream from Gemini — wrap it
  return buildSSEStream(res.body!);
}

// ─── OpenRouter fallback (non-streaming, returns plain text) ──────────────────
async function callOpenRouterText(
  systemPrompt: string,
  contents: Array<{ role: string; parts: Array<{ text: string }> }>,
): Promise<string> {
  if (!OPENROUTER_KEY) return STATIC_FALLBACK;

  const messages = [
    { role: "system", content: systemPrompt },
    ...contents.map((c) => ({
      role: c.role === "model" ? "assistant" : c.role,
      content: c.parts?.[0]?.text ?? "",
    })),
  ];
  if (messages.length === 1) messages.push({ role: "user", content: "Hello" });

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "HTTP-Referer": "https://operationpaws.netlify.app",
        "X-Title": "PAWS Command Center",
      },
      body: JSON.stringify({ model: "google/gemini-2.0-flash-exp:free", messages }),
    });
    if (!res.ok) return STATIC_FALLBACK;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || STATIC_FALLBACK;
  } catch {
    return STATIC_FALLBACK;
  }
}

const STATIC_FALLBACK =
  "PAWS-OS is experiencing high demand right now. Please try again in a moment, " +
  "or contact your PAWS liaison officer directly for urgent assistance.";

// ─── HTTP Server ───────────────────────────────────────────────────────────────
serve(async (req) => {
  const origin  = req.headers.get("origin");
  const headers = corsHeaders(origin);

  // Preflight
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  // Rate limit
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
      { status: 429, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  try {
    const body     = await req.json();
    const msgs: Array<{ role: string; content: string }> = body?.messages ?? [];
    const role: string = body?.role ?? "citizen";

    const roleContext  = getRoleContext(role);
    const systemPrompt = `${EXECUTIVE_SYSTEM_PROMPT}\n\n${roleContext}`;

    const contents = msgs.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content ?? "") }],
    }));

    const result = await callGeminiStream(systemPrompt, contents);

    // ── Streaming response ─────────────────────────────────────────────────────
    if (typeof result !== "string") {
      return new Response(result, {
        headers: {
          ...headers,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "X-Accel-Buffering": "no",       // disables Nginx buffering
        },
      });
    }

    // ── Non-streaming fallback (OpenRouter / static) ───────────────────────────
    return new Response(
      JSON.stringify({ reply: result }),
      { headers: { ...headers, "Content-Type": "application/json" } },
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }
});
