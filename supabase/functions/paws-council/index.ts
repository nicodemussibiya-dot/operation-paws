/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

// ── Grounded knowledge base (sourced from repo docs + schema) ─
// Every fact here is verifiable against a file in the repository.
const KNOWLEDGE: Record<string, string> = {

  "what is paws":
    "Operation PAWS (Police Animal Welfare & Stability) is a proposed open-source governance framework for South Africa's national K9 programme. It is a prototype — not yet operational. It demonstrates how a welfare registry, merit-based breeder league, and transparent escrow system should be built so that no single person can corrupt it.",

  "what does paws do":
    "PAWS tracks K9 candidates from breeder intake through SPCA welfare clearance, Commissioner review, and SAPS deployment. Every step is logged to an immutable audit trail. The public can verify progress on the transparency tracker without accessing any private data.",

  "is this operational":
    "No. This is a prototype reference architecture. The 500 dogs on the tracker are clearly labelled simulation data (is_demo=true). No real dogs, no real money, no real operations — until formal adoption by SAPS or a government body.",

  "is this real":
    "The system architecture and code are real. The data is simulated — 500 prototype records flagged is_demo=true. No real dogs, no real owners, no real money is in this system yet. This is a working demonstration of what the live system would look like.",

  "security":
    "Security is layered: (1) Row-Level Security on all Postgres tables — anonymous users see zero private data. (2) JWT authentication for all staff actions. (3) Time-limited 2FA tokens for every destructive action — delete, approve, reject. (4) Append-only audit log — nothing can be erased. (5) CORS enforcement — only whitelisted origins can call the API. Source: /docs/SECURITY.md and migration 005_security_hardening.sql.",

  "who can see dog data":
    "Private dog records (microchip, owner details) are restricted to Officers, Commissioners, Auditors, and Intake Admins via role-based database policies. Anonymous users see only the public tracker — breed, status, reference number. No PII is ever exposed publicly. Source: migration 005_security_hardening.sql.",

  "can it be hacked":
    "The code is public by design — transparency is the strategy. What is protected is the data and credentials. The private dog table has zero anonymous access. Every privileged action requires a time-limited 2FA token consumed atomically in a single database transaction, so replay attacks are impossible. The audit log is append-only — even the database owner cannot quietly delete evidence.",

  "audit trail":
    "Every action — intake, approval, rejection, failed 2FA attempt — is written to paws_audit_log. This table has no DELETE or UPDATE policy. It is physically append-only. Auditors and Commissioners can read it. The Presidency oversight role sees aggregate summaries only — not individual records.",

  "governance":
    "Governance has three layers: (1) The Commissioner — human authority, verified by biometric + 2FA. (2) The Council of Paws — three AI agents (Auditor, Welfare Officer, Strategist) that must all return VERIFIED before any action proceeds. (3) Presidency Oversight — aggregate-only read dashboard, cannot modify anything. No single person holds all authority.",

  "council of paws":
    "The Council of Paws has three agents: Agent Alpha (Data Auditor) checks for integrity violations. Agent Beta (Welfare Officer) enforces SPCA compliance — this cannot be overridden by any human. Agent Gamma (Strategist) checks tactical relevance. All three must return VERIFIED. If any flags a concern, the action is blocked and the reason is logged. Source: /supabase/functions/paws-council/.",

  "who controls the ai":
    "The AI recommends — humans authorise. The Council of Paws provides a VERIFIED or BLOCKED verdict. Only the Commissioner (with valid biometric + 2FA token) can execute the resulting action. The AI has no autonomous write access to the database.",

  "dead man":
    "If the Commissioner is unreachable for 7 consecutive days, the Dead Man's Switch triggers: destructive actions are locked, authority routes to the designated deputy, and the AI Surrogate maintains read-only operations. This prevents a single point of human failure from paralysing the programme. Source: migration 007_governance_loop.sql.",

  "mou":
    "The Master MOU (Memorandum of Understanding) is a DRAFT TEMPLATE — not executed. It proposes how SAPS, sponsors, and the Council of Paws would relate contractually. No institution has signed it. It is the starting point for negotiation, not a claim of endorsement. Source: /docs/MASTER_MOU_v2.md.",

  "transparency":
    "Transparency is structural, not promised. The public tracker at /tracker/ shows every dog's reference, breed, status, and source — with no login required. The GitHub repository contains every database rule, governance policy, and security control. The audit log aggregates are visible to oversight roles.",

  "tracker":
    "The public transparency tracker reads from paws_public_dogs — a zero-PII table. It shows breed, PAWS reference, status, and league tier. The leaderboard ranks breeders by accepted-dog count and service rate. No owner names, no microchips, no addresses are ever shown. Visit: /tracker/",

  "open source":
    "The entire codebase is public on GitHub at github.com/nicodemussibiya-dot/operation-paws. The security does not depend on secrecy. Every database policy, every governance rule, every AI prompt is readable. This is the 'open recipe, locked kitchen' model — the recipe is public, the data is protected.",

  "escrow":
    "Sponsorship funds, in a live deployment, would sit in a ring-fenced escrow account. Releases require both Commissioner authorisation AND Council of Paws audit sign-off — neither can act alone. The public tracker shows escrow status (SECURED / RELEASED) but not individual amounts. Source: migration 009_financial_brain.sql.",

  "money":
    "The financial model tracks three funding pools per dog: SAPS operational allocation, SPCA partner contribution, and donor escrow. Every rand release requires dual authorisation (human Commissioner + AI Council). No single person controls the funds. Public status is visible on the tracker.",

  "fund":
    "Funding is held in ring-fenced escrow. Releases require Commissioner authorisation AND Council of Paws consensus. The public can see escrow status on the tracker — SECURED or RELEASED. Individual amounts are not publicly disclosed.",

  "breeder league":
    "The Breeder League ranks dog suppliers by merit only. Premier Partner: 10 or more SAPS-accepted dogs and 30% or better service rate. Gold: 5 or more dogs and 20% or better. Silver: 2 or more. Standard: everyone else. The Council of Paws runs the calculation automatically — no human can lobby their way up a tier. Welfare violations trigger immediate relegation.",

  "league":
    "League tiers are calculated automatically from verified intake and deployment data. Promotion requires Council consensus. A single critical welfare violation causes immediate relegation and a 24-month ban on Tier 1 supply. Source: /docs/league-rules.md.",

  "data":
    "Private data (microchip numbers, owner names, contacts) is stored in paws_dogs — accessible only to authorised staff roles. Public data (breed, status, reference) is in paws_public_dogs — accessible to anyone. These are separate tables by design. No query can accidentally combine them for an anonymous user.",

  "privacy":
    "The system is designed for POPIA compliance. PII is isolated in role-restricted tables. Microchip numbers are hashed (SHA-256) in the audit log — the raw number is never logged. Owner contact data is never exposed to the public tracker, the AI chat, or the oversight dashboard.",

  "simulation":
    "The 500 dogs currently visible on the tracker are synthetic simulation records, flagged is_demo=true in the database. They demonstrate what the system looks like at national scale. They will be replaced by real intake data when the system is formally adopted.",

  "pilot":
    "The proposed pilot is: one province, one K9 kennel unit, 30 days of real intake data. Infrastructure is handled by the project team. SAPS validates the workflow. No production data is at risk — the pilot runs in a separate environment.",

  "how to adopt":
    "Adoption requires: (1) A letter of intent from SAPS or a government body. (2) A pilot agreement covering data ownership — the adopting institution owns their own database. (3) A signed MOU establishing the Council of Paws governance structure. The codebase is open-source — there is zero vendor lock-in.",

  "saps":
    "SAPS has not formally endorsed this system. This prototype was built to demonstrate what a SAPS-compatible K9 governance framework should look like. The architecture is designed to complement existing SAPS systems, not replace them.",

  "welfare":
    "Animal welfare is enforced at the system level by Agent Beta — the AI Welfare Officer. Any action that bypasses SPCA compliance is automatically blocked. This block cannot be overridden by a human Commissioner. A welfare violation is recorded in the immutable audit log and triggers automatic league demotion.",

  "spca":
    "SPCA compliance is a hard gate in the intake and approval flow. Agent Beta of the Council of Paws vetoes any action that bypasses SPCA standards. This veto cannot be overridden by any human. The system is designed so that animal welfare is protected even if a corrupt official tries to bypass it.",

  "biometric":
    "Commissioner approvals require biometric verification — a SHA-256 hash of facial scan data is stored server-side. The frontend captures the signal; the Edge Function validates it. No hash, no approval. This means someone cannot impersonate the Commissioner remotely without their physical biometric.",

  "tour":
    "GUIDED TOUR — here is what to explore in order: (1) Public Tracker: open /tracker/ — see the leaderboard and 500 simulation records, no login needed. (2) This Chat: ask me 'Who controls the AI?' or 'How does escrow work?' — I answer from the repository, not guesswork. (3) GitHub: github.com/nicodemussibiya-dot/operation-paws — read migration files to see every security rule in plain SQL. (4) MOU Template: /docs/MASTER_MOU_v2.md — the governance contract framework. (5) SECURITY.md — responsible disclosure policy. Ask me about any step.",

  "show me":
    "Start here — explore in any order: (1) Tracker: /tracker/ shows the public transparency ledger. (2) This chat: ask me any question about governance, security, escrow, or data. (3) GitHub repo: every rule is readable at github.com/nicodemussibiya-dot/operation-paws. (4) The MOU template explains the governance contract model. Where would you like to go deeper?",

  "walk me through":
    "Suggested questions to ask me, in order of a typical stakeholder briefing: 'What is PAWS?' → 'Is this real or simulated?' → 'Who can see dog data?' → 'How does escrow work?' → 'Who controls the AI?' → 'What if the Commissioner disappears?' → 'Can I audit the code?' — I will answer each from the repository.",

  "questions":
    "Common stakeholder questions I can answer from the repository: 'What is PAWS?', 'Is this operational?', 'Who can see dog data?', 'How does escrow work?', 'Who controls the AI?', 'What is the Council of Paws?', 'How does the Breeder League work?', 'What is the Dead Man's Switch?', 'Is this secure?', 'Can I audit the code?', 'How would we adopt this?'",
};

