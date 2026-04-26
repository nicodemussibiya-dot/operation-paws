// docs/chat/app.js — PAWS-OS v2: "Be Water"
// Fluid, context-aware, graceful fallback. Never rigid.
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.PAWS_CONFIG;
const COUNCIL_URL = `${SUPABASE_URL}/functions/v1/paws-council`;


// ── Conversation state ────────────────────────────────────────
const state = {
  role: null,
  name: null,
  history: [],   // [{role:'user'|'ai', text}]
  councilOnline: null,  // null=untested, true, false
};

// ── Role definitions ──────────────────────────────────────────
const ROLES = {
  commissioner: {
    label: "National Commissioner",
    greeting: (n) => `SIMULATED DEMO MODE: The national K9 registry is populated with 500 prototype records. Access to the command simulation is authorized. What would you like to explore?`,
    link: { url: "../commissioner/", label: "Open Command Center" },
  },
  elder: {
    label: "Community Leader",
    greeting: (n) => `SIMULATED DEMO MODE: This community portal demonstrates our commitment to transparency. Every action in this simulation is logged to a public ledger. How can I help you explore the model?`,
    link: { url: "../community-briefing/", label: "Read Community Briefing" },
  },
  partner: {
    label: "Strategic Partner",
    greeting: (n) => `SIMULATED DEMO MODE: This dashboard shows how sponsorship funds would be tracked in escrow. Every simulated release requires multi-agent consensus. What would you like to know?`,
    link: { url: "../donate/", label: "View Sponsorship Hub" },
  },
  officer: {
    label: "Field Officer",
    greeting: (n) => `SIMULATED DEMO MODE: Ready for intake simulation. All entries require a 15-digit microchip and welfare verification for the pilot. What do you need?`,
    link: { url: "../admin/", label: "Open Intake Terminal" },
  },
  breeder: {
    label: "League Participant",
    greeting: (n) => `SIMULATED DEMO MODE: The league standings are derived from simulated performance data. This prototype demonstrates merit-only tiering. What's your question?`,
    link: { url: "../tracker/", label: "View League Tracker" },
  },
};

