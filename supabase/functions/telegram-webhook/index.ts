// supabase/functions/telegram-webhook/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const SUPABASE_FUNCTION_PAWS_CHAT = Deno.env.get("SUPABASE_FUNCTION_PAWS_CHAT") ?? ""; 
const TELEGRAM_SECRET_TOKEN = Deno.env.get("TELEGRAM_SECRET_TOKEN") ?? "";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");

  // Fail closed if missing critical env vars
  if (!TELEGRAM_BOT_TOKEN || !SUPABASE_FUNCTION_PAWS_CHAT) {
    console.error("Missing critical messaging env vars");
    return new Response("ok", { status: 500 });
  }

  // Verify Telegram secret token to prevent spoofing
  const secretHeader = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (TELEGRAM_SECRET_TOKEN && secretHeader !== TELEGRAM_SECRET_TOKEN) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const update = await req.json();
    const msg = update?.message;
    const chatId = msg?.chat?.id;
    const text = msg?.text;

    if (!chatId || !text) return new Response("ok");

    const reply = await routeToAI(text);

    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: reply,
        disable_web_page_preview: true
      }),
    });

    return new Response("ok");
  } catch (err) {
    console.error("Telegram error:", err);
    return new Response("ok");
  }
});

async function routeToAI(userText: string): Promise<string> {
  // Basic guard: keep Telegram bot public-safe too
  try {
    const res = await fetch(SUPABASE_FUNCTION_PAWS_CHAT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-secret": Deno.env.get("INTERNAL_SECRET") || "" },
      body: JSON.stringify({ messages: [{ role: "user", content: userText }] })
    });
    const data = await res.json();
    return data?.reply || "Sorry — I had a problem replying. Please try again.";
  } catch (e) {
    console.error("Route to AI error:", e);
    return "Sorry — I had a problem replying. Please try again.";
  }
}
