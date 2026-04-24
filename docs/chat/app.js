const LOG = document.getElementById('log');
const FORM = document.getElementById('form');
const MSG = document.getElementById('msg');

const STATE = { thread: [] };

// --- CONFIGURATION ---
const PROJECT_REF = "dorihyvbgbhsxvdrtqqr"; 
const ENDPOINT = `https://${PROJECT_REF}.supabase.co/functions/v1/paws-chat`;

// --- EMERGENCY LOCAL FALLBACKS (Works even if Supabase is down) ---
const LOCAL_ANSWERS = {
  default: "I'm currently running in 'Emergency Offline Mode' due to a provider outage. I can still help with basic questions! For official intake, please use the WhatsApp link on the Start Hub.",
  intake: "To donate a dog, please visit our Start Hub and click 'WhatsApp Intake'. This is our most secure and traceable channel.",
  welfare: "Operation PAWS is welfare-first. Every dog is screened by an independent SPCA inspector to ensure high standards of care.",
  traceability: "We use verified microchips and PAWS Reference numbers to ensure 100% transparency and zero smuggling."
};

function addBubble(text, cls) {
  const div = document.createElement('div');
  div.className = `bubble ${cls}`;
  div.innerText = text; 
  LOG.appendChild(div);
  LOG.scrollTo({ top: LOG.scrollHeight, behavior: 'smooth' });
}

function getLocalReply(text) {
  const t = text.toLowerCase();
  if (t.includes("donate") || t.includes("intake")) return LOCAL_ANSWERS.intake;
  if (t.includes("welfare") || t.includes("spca")) return LOCAL_ANSWERS.welfare;
  if (t.includes("trace") || t.includes("smuggle") || t.includes("chip")) return LOCAL_ANSWERS.traceability;
  return LOCAL_ANSWERS.default;
}

// Initial Greeting
addBubble("Hi! I'm the PAWS assistant. How can I help today?", "ai");

FORM.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = MSG.value.trim();
  if (!text) return;

  MSG.value = "";
  addBubble(text, "me");
  STATE.thread.push({ role: "user", content: text });

  const thinkingId = 'thinking-' + Date.now();
  const thinkingDiv = document.createElement('div');
  thinkingDiv.className = 'bubble ai thinking';
  thinkingDiv.id = thinkingId;
  thinkingDiv.innerText = "...";
  LOG.appendChild(thinkingDiv);

  try {
    // 1. Try Supabase (Primary)
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: STATE.thread }),
      signal: AbortSignal.timeout(5000) // Don't wait forever if DNS is dead
    });

    if (!res.ok) throw new Error("Supabase Outage");
    const data = await res.json();
    document.getElementById(thinkingId)?.remove();
    addBubble(data.reply || "(no reply)", "ai");

  } catch (err) {
    // 2. EMERGENCY FAILOVER (Local Logic)
    console.warn("Supabase unreachable, using Local Intelligence Fallback.");
    document.getElementById(thinkingId)?.remove();
    const reply = getLocalReply(text);
    addBubble(reply, "ai");
  }
});