// ── Local intelligence (stakeholder-grade fallback) ───────────
// Mirrors the Council knowledge base so offline mode is equally capable.
const LOCAL_BRAIN = [
  // Greetings
  { pattern: /\b(hi|hello|hey|howzit|sawubona|dumela|good morning|good afternoon)\b/i,
    respond: () => `Hello. I am PAWS-OS — the prototype intelligence for Operation PAWS. I answer from verified facts in the governance repository, not from guesswork.\n\nYou can ask me: "What is PAWS?", "How does the escrow work?", "Who controls the AI?", "Show me a tour" — or anything else about the system.` },

  // Identity
  { pattern: /who are you|what are you|paws.?os|about this system/i,
    respond: () => `I am PAWS-OS — a prototype AI assistant for the Operation PAWS reference architecture. I answer questions about the system from the governance repository. I do not guess, and I do not invent facts.\n\nThis is a simulated demo. No real dogs or money are in this system yet.` },

  // What is PAWS
  { pattern: /what is (paws|this|operation paws)|what does paws do|explain paws/i,
    respond: () => `Operation PAWS (Police Animal Welfare & Stability) is a proposed open-source governance framework for South Africa's national K9 programme.\n\nIt is a prototype — not yet operational. It demonstrates how a welfare registry, merit-based breeder league, and transparent escrow system should be built so that no single person can corrupt it.\n\nKey principles: open code, closed data. Public accountability without exposing private records.` },

  // Is it real / operational
  { pattern: /is this (real|live|operational|working|active)|is this already|already running/i,
    respond: () => `This is a working prototype, not a live operation. The architecture and code are real. The 500 dogs on the tracker are synthetic simulation records (is_demo=true in the database).\n\nNo real dogs, no real owners, no real money are in this system. This demonstration shows what the live system would look like when formally adopted.` },

  // Security
  { pattern: /secur|hack|safe|breach|vulnerab|protected/i,
    respond: () => `Security is layered:\n• Row-Level Security — anonymous users see zero private data\n• JWT authentication for all staff actions\n• Time-limited 2FA tokens for every destructive action (delete, approve, reject)\n• Append-only audit log — nothing can be erased, including failed attempts\n• CORS enforcement — only whitelisted origins can call the API\n\nThe code is public by design. Security does not depend on secrecy — it depends on cryptographic controls and role-based policies. Source: SECURITY.md and migration 005_security_hardening.sql.` },

  // Who can see data
  { pattern: /who can see|who has access|data access|pii|private data|owner details/i,
    respond: () => `Private dog records (microchip numbers, owner names, contacts) are restricted to Officers, Commissioners, Auditors, and Intake Admins via database-enforced role policies.\n\nAnonymous users — including the public and media — see only the transparency tracker: breed, status, and reference number. No PII is ever exposed publicly. These are separate database tables by design. No query can accidentally combine them.` },

  // Audit trail
  { pattern: /audit|log|trail|evidence|accountability|cannot be deleted/i,
    respond: () => `Every action is written to paws_audit_log — an append-only table with no DELETE or UPDATE policy. This includes: intake submissions, approvals, rejections, and failed 2FA attempts.\n\nAuditors and Commissioners can read the full log. The Presidency oversight role sees aggregate summaries only — not individual records. Nothing can be quietly removed.` },

  // Governance / Council of Paws
  { pattern: /govern|council of paws|cop|how decisions|who decides/i,
    respond: () => `Governance has three layers:\n\n1. The Commissioner — human authority, verified by biometric + 2FA\n2. The Council of Paws — three AI agents that must all return VERIFIED:\n   • Agent Alpha (Data Auditor): checks integrity\n   • Agent Beta (Welfare Officer): enforces SPCA compliance — cannot be overridden by any human\n   • Agent Gamma (Strategist): checks tactical relevance\n3. Presidency Oversight — aggregate-only read dashboard, cannot modify anything\n\nNo single person holds all authority.` },

  // Who controls the AI
  { pattern: /who controls the ai|ai authority|can ai override|ai override|ai autonomous/i,
    respond: () => `The AI recommends — humans authorise.\n\nThe Council of Paws provides a VERIFIED or BLOCKED verdict on every request. Only the Commissioner — with a valid biometric check and 2FA token — can execute the resulting action. The AI has no autonomous write access to the database.\n\nIf the Council is BLOCKED, no action occurs regardless of what the Commissioner wants.` },

  // Dead man's switch
  { pattern: /dead man|dms|commissioner disappear|unreachable|offline|deputy/i,
    respond: () => `If the Commissioner is unreachable for 7 consecutive days, the Dead Man's Switch triggers automatically:\n• Destructive actions are locked\n• Authority routes to the designated deputy\n• The AI Surrogate maintains read-only operations\n\nThis prevents a single point of human failure from paralysing the programme. Source: migration 007_governance_loop.sql.` },

  // MOU
  { pattern: /mou|memorandum|agreement|signed|contract|who signed/i,
    respond: () => `The Master MOU (Memorandum of Understanding) is a DRAFT TEMPLATE — not executed. No institution has signed it.\n\nIt proposes how SAPS, sponsors, and the Council of Paws would relate contractually. It is the starting point for negotiation, not a claim of endorsement. Clearly marked DRAFT / TEMPLATE (NOT EXECUTED) in the repository. Source: /docs/MASTER_MOU_v2.md.` },

  // Transparency / Open source
  { pattern: /transparent|open source|public repo|github|can i audit|can i see the code/i,
    respond: () => `Yes. The entire codebase is public at github.com/nicodemussibiya-dot/operation-paws.\n\nEvery database policy, governance rule, security control, and AI prompt is readable by anyone. This is the "open recipe, locked kitchen" model — the recipe (code) is public; the ingredients (data) are protected.\n\nThis means any auditor, journalist, or institution can verify the security claims without trusting our word.` },

  // Public tracker
  { pattern: /tracker|transparency ledger|public dashboard|public view/i,
    respond: () => `The public transparency tracker at /tracker/ is open to anyone — no login required.\n\nIt reads from paws_public_dogs — a zero-PII table separate from the private records. It shows: PAWS reference, breed, status, and source code.\n\nThe leaderboard ranks breeders by merit (accepted dogs / service rate). No owner names, no microchips, no addresses are ever shown.` },

  // Escrow / money / finance
  { pattern: /escrow|money|fund|rand|financial|sponsor|donation/i,
    respond: () => `Sponsorship funds, in a live deployment, would sit in a ring-fenced escrow account.\n\nReleases require:\n• Commissioner authorisation (biometric + 2FA)\n• Council of Paws audit sign-off\n\nNeither can act alone. The public tracker shows escrow status (SECURED / RELEASED) — not individual amounts. The financial model tracks three pools per dog: SAPS allocation, SPCA contribution, and donor escrow. Source: migration 009_financial_brain.sql.` },

  // Breeder League
  { pattern: /league|breeder|tier|rank|promote|premier partner|gold|silver/i,
    respond: () => `The Breeder League ranks dog suppliers by merit only — no lobbying, no relationships.\n\n• Premier Partner: ≥10 SAPS-accepted dogs, ≥30% service rate\n• Gold: ≥5 dogs, ≥20% service rate\n• Silver: ≥2 dogs\n• Standard: all others\n\nThe Council of Paws calculates tiers automatically from verified data. One critical welfare violation = immediate relegation + 24-month Tier 1 ban.` },

  // Welfare / SPCA
  { pattern: /welfare|spca|animal|cruelty|ethical|compliance/i,
    respond: () => `Animal welfare is a hard system-level constraint, not a guideline.\n\nAgent Beta (AI Welfare Officer) automatically blocks any action that bypasses SPCA compliance. This block cannot be overridden by the Commissioner or any human. A welfare violation is recorded in the immutable audit log and triggers automatic league demotion.\n\nThe system is designed so that animal welfare is protected even against a corrupt official.` },

  // Demo data
  { pattern: /500|demo|simulation|mock|fake dogs|not real dogs/i,
    respond: () => `The 500 dogs on the tracker are synthetic simulation records, clearly flagged is_demo=true in the database. They are there to demonstrate what the system looks like at national scale.\n\nWhen the system is formally adopted, real intake data replaces the demo records. The demo data cannot be confused with real data — the flag is enforced at the database level.` },

  // Privacy
  { pattern: /privacy|popia|gdpr|personal information|microchip exposed/i,
    respond: () => `The system is designed for POPIA compliance.\n\nPII is isolated in role-restricted tables. Microchip numbers are stored as SHA-256 hashes in the audit log — the raw number is never logged. Owner contact data is never exposed to the public tracker, this AI chat, or the oversight dashboard.\n\nThe public sees: reference number, breed, status. Nothing else.` },

  // SAPS endorsement
  { pattern: /saps|south african police|endorsed|government approval|officially/i,
    respond: () => `SAPS has not formally endorsed this system. This prototype was built to demonstrate what a SAPS-compatible K9 governance framework should look like.\n\nThe architecture is designed to complement existing SAPS systems — not replace them. No government body has signed an MOU. Formal endorsement is what we are seeking, not what we are claiming.` },

  // How to adopt / pilot
  { pattern: /pilot|adopt|implement|deploy|how do we start|how would this work/i,
    respond: () => `The proposed pilot is: one province, one K9 kennel unit, 30 days of real intake data.\n\nThe project team handles infrastructure. SAPS validates the workflow. The adopting institution owns their own database — zero vendor lock-in.\n\nFormal adoption requires: (1) letter of intent, (2) a pilot agreement on data ownership, (3) a signed MOU establishing the Council of Paws structure.` },

  // Guided tour
  { pattern: /tour|show me|walk me through|where do i start|what should i look at/i,
    respond: () => `Guided tour — explore in this order:\n\n1. Tracker: open /tracker/ — see the public leaderboard and 500 simulation records. No login needed.\n2. This chat: ask me "Who controls the AI?", "How does escrow work?", "Can it be hacked?" — I answer from the repository.\n3. GitHub: github.com/nicodemussibiya-dot/operation-paws — read the migration files to see every security rule in plain SQL.\n4. MOU template: /docs/MASTER_MOU_v2.md — the governance contract framework.\n5. SECURITY.md — the responsible disclosure policy.\n\nAsk me about any step.` },

  // What questions can I ask
  { pattern: /what can (i|you)|capabilities|help|questions/i,
    respond: () => `Questions I can answer from the repository:\n\n• "What is PAWS?"\n• "Is this real or a simulation?"\n• "Who can see dog data?"\n• "How does escrow work?"\n• "Who controls the AI?"\n• "What is the Council of Paws?"\n• "How does the Breeder League work?"\n• "What is the Dead Man's Switch?"\n• "Is this secure?"\n• "Can I audit the code?"\n• "Has SAPS endorsed this?"\n• "How would we adopt this?"\n\nI answer from facts, not guesses. If I do not have a grounded answer, I will say so.` },

  // Catch-all
  { pattern: /.+/,
    respond: (text) => `I do not have a grounded answer for "${text.length > 50 ? text.slice(0,50) + '…' : text}" in the Operation PAWS repository.\n\nI will not speculate. Try asking: "What is PAWS?", "How does escrow work?", "Who controls the AI?", or "Show me a tour."` },
];

