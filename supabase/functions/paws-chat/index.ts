import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { EXECUTIVE_SYSTEM_PROMPT } from "../_shared/prompts-executive.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";

// Rate limiting
const RATE_LIMIT = new Map<string, { count: number; reset: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - 600000;
  const record = RATE_LIMIT.get(ip);
  if (!record || record.reset < windowStart) {
    RATE_LIMIT.set(ip, { count: 1, reset: now });
    return true;
  }
  if (record.count >= 30) return false;
  record.count++;
  return true;
}

async function getAIResponse(messages: any[], role: string): Promise<string> {
  const rolePrefixes: Record<string, string> = {
    commissioner: "Role: National Commissioner. Focus on governance and strategy.",
    command: "Role: Command Authority. Focus on operations and deployment.",
    officer: "Role: Field Officer. Focus on execution and safety.",
    breeder: "Role: Breeder League. Focus on standards and advancement.",
    legal: "Role: Legal Partner. Focus on compliance and audit.",
    logistics: "Role: Logistics Partner. Focus on traceability.",
    church: "Role: Church Elder. Focus on ethical stewardship.",
    media: "Role: Media. Focus on transparency and public trust.",
    citizen: "Role: Citizen. Focus on accessibility and clarity."
  };

  const roleContext = rolePrefixes[role] || rolePrefixes.citizen;
  const systemPrompt = `${EXECUTIVE_SYSTEM_PROMPT}\n\n${roleContext}`;

  // DEBUG: Log if key exists
  console.log("GEMINI_API_KEY exists:", !!GEMINI_API_KEY);

  if (GEMINI_API_KEY) {
    try {
      const contents = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Understood. I am PAWS-OS Executive Intelligence." }] },
        ...messages.map((m: any) => ({
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

      // DEBUG: Log response status
      console.log("Gemini API status:", res.status);
      
      const data = await res.json();
      console.log("Gemini response:", JSON.stringify(data).slice(0, 200));

      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (reply) {
        return reply;
      } else {
        console.log("No reply in response, using fallback");
        return getFallbackResponse("AI returned empty response");
      }
    } catch (e) {
      console.error("Gemini error:", e);
      return getFallbackResponse(e.message);
    }
  }

  return getFallbackResponse("No API key configured");
}

function getFallbackResponse(reason: string): string {
  return `🎯 CONCLUSION
AI service issue: ${reason}

📊 EVIDENCE BASE
• Service: paws-chat/paws-council Edge Function
• Status: Running but encountered error
• Error: ${reason}

🔍 METHODOLOGY
1. Received user query
2. Attempted to route to Gemini API
3. Encountered: ${reason}
4. Returned diagnostic fallback

⚖️ CONFIDENCE: N/A (service issue)

🔗 AUDIT TRAIL
• Function: paws-chat
• Timestamp: ${new Date().toISOString()}
• Error: ${reason}

To fix:
1. Verify GEMINI_API_KEY is set: supabase secrets list
2. Check key is valid at https://makersuite.google.com/app/apikey
3. Redeploy: supabase functions deploy paws-chat`;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded" }),
      { status: 429, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const messages = body?.messages || [];
    const role = body?.role || "citizen";
    const lastMessage = messages[messages.length - 1]?.content || "";

    // Log to audit
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    await supabase.from("paws_audit_log").insert({
      actor_role: role,
      action: "AI_QUERY",
      target_id: "chat",
      metadata: {
        query: lastMessage.slice(0, 500),
        ip_hash: ip,
        timestamp: new Date().toISOString()
      }
    });

    // Get AI response (ALWAYS returns string now)
    const reply = await getAIResponse(messages, role);

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...headers, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});
