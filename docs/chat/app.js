// docs/chat/app.js  — PAWS-OS Terminal
// Calls the paws-council Edge Function for grounded, anti-hallucination responses.
const { SUPABASE_URL, SUPABASE_ANON_KEY, PROJECT_REF } = window.PAWS_CONFIG;
const COUNCIL_URL = `${SUPABASE_URL}/functions/v1/paws-council`;

let userRole = null;

const ROLE_CONFIG = {
  commissioner: {
    label: "LEVEL 10 — NATIONAL COMMISSIONER",
    link:  "../commissioner/",
    cta:   "OPEN COMMAND CENTER",
    greeting: "Commissioner. Your tactical queue is synced. 500 candidates in the registry. Ledger integrity: VERIFIED.",
  },
  elder: {
    label: "COMMUNITY LEADER",
    link:  "../community-briefing/",
    cta:   "VIEW BRIEFING",
    greeting: "It is an honour, Elder. I have prepared a plain-language briefing that explains our welfare commitments and community integrity. We are guided by Proverbs 12:10.",
  },
  partner: {
    label: "STRATEGIC SPONSOR",
    link:  "../donate/",
    cta:   "VIEW SPONSORSHIP HUB",
    greeting: "Your investment is ring-fenced in escrow and tracked on the public ledger. Every release requires COP consensus sign-off.",
  },
  officer: {
    label: "FIELD OPERATIVE",
    link:  "../admin/",
    cta:   "OPEN INTAKE TERMINAL",
    greeting: "Terminal Node-042 is live. Ready for candidate registration. Microchip must be 15-digit ISO. Welfare check is mandatory before submission.",
  },
  breeder: {
    label: "LEAGUE PARTICIPANT",
    link:  "../tracker/",
    cta:   "VIEW LEAGUE TRACKER",
    greeting: "The National Breeder Rivalry is live. Premier Partner status requires ≥10 SAPS-accepted dogs and ≥30% service rate. The system tracks this automatically — no lobbying.",
  },
};

// ── Boot ──────────────────────────────────────────────────────
window.onload = () => {
  appendAI(`
    [BOOT: COMPLETE] [IDENTITY PROTOCOL: ACTIVE]<br><br>
    I am <strong>PAWS-OS</strong> — the Central Tactical Intelligence for Operation PAWS.<br>
    I only answer from grounded, provable facts in the national repository. I cannot be persuaded to invent audits, endorsements, or data.<br><br>
    <strong>Who are you?</strong> Tell me your role: <em>Commissioner, Elder, Partner, Officer, or Breeder</em>.
  `);
};

// ── Send message ──────────────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById('user-input');
  const text  = input.value.trim();
  if (!text) return;

  appendUser(text);
  input.value = '';

  const thinkingEl = appendAI("[COUNCIL OF PAWS: CONVENING...]");

  // 1. Identity detection (client-side, no AI needed)
  if (!userRole) {
    const detected = detectRole(text.toLowerCase());
    if (detected) {
      userRole = detected;
      const cfg = ROLE_CONFIG[detected];
      thinkingEl.innerHTML = `
        [ACCESS: ${cfg.label}]<br>
        ${cfg.greeting}<br><br>
        <strong>→ <a href="${cfg.link}" style="color:var(--accent);">${cfg.cta}</a></strong>
      `;
      return;
    } else {
      thinkingEl.innerHTML = `[IDENTIFICATION FAILED]<br>Please state your role: Commissioner, Elder, Partner, Officer, or Breeder.`;
      return;
    }
  }

  // 2. Council query for all follow-up questions
  try {
    const res = await fetch(COUNCIL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ query: text, role: userRole }),
    });
    const data = await res.json();

    if (data.chair === "BLOCKED") {
      thinkingEl.innerHTML = `
        [COUNCIL OF PAWS: ACTION BLOCKED]<br>
        ${data.reason}<br><br>
        <em>I will not generate unverifiable claims. Confidence: 0%</em><br>
        → <a href="${data.safe_next_step_url}" style="color:var(--accent);">Go to safe page</a>
      `;
    } else {
      const cites = data.citations?.length
        ? `<br><small style="color:var(--muted);">Sources: ${data.citations.join(', ')}</small>`
        : '';
      thinkingEl.innerHTML = `
        [COP: ALL AGENTS VERIFIED — CHAIR APPROVED]<br>
        ${data.answer}${cites}<br>
        <small style="color:var(--muted);">Confidence: ${Math.round(data.confidence * 100)}%</small>
      `;
    }
  } catch (e) {
    thinkingEl.innerHTML = `[NETWORK ERROR] Cannot reach Council endpoint. Check Edge Function deployment.<br><small>${e.message}</small>`;
  }
}

// ── Helpers ───────────────────────────────────────────────────
function detectRole(t) {
  if (t.includes('commissioner'))          return 'commissioner';
  if (t.includes('elder') || t.includes('church') || t.includes('pastor')) return 'elder';
  if (t.includes('partner') || t.includes('sponsor') || t.includes('bank')) return 'partner';
  if (t.includes('officer') || t.includes('admin') || t.includes('intake')) return 'officer';
  if (t.includes('breeder') || t.includes('kennel') || t.includes('league')) return 'breeder';
  return null;
}

function appendUser(text) {
  const box = document.getElementById('chat-box');
  const el  = document.createElement('div');
  el.className = 'message user';
  el.innerText  = `> ${text}`;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

function appendAI(html) {
  const box = document.getElementById('chat-box');
  const el  = document.createElement('div');
  el.className   = 'message ai';
  el.innerHTML   = html;
  box.appendChild(el);
  box.scrollTop  = box.scrollHeight;
  return el;
}