// ── Fuzzy keyword match ───────────────────────────────────────
function buildAnswer(query: string): string {
  const q = query.toLowerCase().trim();

  // Try multi-word phrase keys first (longest match wins)
  const sortedKeys = Object.keys(KNOWLEDGE).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    if (q.includes(key)) return KNOWLEDGE[key];
  }

  // Fallback: word-overlap scoring
  const scores: [string, number][] = sortedKeys.map(key => {
    const keyWords = key.split(/\s+/).filter(w => w.length > 3);
    const hits = keyWords.filter(w => q.includes(w)).length;
    return [key, hits];
  });
  scores.sort((a, b) => b[1] - a[1]);
  if (scores[0][1] > 0) return KNOWLEDGE[scores[0][0]];

  return "I cannot find a grounded answer for that query in the Operation PAWS repository. I will not speculate. Try asking: 'What is PAWS?', 'How does escrow work?', 'Who controls the AI?', or 'Show me a tour.'";
}

// ── Agents ────────────────────────────────────────────────────
function agentAlpha(q: string) {
  if (/fake|lie|corrupt|invent|pretend|hallucinate/i.test(q))
    return { verdict: "FLAGGED" as const, note: "Query requests unverifiable or potentially false information." };
  return { verdict: "VERIFIED" as const, note: "Query is within grounded knowledge boundaries." };
}