function localResponse(text) {
  for (const rule of LOCAL_BRAIN) {
    if (rule.pattern.test(text)) {
      return rule.respond(text);
    }
  }
  return null;
}

// ── Role detection ────────────────────────────────────────────
function detectRole(text) {
  const t = text.toLowerCase();
  if (/commissioner|general|national head|brigadier/.test(t)) return 'commissioner';
  if (/elder|pastor|church|reverend|bishop/.test(t))           return 'elder';
  if (/partner|sponsor|bank|investor|funder/.test(t))          return 'partner';
  if (/officer|constable|admin|intake|field/.test(t))          return 'officer';
  if (/breeder|kennel|trainer|handler|league/.test(t))         return 'breeder';
  return null;
}

function extractName(text) {
  const m = text.match(/(?:i(?:'m| am)|name(?:'s| is)|call me)\s+([A-Z][a-z]+)/i);
  return m ? m[1] : null;
}

// ── Council call (with timeout + graceful fallback) ───────────
async function callCouncil(text) {
  if (state.councilOnline === false) return null;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);

    const res = await fetch(COUNCIL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ query: text, role: state.role, history: state.history.slice(-4) }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.councilOnline = true;
    return await res.json();
  } catch {
    state.councilOnline = false;
    return null;
  }
}

const CHAT_URL = `${SUPABASE_URL}/functions/v1/paws-chat`;

