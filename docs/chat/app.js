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

// ── Local intelligence — conversational, grounded, conscious ──
const LOCAL_BRAIN = [

  { pattern: /\b(hi|hello|hey|howzit|sawubona|dumela|good morning|good afternoon)\b/i,
    respond: () => `Hello. I'm PAWS-OS. I know this system from the inside — the code, the governance rules, the decisions behind how it's built. Ask me anything and I'll give you a straight answer. What would you like to understand?` },

  { pattern: /who are you|what are you|paws.?os|about this system/i,
    respond: () => `I'm PAWS-OS — the intelligence layer built into the Operation PAWS prototype. I exist to explain this system honestly, including what it hasn't done yet and what it's still proposing. I don't guess. If I know it, I'll tell you. If I don't, I'll say so. What do you want to know?` },

  { pattern: /what is (paws|this|operation paws)|what does paws do|explain paws/i,
    respond: () => `Operation PAWS stands for Police Animal Welfare and Stability. At its core it's a proposal for how South Africa's national K9 programme should actually be governed — and a working demonstration that it can be done. The problem it's solving is traceability. Right now a trained K9 can move from breeder to trainer to SAPS and somewhere in that chain the record breaks. Welfare checks get skipped. Money disappears. Certifications get faked. This system closes that chain. Every dog gets a unique reference number. Every step gets logged. Every decision requires verified human authority and AI council sign-off. And everything that can be made public, is — so the public can hold the programme accountable without needing to trust anyone's word for it. This is a prototype right now, not a live system. But the architecture is real, and the question it's asking is whether accountable governance can actually be built from the ground up.` },

  { pattern: /is this (real|live|operational|working|active)|is this already|already running/i,
    respond: () => `The system is real. The data isn't — not yet. What you're seeing is a working prototype built to show exactly what the live system would look like. The five hundred dogs on the tracker are synthetic, flagged as simulation data at the database level so they can never be confused with real records. No real animals, no real owners, no real money. The architecture, the security controls, the governance rules, the audit trail — those are all real and functional. The next step is formal adoption by a government body or SAPS unit, which would replace the demo data with actual intake from a real K9 kennel. Right now this is an open invitation to scrutinise the design before committing to it.` },

  { pattern: /secur|hack|safe|breach|vulnerab|protected/i,
    respond: () => `The honest answer is that the security here doesn't rely on keeping the code secret. The whole codebase is public — anyone can read it, including people looking for weaknesses. What the system relies on instead is layers of controls that hold even when the code is fully known. Anonymous users can't reach private data at all, not through any query or API call. Staff actions require authentication tokens. Any approval or rejection requires a time-limited 2FA token that gets consumed in a single atomic database transaction — so even if someone intercepted it, it's already spent. And the audit log is physically append-only. Nothing gets quietly removed, including failed attempts. The philosophy is: if someone does break in, there's still a complete trail of exactly what they did.` },

  { pattern: /who can see|who has access|data access|pii|private data|owner details/i,
    respond: () => `The system draws a hard line between two kinds of information. Private records — microchip numbers, owner contacts, full case histories — live in a table that anonymous users and the public simply cannot touch. That's enforced at the database level by role policies, not by an application rule someone could accidentally bypass. What the public sees is a completely separate table: breed, status, a reference number, nothing more. The design intent is that someone could publish the public tracker in a newspaper and there would be nothing in it that exposes anyone's private information. Auditors and commissioners see the full picture. The Presidency oversight role sees aggregate statistics only — no individual records, by design.` },

  { pattern: /audit|log|trail|evidence|accountability|cannot be deleted/i,
    respond: () => `Every action the system takes gets written to an audit log that has no delete policy — and that's not a promise, it's a database constraint. Intake submissions, approvals, rejections, even failed 2FA attempts all land there permanently. The critical thing is that nothing can be erased from it, not even by someone with full database administrator access. The logic behind this is simple: if people know a complete, unalterable record exists of everything they do, they make different decisions about what they're willing to attempt.` },

  { pattern: /govern|council of paws|cop|how decisions|who decides/i,
    respond: () => `Governance here is structured so that no single person or system holds all the authority. The Commissioner is the human decision-maker — they carry real responsibility, but they have to pass biometric verification and a 2FA challenge every time they want to act. Sitting alongside them is the Council of Paws — three AI agents that evaluate every action before it can proceed. The first is the auditor, checking data integrity. The second is the welfare officer, and this one matters most: its veto cannot be overridden by any human, including the Commissioner. The third is the strategist, checking whether an action fits the programme's mandate. All three have to return VERIFIED. If even one flags a concern, the action is blocked and the reason is logged. And then beyond that there's the Presidency Oversight role — it can see aggregate statistics but cannot modify anything at all. The separation of visibility and authority is intentional.` },

  { pattern: /who controls the ai|ai authority|can ai override|ai override|ai autonomous/i,
    respond: () => `The AI doesn't control anything — it advises. The Council of Paws looks at a request and returns a verdict, verified or blocked. But the only thing that can actually execute an action is a Commissioner who has passed biometric verification and holds a valid 2FA token. The AI has no write access to the database on its own. What this creates in practice is a system where the AI can block a corrupt human — the welfare agent can refuse to verify an action even if the Commissioner pushes for it — but the AI cannot act without a human either. Neither holds the power alone, and neither can be bypassed without breaking the other. That balance was a deliberate design choice.` },

  { pattern: /dead man|dms|commissioner disappear|unreachable|offline|deputy/i,
    respond: () => `The Dead Man's Switch exists because a governance system that depends on one person is fragile by design. If the Commissioner is unreachable for seven consecutive days — through illness, removal, corruption, anything — the system triggers automatically. Destructive actions get locked. Authority routes to the designated deputy. The AI Surrogate holds the read-only state of the programme. What this means is that no single person going offline can be used to freeze or paralyse the system. It's the kind of safeguard that's invisible until it matters, and then it matters completely.` },

  { pattern: /mou|memorandum|agreement|signed|contract|who signed/i,
    respond: () => `The MOU is a draft. It hasn't been signed by anyone, and saying otherwise would be the kind of claim that destroys trust before a conversation even gets started. What it is, is a template — a proposed framework for how SAPS, sponsors, and the Council of Paws governance structure would relate to each other contractually. It's published openly in the repository so any institution considering this can read the proposed terms before committing to anything. It's an invitation to negotiate, not a claim of endorsement.` },

  { pattern: /transparent|open source|public repo|github|can i audit|can i see the code/i,
    respond: () => `Yes — everything is at github.com/nicodemussibiya-dot/operation-paws. Every database policy, governance rule, security control, and AI prompt, including this one. The reasoning is that if the design is sound, it shouldn't matter that it's public. And if it's not sound, it's better for people to find the flaws before they cause harm. The open recipe, locked kitchen model: the recipe is readable by anyone. What's protected is the actual data — the dogs, the owners, the credentials. You can audit the code right now from any browser, without asking permission.` },

  { pattern: /tracker|transparency ledger|public dashboard|public view/i,
    respond: () => `The public tracker is a live feed of the registry that anyone can open without logging in. It draws from a completely separate table that contains no personal information — just the PAWS reference number, breed, status, and which source submitted the dog. The leaderboard ranks breeders by the only things that should matter: how many dogs were accepted by SAPS and what percentage of them are actually in active service. No one lobbied their way onto that ranking. The system calculated it from verified data.` },

  { pattern: /escrow|money|fund|rand|financial|sponsor|donation/i,
    respond: () => `In a live deployment, sponsorship money would sit in a ring-fenced escrow account — held separately so it can't be quietly moved without a trail. Releasing it requires two independent authorisations: the Commissioner has to approve with biometric verification and a 2FA token, and the Council of Paws has to sign off on the audit. Neither can act alone. The public tracker shows escrow status — secured or released — but not the amounts. The financial model also tracks three separate funding pools per dog: the SAPS allocation, the SPCA contribution, and the donor escrow. Every rand has a trail from source to expenditure, and that trail is auditable by anyone with the right access role.` },

  { pattern: /league|breeder|tier|rank|promote|premier partner|gold|silver/i,
    respond: () => `The Breeder League is a merit ranking, and merit here means something very specific: how many dogs did SAPS actually accept from you, and what percentage of them are in active service? Premier Partner requires at least ten accepted dogs and a thirty percent service rate. Gold is five dogs and twenty percent. Silver is two. Everyone else is Standard until the numbers move. The calculation runs automatically from verified intake and deployment data — there's no application process, no relationship that gets you bumped up. One critical welfare violation causes immediate relegation and a twenty-four month ban from the top tier, treated as an automatic consequence rather than a committee decision.` },

  { pattern: /welfare|spca|animal|cruelty|ethical|compliance/i,
    respond: () => `Welfare is the one thing in this system that no human authority can override. The AI Welfare Officer — Agent Beta on the Council of Paws — is hard-coded to block any action that bypasses SPCA compliance standards. Not as a guideline. Not as a recommendation. As a veto that the Commissioner cannot override, even with a valid 2FA token. A welfare violation gets logged in the immutable audit trail and triggers automatic demotion in the Breeder League. The reasoning is straightforward: if you build a system where welfare can be overridden under pressure, it will be overridden under pressure. The only way to make it hold is to make it structurally impossible to bypass.` },

  { pattern: /500|demo|simulation|mock|fake dogs|not real dogs/i,
    respond: () => `The five hundred dogs on the tracker are synthetic — marked is_demo=true in the database, which means no query or report can accidentally treat them as real records. They exist to show you what the system looks like at national scale, not to misrepresent what's actually operational. When the system is formally adopted and real intake begins, those records get replaced. The distinction is enforced at the database level, not just as a label on a page.` },

  { pattern: /privacy|popia|personal information|microchip exposed/i,
    respond: () => `The system was built with POPIA in mind. Personal information — owner names, contact details, raw microchip numbers — sits in role-restricted tables that the public tracker never touches. Even in the audit log, microchip numbers are stored as SHA-256 hashes rather than the raw identifiers. So the audit trail is complete and verifiable without ever exposing the underlying data. The public sees a reference number, a breed, and a status. That's intentional.` },

  { pattern: /saps|south african police|endorsed|government approval|officially/i,
    respond: () => `SAPS hasn't endorsed this. That's important to say clearly because claiming endorsement that doesn't exist is the kind of thing that ends conversations before they start. What this is, is a system built to be compatible with how SAPS operates — designed to complement their existing processes, not replace them. The question this prototype is asking is whether SAPS, or any government body, sees enough value in the model to run a pilot. That's the conversation it's trying to open.` },

  { pattern: /pilot|adopt|implement|deploy|how do we start|how would this work/i,
    respond: () => `The proposed pilot is kept simple by design: one province, one kennel unit, thirty days of real intake data. The project team handles the infrastructure. The adopting institution validates whether the workflow fits how their people actually work. And the institution owns their own database — if they walk away, they take their data with them. There's no vendor lock-in because this is open-source. Formally, what's needed to start is a letter of intent, a data ownership agreement, and eventually a signed MOU establishing the Council of Paws governance structure for that specific deployment.` },

  { pattern: /tour|show me|walk me through|where do i start|what should i look at/i,
    respond: () => `Start with the tracker — open /tracker/ in your browser. No login, no account needed. Just look at what the public sees when they want to hold this programme accountable. Then come back here and ask me something hard — what happens if the Commissioner tries to approve a welfare violation, or whether the code can actually be audited, or how the escrow model prevents someone from quietly releasing funds. If you want to go deeper, the GitHub repository has every database rule written in plain SQL. And the MOU template at /docs/MASTER_MOU_v2.md shows what a formal governance agreement would look like. Where would you like to start?` },

  { pattern: /what can (i|you)|capabilities|help|what.*ask/i,
    respond: () => `Ask me anything about this system. What it is, how it works, who built which safeguard into where and why, what would happen if someone tried to abuse it, what the honest limitations are, what hasn't been built yet. I know this system from the inside and I won't dress it up. If there's something I can't answer from the repository, I'll say that too, rather than filling the gap with something that sounds plausible.` },

  { pattern: /.+/,
    respond: (text) => `I don't have that grounded in the repository — and I won't invent an answer for "${text.length > 40 ? text.slice(0,40)+'…' : text}". Try asking me about how the governance works, what the security model is built on, how escrow functions, or just say "show me where to start" and I'll walk you through it.` },
]

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
      
      if (councilData.deliberation) {
        const delib = document.createElement('div');
        delib.style.fontStyle = "italic";
        delib.style.fontSize = "12px";
        delib.style.color = "var(--muted)";
        delib.style.marginBottom = "8px";
        delib.textContent = `Council Deliberation: ${councilData.deliberation}`;
        bubble.appendChild(delib);
      }

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
