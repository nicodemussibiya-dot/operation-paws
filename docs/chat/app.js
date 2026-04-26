// docs/chat/app.js — PAWS-OS v2: "Be Water"
// Fluid, context-aware, graceful fallback. Never rigid.
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.PAWS_CONFIG;
const COUNCIL_URL = `${SUPABASE_URL}/functions/v1/paws-council`;

const escapeHTML = str => String(str).replace(/[&<>'"]/g, tag => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[tag]));

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
    greeting: (n) => `Welcome back${n ? ', ' + n : ''}. The intake queue is synchronized. 500 candidates in the demo dataset. Ledger integrity is clean. What do you need?`,
    link: { url: "../commissioner/", label: "Open Command Center" },
  },
  elder: {
    label: "Community Leader",
    greeting: (n) => `It is an honour${n ? ', ' + n : ''}. I have your community briefing ready. We operate by Proverbs 12:10 — every animal is cared for, every rand is accounted for. How can I serve you?`,
    link: { url: "../community-briefing/", label: "Read Community Briefing" },
  },
  partner: {
    label: "Strategic Partner",
    greeting: (n) => `Good to have you${n ? ', ' + n : ''}. Your contribution is ring-fenced in escrow and visible on the public ledger. Every release requires Council sign-off. What would you like to know?`,
    link: { url: "../donate/", label: "View Sponsorship Hub" },
  },
  officer: {
    label: "Field Officer",
    greeting: (n) => `Demo Hub is live${n ? ', ' + n : ''}. Ready for intake. All submissions require a 15-digit microchip and a welfare clearance. What do you need?`,
    link: { url: "../admin/", label: "Open Intake Terminal" },
  },
  breeder: {
    label: "League Participant",
    greeting: (n) => `The rivalry is live${n ? ', ' + n : ''}. Premier Partner status requires ≥10 SAPS-accepted dogs at ≥30% service rate. The system tracks this — no lobbying. What's your question?`,
    link: { url: "../tracker/", label: "View League Tracker" },
  },
};

// ── Local intelligence (fluid fallback) ──────────────────────
const LOCAL_BRAIN = [
  { pattern: /\b(hi|hello|hey|howzit|sawubona|dumela)\b/i,
    respond: () => `I'm here. Talk to me — ask about the registry, the league, security, or just tell me who you are.` },

  { pattern: /who are you|what are you|paws.?os/i,
    respond: () => `I'm PAWS-OS — the tactical intelligence running Operation PAWS. I manage the national K9 registry, oversee the Breeder League, and ensure every decision is logged and auditable. I answer from facts, not guesses.` },

  { pattern: /how are you|you good|you ok/i,
    respond: () => `Functioning at capacity. The ledger is clean, the Council is armed, and the registry has 500 candidates on deck. We are ready to move. What do you need?` },

  { pattern: /dead man|dms|commissioner offline|unreachable/i,
    respond: () => `The Dead Man's Switch is armed. If the Commissioner is unreachable for 7 days, the AI Surrogate takes temporary control, locks destructive actions, and routes authority to the designated deputy. No single point of failure.` },

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
    respond: () => `The Council of Paws has three agents: Alpha (data auditor), Beta (welfare officer), Gamma (strategist). Every major decision goes through all three. The Chair only acts if all three return VERIFIED. If any agent flags a concern, the action is blocked and the reason is logged.` },

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
    const response = cfg.greeting(state.name) + 
      `<br><br>→ <a href="${cfg.link.url}" style="color:var(--accent); font-weight:700; text-decoration:none;">${cfg.link.label} ↗</a>`;
    await typeInto(bubble, response, true);
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
        responseHtml = escapeHTML(llmReply);
        state.history.push({ role: 'ai', text: llmReply });
      } else {
        // Ultimate Fallback: local intelligence
        const local = localResponse(text);
        responseHtml = escapeHTML(local);
        state.history.push({ role: 'ai', text: local });
      }
    } else {
      // Grounded hit
      const cites = councilData.citations?.length
        ? `<br><span style="color:var(--muted); font-size:11px; margin-top:6px; display:block;">Sources: ${escapeHTML(councilData.citations.join(', '))}</span>`
        : '';
      responseHtml = escapeHTML(councilData.answer) + cites;
      state.history.push({ role: 'ai', text: councilData.answer });
    }
  } else if (councilData && councilData.chair === 'BLOCKED') {
    responseHtml = `That's outside what I can verify. ${escapeHTML(councilData.reason || '')}<br><span style="color:var(--muted); font-size:11px;">I won't speculate.</span>`;
    state.history.push({ role: 'ai', text: responseHtml });
  } else {
    // Ultimate Fallback: local intelligence
    const local = localResponse(text);
    responseHtml = escapeHTML(local);
    state.history.push({ role: 'ai', text: local });
  }

  await typeInto(bubble, responseHtml, true);
}

// ── UI Helpers ────────────────────────────────────────────────
function appendUser(text) {
  const box = document.getElementById('chat-box');
  const el  = document.createElement('div');
  el.className = 'message user';
  el.innerText  = text;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

function appendAI(html) {
  const box = document.getElementById('chat-box');
  const el  = document.createElement('div');
  el.className  = 'message ai';
  el.innerHTML  = html;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
  return el;
}

// Smooth character-by-character typing effect
async function typeInto(el, html, isHtml = false) {
  el.innerHTML = '';
  if (isHtml) {
    // For HTML content, reveal word by word rather than char by char
    const words = html.split(/(?<=\s)/);
    let built = '';
    for (const word of words) {
      built += word;
      el.innerHTML = built;
      const box = document.getElementById('chat-box');
      box.scrollTop = box.scrollHeight;
      await sleep(18);
    }
  } else {
    for (const ch of html) {
      el.textContent += ch;
      await sleep(14);
    }
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
  await typeInto(el, `PAWS-OS online. I'm your tactical intelligence for Operation PAWS — I work from facts, not guesses.\n\nTell me who you are or just ask me anything.`, false);
};
