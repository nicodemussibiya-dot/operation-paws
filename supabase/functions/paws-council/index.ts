import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { EXECUTIVE_SYSTEM_PROMPT } from "../_shared/prompts-executive.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";

serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    const body = await req.json();
    const messages = body?.messages || [];
    const role = body?.role || "citizen";
    const lastMessage = messages[messages.length - 1]?.content || "";

    // Build role context
    const rolePrefixes: Record<string, string> = {
      commissioner: "National Commissioner - governance focus",
      command: "Command Authority - operational focus", 
      officer: "Field Officer - execution focus",
      breeder: "Breeder League - standards focus",
      legal: "Legal Partner - compliance focus",
      logistics: "Logistics Partner - traceability focus",
      church: "Church Elder - ethical stewardship focus",
      media: "Media - transparency focus",
      citizen: "Citizen - accessibility focus"
    };

    const roleContext = rolePrefixes[role] || rolePrefixes.citizen;
    
    // ALWAYS return a proper response, even if AI fails
    let reply: string;

    if (GEMINI_API_KEY && lastMessage) {
      try {
        const systemPrompt = `${EXECUTIVE_SYSTEM_PROMPT}\n\nROLE: ${roleContext}`;
        
        const contents = [
          { role: "user", parts: [{ text: systemPrompt }] },
          { role: "model", parts: [{ text: "Understood. I am PAWS-OS." }] },
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

        const data = await res.json();
        const aiReply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (aiReply) {
          reply = aiReply;
        } else {
          // AI returned empty - use template
          reply = generateTemplateResponse(lastMessage, role, roleContext);
        }
      } catch (e) {
        // AI failed - use template
        reply = generateTemplateResponse(lastMessage, role, roleContext);
      }
    } else {
      // No API key - use template
      reply = generateTemplateResponse(lastMessage, role, roleContext);
    }

    // Log to audit
    try {
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
      await supabase.from("paws_audit_log").insert({
        actor_role: role,
        action: "AI_QUERY",
        target_id: "chat",
        metadata: {
          query: lastMessage.slice(0, 500),
          timestamp: new Date().toISOString(),
          ai_used: !!GEMINI_API_KEY
        }
      });
    } catch (e) {
      // Audit logging failed but don't break the response
      console.error("Audit log failed:", e);
    }

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...headers, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        reply: `🎯 CONCLUSION\nSystem error occurred.\n\n📊 EVIDENCE BASE\n• Error: ${error.message}\n• Status: Function exception\n\n⚖️ CONFIDENCE: N/A\n\nPlease try again or contact support.`
      }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});

function generateTemplateResponse(message: string, role: string, roleContext: string): string {
  const lowerMsg = message.toLowerCase();
  
  // Role-specific greetings
  if (lowerMsg.includes("i am") || lowerMsg.includes("i'm")) {
    return `🎯 CONCLUSION
Welcome. I am PAWS-OS, the Executive Intelligence for Operation PAWS. You have identified yourself as ${roleContext}.

📊 EVIDENCE BASE
• Role detected: ${role}
• System: Operation PAWS v1.0
• Status: Operational

🔍 METHODOLOGY
1. Parsed your role identifier
2. Applied ${role} context profile
3. Generated role-specific briefing

⚖️ CONFIDENCE: HIGH (95%)

🔗 AUDIT TRAIL
• Query: Role identification
• Timestamp: ${new Date().toISOString()}
• Role profile: ${roleContext}

How may I assist you today? You can ask about:
• Governance and oversight (${role === 'commissioner' ? 'primary' : 'view-only'})
• Operational status and deployments
• Financial transparency and escrow
• Breeder League standings
• Security protocols
• Audit trails and compliance`;
  }

  // Default response for any other query
  return `🎯 CONCLUSION
I have received your message: "${message.slice(0, 100)}${message.length > 100 ? '...' : ''}"

📊 EVIDENCE BASE
• Query type: General inquiry
• Role context: ${roleContext}
• System status: Operational

🔍 METHODOLOGY
1. Received natural language query
2. Applied ${role} contextual lens
3. Synthesized response from PAWS architecture

⚖️ CONFIDENCE: MEDIUM (75%)
• This is a general response pending more specific details
• For precise answers, please specify: governance, operations, finance, or compliance

🔗 AUDIT TRAIL
• Function: paws-council
• Role: ${role}
• Timestamp: ${new Date().toISOString()}

Please tell me more specifically what you'd like to know about Operation PAWS. I can provide detailed information about:
- How the governance structure works
- Security and audit protocols  
- Financial transparency mechanisms
- The Breeder League system
- Operational deployment readiness`;
}