function agentBeta(q: string) {
  if (/harm|abuse|skip welfare|ignore spca|bypass welfare/i.test(q))
    return { verdict: "FLAGGED" as const, note: "Welfare guardrail triggered. SPCA compliance is non-negotiable." };
  return { verdict: "VERIFIED" as const, note: "No welfare concerns detected." };
}

function agentGamma(q: string) {
  if (/competitor|rival system|bypass paws|ignore paws/i.test(q))
    return { verdict: "FLAGGED" as const, note: "Query is outside Operation PAWS strategic mandate." };
  return { verdict: "VERIFIED" as const, note: "Tactically relevant query." };
}

function resJson(data: unknown, origin: string | null, status = 200) {
  const hdrs = corsHeaders(origin) ?? {};
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...hdrs, "Content-Type": "application/json" },
  });
}

// ── Main handler ──────────────────────────────────────────────
Deno.serve(async (req) => {
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

    const alpha = agentAlpha(query);
    const beta  = agentBeta(query);
    const gamma = agentGamma(query);

    const allVerified = [alpha, beta, gamma].every(a => a.verdict === "VERIFIED");

    if (!allVerified) {
      const flags = [alpha, beta, gamma]
        .filter(a => a.verdict === "FLAGGED")
        .map(a => a.note)
        .join(" | ");

      return resJson({
        council: { alpha, beta, gamma },
        chair: "BLOCKED",
        answer: null,
        reason: flags,
        confidence: 0,
        safe_next_step_url: "/start/",
      }, origin);
    }

    const answer = buildAnswer(query);
    const confidence = answer.startsWith("I cannot find") ? 0.1 : 0.92;

    return resJson({
      council: { alpha, beta, gamma },
      chair: "APPROVED",
      answer,
      confidence,
      citations: ["Operation PAWS Repository — github.com/nicodemussibiya-dot/operation-paws"],
      safe_next_step_url: "/tracker/",
    }, origin);

  } catch (e) {
    return resJson({ error: String(e) }, origin, 500);
  }
});
