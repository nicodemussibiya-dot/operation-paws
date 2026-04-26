/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── Knowledge base grounded in the repo ─────────────────────
// In production this would be a proper RAG pipeline over the repo docs.
// Here we keep a compact, provable fact set as the "source of truth."
const KNOWLEDGE: Record<string, string> = {
  governance:   "Operation PAWS is governed by the Council of Paws (COP). All decisions require round-robin consensus from Agent Alpha (Auditor), Agent Beta (Welfare), and Agent Gamma (Strategist) before the Chair acts. See /01_GOVERNANCE.md.",
  security:     "The system uses RLS, JWT, and 2FA. The paws_dogs table is never exposed to anonymous users. All actions are logged to an append-only audit trail. See /docs/06_SECURITY.md.",
  league:       "Breeder promotion is merit-based. Premier Partner requires ≥10 SAPS-accepted dogs and ≥30% service rate. Gold requires ≥5 and ≥20%. Silver ≥2. All promotions are signed by the Chair after COP consensus. See /docs/league-rules.md.",
  escrow:       "Funding is held in a ring-fenced escrow account. Releases require Commissioner authorization and COP audit sign-off. The public tracker shows escrow status but not individual amounts.",
  dms:          "The Dead Man's Switch activates if the Commissioner is unreachable for 7 days. The AI Surrogate locks destructive actions and routes authority to the designated deputy.",
  biometric:    "Commissioner approvals require biometric identity verification (SHA-256 facial scan hash stored server-side). The frontend captures the signal; the hash is verified by the paws-secure-action Edge Function.",
  demo:         "The national tracker currently shows a SIMULATION dataset of 500 demo dogs (is_demo=true) to demonstrate project scale. Real dogs will replace demo data as intake occurs.",
  mou:          "The Master MOU v2.0 formally recognizes the Council of Paws as the governing body. No human official can unilaterally override COP welfare or aptitude findings. See /docs/MASTER_MOU_v2.md.",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Agent simulation ─────────────────────────────────────────
function agentAlpha(query: string): { verdict: "VERIFIED" | "FLAGGED"; note: string } {
  // Auditor: checks data integrity keywords
  if (query.match(/fake|lie|corrupt|invent|claim/i))
    return { verdict: "FLAGGED", note: "Query requests unverifiable or potentially false claim." };
  return { verdict: "VERIFIED", note: "Query is within grounded knowledge boundaries." };
}

function agentBeta(query: string): { verdict: "VERIFIED" | "FLAGGED"; note: string } {
  // Welfare Officer: blocks welfare violations
  if (query.match(/harm|abuse|skip welfare|ignore spca/i))
    return { verdict: "FLAGGED", note: "Welfare guardrail triggered. SPCA compliance is non-negotiable." };
  return { verdict: "VERIFIED", note: "No welfare concerns detected." };
}

function agentGamma(query: string): { verdict: "VERIFIED" | "FLAGGED"; note: string } {
  // Strategist: checks tactical relevance
  if (query.match(/competitor|rival system|bypass paws/i))
    return { verdict: "FLAGGED", note: "Query is outside Operation PAWS strategic mandate." };
  return { verdict: "VERIFIED", note: "Tactically relevant query." };
}

// ── Chair: ground response to known facts only ───────────────
function buildAnswer(query: string): string {
  const q = query.toLowerCase();
  const matched: string[] = [];

  for (const [key, fact] of Object.entries(KNOWLEDGE)) {
    if (q.includes(key) || fact.toLowerCase().split(" ").some(w => w.length > 5 && q.includes(w))) {
      matched.push(fact);
    }
  }

  if (matched.length === 0) {
    return "I cannot find a grounded answer for that query in the Operation PAWS repository. I will not speculate. Please consult the governance documents or the National Commissioner.";
  }
  return matched.slice(0, 2).join(" | ");
}

// ── Main handler ─────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const { query, role } = await req.json();
    if (!query || typeof query !== "string") return json({ error: "query required" }, 400);

    // Round-robin council
    const alpha  = agentAlpha(query);
    const beta   = agentBeta(query);
    const gamma  = agentGamma(query);

    const allVerified = [alpha, beta, gamma].every(a => a.verdict === "VERIFIED");

    if (!allVerified) {
      const flags = [alpha, beta, gamma]
        .filter(a => a.verdict === "FLAGGED")
        .map(a => a.note)
        .join(" | ");

      return json({
        council: { alpha, beta, gamma },
        chair: "BLOCKED",
        answer: null,
        reason: flags,
        confidence: 0,
        safe_next_step_url: "/start/",
      });
    }

    const answer = buildAnswer(query);
    const confidence = answer.includes("cannot find") ? 0.1 : 0.92;

    return json({
      council: { alpha, beta, gamma },
      chair: "APPROVED",
      answer,
      confidence,
      citations: Object.keys(KNOWLEDGE).filter(k => answer.toLowerCase().includes(k)),
      safe_next_step_url: "/tracker/",
    });

  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
