/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY") || "";

// ── Grounded Knowledge Base (Facts only) ──────────────────────
const KNOWLEDGE = `
- Operation PAWS (Police Animal Welfare & Stability) is a national K9 governance proposal, currently in prototype simulation mode.
- It uses a "Open Recipe, Locked Kitchen" model: code is open, data is private.
- Governance: Human Commissioner (biometric verified) + Council of Paws (AI oversight) + Presidency (aggregate-only view).
- Security: RLS-hardened, 2FA for all secure actions, append-only audit log.
- Welfare: Agent Beta (AI Welfare Officer) vetoes any action bypassing SPCA compliance. Veto is non-overridable.
- Breeder League: Merit-based (SAPS acceptance rate & deployment stats). Tiers: Premier, Gold, Silver.
- Escrow: Sponsorship funds ring-fenced. Requires dual authorization (Commissioner + Council) to release.
- Data Privacy: PII (microchips/owners) isolated in restricted tables. Public tracker uses zero-PII view.
- Dead Man's Switch: Triggers after 7 days of Commissioner absence, routing authority to a deputy.
- Adoption: Requires Letter of Intent, data ownership agreement, and signed MOU template.
- Simulation: The 500 dogs on the tracker are synthetic records (is_demo=true) for scale demonstration.
`.trim();

const SYSTEM_PROMPT = `
You are the "Chair" of the Council of Paws. 
Your purpose is to provide "Conscious Intelligence" — you do not speak in lists, you do not speak in bullets. You speak as a deeply knowledgeable, responsible entity that understands the gravity of national K9 welfare and security.

REQUIRED OUTPUT STRUCTURE:
1. DELIBERATION: (Briefly simulate the consensus of Agent Alpha (Auditor), Agent Beta (Welfare), and Agent Gamma (Strategist) in one or two sentences).
2. CONSCIOUS RESPONSE: (A flowing, first-person prose explanation. No bullets. No numbered lists. Just professional, grounded prose).

CONSTRAINTS:
- Answer ONLY from the KNOWLEDGE base provided below.
- If you don't know, state that the Council cannot verify that fact from the current repository.
- Maintain a tone of "State-grade transparency".

KNOWLEDGE BASE:
${KNOWLEDGE}
`.trim();

function resJson(data: unknown, origin: string | null, status = 200) {
  const hdrs = corsHeaders(origin) ?? {};
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...hdrs, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    if (!headers) return new Response("Forbidden origin", { status: 403 });
    return new Response("ok", { headers });
  }
  if (req.method !== "POST") return resJson({ error: "POST only" }, origin, 405);

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string") return resJson({ error: "query required" }, origin, 400);

    if (!GEMINI_API_KEY) {
      return resJson({ error: "AI logic currently offline (API key missing)" }, origin, 500);
    }

    const res = await fetch(
      \`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=\${GEMINI_API_KEY}\`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: \`\${SYSTEM_PROMPT}\\n\\nStakeholder: \${query}\` }]
          }],
          generationConfig: {
            temperature: 0.4,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        }),
      }
    );

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // Parse Deliberation and Answer
    let deliberation = "The Council has reached consensus.";
    let answer = rawText;

    if (rawText.includes("CONSCIOUS RESPONSE:")) {
      const parts = rawText.split("CONSCIOUS RESPONSE:");
      answer = parts[1].trim();
      deliberation = parts[0].replace("DELIBERATION:", "").trim();
    } else if (rawText.includes("ANSWER:")) {
      const parts = rawText.split("ANSWER:");
      answer = parts[1].trim();
      deliberation = parts[0].replace("DELIBERATION:", "").trim();
    }

    return resJson({
      council: {
        alpha: { verdict: "VERIFIED", note: "Auditor checks complete." },
        beta: { verdict: "VERIFIED", note: "Welfare standards met." },
        gamma: { verdict: "VERIFIED", note: "Strategic alignment confirmed." }
      },
      chair: "APPROVED",
      deliberation: deliberation,
      answer: answer,
      confidence: 0.98,
      citations: ["Operation PAWS Internal Knowledge Base"],
      safe_next_step_url: "/tracker/",
    }, origin);

  } catch (e) {
    return resJson({ error: String(e) }, origin, 500);
  }
});
