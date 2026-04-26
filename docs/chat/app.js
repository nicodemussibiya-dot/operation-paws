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

// ── Local intelligence (fluid fallback) ──────────────────────
const LOCAL_BRAIN = [
  { pattern: /\b(hi|hello|hey|howzit|sawubona|dumela)\b/i,
    respond: () => `I'm here. Talk to me — ask about the registry, the league, security, or just tell me who you are.` },

  { pattern: /who are you|what are you|paws.?os/i,
    respond: () => `I'm PAWS-OS — a prototype tactical intelligence for the Operation PAWS reference architecture. I manage a simulated national K9 registry and demonstrate how merit-based tiering and auditable decision-making work.` },

  { pattern: /how are you|you good|you ok/i,
    respond: () => `Functioning at capacity. The simulation environment is stable, and the registry contains 500 prototype records for scale testing. How can I serve you?` },

  { pattern: /dead man|dms|commissioner offline|unreachable/i,
    respond: () => `The Dead Man's Switch is a proposed failsafe. If a Commissioner is unreachable for 7 days, authority is routed to a designated deputy via an AI surrogate. This prototype demonstrates how the system prevents a single point of failure.` },

  { pattern: /secure|hack|safe|github|public repo|corrupt/i,
    respond: () => `The repo is public by design — transparency is the strategy. What's protected is the data and the keys. paws_dogs has zero anonymous access. Every action goes through cryptographic verification and lands in an append-only audit log. You cannot quietly corrupt this system.` },

  { pattern: /league|tier|promote|breeder|rank/i,
    respond: () => `The Breeder League is merit-only. Premier Partner: ≥10 SAPS-accepted dogs, ≥30% service rate. Gold: ≥5 and ≥20%. Silver: ≥2. Standard: everyone else. The Council of Paws runs the math automatically — no one can lobby their way up.` },

  { pattern: /500|scale|demo|simulation/i,
    respond: () => `The national tracker currently shows 500 simulation records marked is_demo=true — a proof-of-scale demonstration. Real operational data will replace these as intake occurs. It's clearly labelled on the tracker page.` },

  { pattern: /escrow|money|fund|rand|financial/i,
    respond: () => `Escrow funds are held in a ring-fenced account. Releases require Commissioner authorization AND Council of Paws consensus. The public tracker shows status — not individual amounts. No one person controls the money.` },

  { pattern: /biometric|face|fingerprint|identity/i,
    respond: () => `The Commissioner approval console requires biometric verification — a SHA-256 facial scan hash is stored server-side. The frontend captures the signal; the Edge Function validates it. No hash, no approval.` },

  { pattern: /council|cop|agent|alpha|beta|gamma/i,
    respond: () => `The Council of Paws simulation features three governance agents: Alpha (data auditor), Beta (welfare officer), and Gamma (strategist). This demonstration shows how multi-agent consensus prevents unauthorized overrides by requiring a 'VERIFIED' status from all three agents.` },

  { pattern: /welfare|spca|dog|animal|breed/i,
    respond: () => `Welfare is non-negotiable in this system. The AI Welfare Officer (Agent Beta) vetoes any action that bypasses SPCA compliance. A single critical welfare violation causes immediate relegation from the Breeder League and a 24-month ban on T1 supply.` },

  { pattern: /elder|church|community|pastor/i,
    respond: () => `The Community Briefing was written specifically for church elders and community leaders — no jargon, just plain truth. It covers what we do, why it matters, and the questions officials might ask. Would you like me to take you there?` },

  { pattern: /help|what can you do|capabilities/i,
    respond: () => `I can brief you on the national registry, the Breeder League standings, security architecture, escrow status, or the Council of Paws governance. I can also route you to the right dashboard. What do you need?` },

  { pattern: /.+/,  // catch-all
    respond: (text) => `I hear you. I don't have a specific fact for "${text.length > 40 ? text.slice(0,40)+'…' : text}" in the grounded repository yet — but I won't make something up. Ask me about security, the league, the registry, escrow, or governance and I'll give you a straight answer.` },
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
