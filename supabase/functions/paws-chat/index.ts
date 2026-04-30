import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { EXECUTIVE_SYSTEM_PROMPT, getRoleContext } from "../_shared/prompts-executive.ts";

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

const GEMINI_KEYS = loadGeminiKeys();
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash";

console.log(`[PAWS-CHAT] ${GEMINI_KEYS.length} Gemini key(s) loaded${OPENROUTER_API_KEY ? " + OpenRouter" : ""}`);

// Keys exhausted in this cold-start instance
const exhaustedKeys = new Set<string>();
// Reset every hour
setInterval(() => exhaustedKeys.clear(), 60 * 60 * 1000);

// ─── Rate limiting ─────────────────────────────────────────────────────────────
const RATE_LIMIT = new Map<string, { count: number; reset: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = RATE_LIMIT.get(ip);
  if (!record || record.reset < now - 600000) {
    RATE_LIMIT.set(ip, { count: 1, reset: now });
    return true;
  }
  if (record.count >= 30) return false;
  record.count++;
  return true;
}

const STATIC_FALLBACK =
  "PAWS-OS is experiencing high demand right now. Please try again in a moment, " +
  "or contact your PAWS liaison officer directly for urgent assistance.";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── OpenRouter fallback ───────────────────────────────────────────────────────
async function callOpenRouter(
  systemPrompt: string,
  contents: Array<{ role: string; parts: Array<{ text: string }> }>,
): Promise<string> {
  if (!OPENROUTER_API_KEY) return STATIC_FALLBACK;

  const model = "google/gemini-2.0-flash-exp:free";
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
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://operation-paws.demo",
        "X-Title": "PAWS Command Center",
      },
      body: JSON.stringify({ model, messages }),
    });
    if (!res.ok) return STATIC_FALLBACK;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || STATIC_FALLBACK;
  } catch {
    return STATIC_FALLBACK;
  }
}

// ─── Core Gemini call with key rotation ───────────────────────────────────────
async function callGemini(
  systemPrompt: string,
  contents: Array<{ role: string; parts: Array<{ text: string }> }>,
  usedKeys: Set<string> = new Set(),
  attempt = 1,
): Promise<string> {
  const apiKey = GEMINI_KEYS.find((k) => !exhaustedKeys.has(k) && !usedKeys.has(k)) ?? null;

  if (!apiKey) {
    console.warn("[PAWS-CHAT] All Gemini keys exhausted → OpenRouter");
    return callOpenRouter(systemPrompt, contents);
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
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body,
      },
    );
  } catch {
    usedKeys.add(apiKey);
    return callGemini(systemPrompt, contents, usedKeys, 1);
  }

  // Quota exhausted → rotate key immediately
  if (res.status === 429) {
    console.warn("[PAWS-CHAT] 429 quota hit — rotating key");
    exhaustedKeys.add(apiKey);
    usedKeys.add(apiKey);
    return callGemini(systemPrompt, contents, usedKeys, 1);
  }

  // Transient error → retry same key with back-off (max 2 times)
  if (res.status === 503) {
    if (attempt <= 2) {
      await sleep(800 * attempt);
      return callGemini(systemPrompt, contents, usedKeys, attempt + 1);
    }
    usedKeys.add(apiKey);
    return callGemini(systemPrompt, contents, usedKeys, 1);
  }

  if (!res.ok) {
    // Any other error — try next key
    usedKeys.add(apiKey);
    return callGemini(systemPrompt, contents, usedKeys, 1);
  }

  const data = await res.json();
  const reply = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p?.text ?? "")
    .join("")
    .trim();

  return reply || STATIC_FALLBACK;
}

// ─── HTTP Server ───────────────────────────────────────────────────────────────
serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") return new Response("ok", { headers });

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
      { status: 429, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  try {
    const body = await req.json();
    const messages: Array<{ role: string; content: string }> = body?.messages ?? [];
    const role: string = body?.role ?? "citizen";

    const roleContext = getRoleContext(role);
    const systemPrompt = `${EXECUTIVE_SYSTEM_PROMPT}\n\n${roleContext}`;

    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content ?? "") }],
    }));

    const reply = await callGemini(systemPrompt, contents);

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...headers, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }
});