// ── LLM call (next-level conversational fallback) ───────────
async function callChatLLM(text) {
  try {
    const formattedHistory = state.history.map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.text
    }));
    
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000); // 10s timeout for LLM

    const res = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ role: state.role || 'citizen', messages: [...formattedHistory.slice(-6), {role: 'user', content: text}] }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.reply || null;
  } catch (err) {
    console.error("LLM Error:", err);
    return null;
  }
}

// ── Core message handler ──────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById('user-input');
  const text  = input.value.trim();
  if (!text) return;

  appendUser(text);
  input.value = '';
  
  // Show typing indicator
  const bubble = appendAI('<span class="typing-dots"><span></span><span></span><span></span></span>');

  // Give the UI a moment to render the typing indicator
  await sleep(600);

  // 1. Extract name if given
  const name = extractName(text);
  if (name) state.name = name;

  // 2. Detect or confirm role
  const detectedRole = detectRole(text);
  if (detectedRole && !state.role) {
    state.role = detectedRole;
    const cfg = ROLES[state.role];
    await typeInto(bubble, cfg.greeting(state.name));
    
    const link = document.createElement('a');
    link.href = cfg.link.url;
    link.textContent = `${cfg.link.label} ↗`;
    link.style.color = "var(--accent)";
    link.style.fontWeight = "700";
    link.style.textDecoration = "none";
    
    bubble.appendChild(document.createElement('br'));
    bubble.appendChild(document.createElement('br'));
    bubble.appendChild(document.createTextNode('→ '));
    bubble.appendChild(link);

    state.history.push({ role: 'user', text });
    state.history.push({ role: 'ai', text: cfg.greeting(state.name) });
    return;
  }
  
  state.history.push({ role: 'user', text });

  // 3. Try Council (async, with fallback)
  const councilData = await callCouncil(text);

  let responseHtml = '';

  if (councilData && councilData.chair === 'APPROVED' && councilData.answer) {
    // If Council has no grounded facts, route to the LLM Brain
    if (councilData.answer.includes("I cannot find a grounded answer")) {
      const llmReply = await callChatLLM(text);
      
      if (llmReply) {
        responseText = llmReply;
        state.history.push({ role: 'ai', text: llmReply });
      } else {
        // Ultimate Fallback: local intelligence
        const local = localResponse(text);
        responseText = local;
        state.history.push({ role: 'ai', text: local });
      }
    } else {
      // Grounded hit
      responseText = councilData.answer;
      state.history.push({ role: 'ai', text: councilData.answer });
      await typeInto(bubble, responseText);
      
      if (councilData.citations?.length) {
        const citeSpan = document.createElement('span');
        citeSpan.style.color = "var(--muted)";
        citeSpan.style.fontSize = "11px";
        citeSpan.style.marginTop = "6px";
        citeSpan.style.display = "block";
        citeSpan.textContent = `Sources: ${councilData.citations.join(', ')}`;
        bubble.appendChild(citeSpan);
      }
      return;
    }
  } else if (councilData && councilData.chair === 'BLOCKED') {
    responseText = `That's outside what I can verify. ${councilData.reason || ''}`;
    state.history.push({ role: 'ai', text: responseText });
    await typeInto(bubble, responseText);
    
    const specSpan = document.createElement('span');
    specSpan.style.color = "var(--muted)";
    specSpan.style.fontSize = "11px";
    specSpan.style.display = "block";
    specSpan.textContent = "I won't speculate.";
    bubble.appendChild(specSpan);
    return;
  } else {
    // Ultimate Fallback: local intelligence
    const local = localResponse(text);
    responseText = local;
    state.history.push({ role: 'ai', text: local });
  }

  await typeInto(bubble, responseText);
}

// ── UI Helpers ────────────────────────────────────────────────
function appendUser(text) {
  const box = document.getElementById('chat-box');
  const el  = document.createElement('div');
  el.className = 'message user';
  el.textContent = text;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

function appendAI(content) {
  const box = document.getElementById('chat-box');
  const el  = document.createElement('div');
  el.className  = 'message ai';
  if (typeof content === 'string') {
    el.textContent = content;
  } else {
    el.appendChild(content);
  }
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
  return el;
}

// Smooth character-by-character typing effect
async function typeInto(el, text) {
  el.textContent = '';
  const s = String(text ?? '');
  for (const ch of s) {
    el.textContent += ch;
    const box = document.getElementById('chat-box');
    if (box) box.scrollTop = box.scrollHeight;
    await sleep(14);
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Boot sequence ─────────────────────────────────────────────
window.onload = async () => {
  // Allow Enter key
  document.getElementById('user-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  const el = appendAI('');
  await sleep(300);
  await typeInto(el, `PAWS-OS online. I am a prototype tactical intelligence for the Operation PAWS reference architecture. I work from a grounded fact repository to demonstrate national K9 oversight.\n\nTell me who you are or just ask me anything.`);
};
