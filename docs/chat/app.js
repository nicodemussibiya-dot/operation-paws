const LOG = document.getElementById('log');
const FORM = document.getElementById('form');
const MSG = document.getElementById('msg');

const STATE = { thread: [] };

// --- CONFIGURATION ---
const PROJECT_REF = "dorihyvbgbhsxvdrtqqr"; 
const ENDPOINT = `https://${PROJECT_REF}.supabase.co/functions/v1/paws-chat`;

const LOCAL_ANSWERS = {
  default: "I'm currently operating in 'Direct Mode' while our AI backend synchronizes. I can still help with project basics! For official intake, please use the WhatsApp link on the Hub.",
  intake: "To donate a dog, please visit our Start Hub and click 'WhatsApp Intake'. This ensures a 100% traceable and welfare-first process.",
  welfare: "Operation PAWS is welfare-first. Every candidate dog is screened by an independent SPCA inspector to ensure suitability and health.",
  traceability: "We use verified microchips and unique PAWS Reference numbers to eliminate smuggling and ensure transparent chain-of-custody."
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
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: STATE.thread }),
      signal: AbortSignal.timeout(6000) 
    });

    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    const data = await res.json();
    document.getElementById(thinkingId)?.remove();
    addBubble(data.reply || "(no reply)", "ai");

  } catch (err) {
    console.error("Supabase Connection Error:", err);
    document.getElementById(thinkingId)?.remove();
    addBubble(getLocalReply(text), "ai");
  }
});
