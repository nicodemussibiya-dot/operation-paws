const LOG = document.getElementById('log');
const FORM = document.getElementById('form');
const MSG = document.getElementById('msg');

const STATE = { thread: [] };

// --- CONFIGURATION ---
const PROJECT_REF = "dorihyvbgbhsxvdrtqqr"; 
const ENDPOINT = `https://${PROJECT_REF}.supabase.co/functions/v1/paws-chat`;

const LOCAL_ANSWERS = {
  default: "I'm currently in 'Direct Mode' while our AI backend synchronizes. I can help with: Intake, Welfare, Sponsorship, and SAPS info. What would you like to know?",
  intake: "To donate a dog, visit the Hub and click 'WhatsApp Intake'. Screening ensures the dog is suitable for SAPS work and welfare is protected.",
  welfare: "Every PAWS dog is inspected by an independent SPCA official. We prioritize the animal's quality of life above all else.",
  sponsor: "Sponsorship funds screening days and veterinary costs. Visit the 'Sponsor Hub' for banking details or contact us via WhatsApp.",
  saps: "Operation PAWS helps SAPS find high-quality dogs through a transparent, auditable pipeline that reduces procurement corruption.",
  who: "We are a public-interest project bridging the gap between dog donors, welfare inspectors, and the SAPS K9 Unit."
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
  if (t.includes("welfare") || t.includes("spca") || t.includes("animal")) return LOCAL_ANSWERS.welfare;
  if (t.includes("sponsor") || t.includes("fund") || t.includes("money")) return LOCAL_ANSWERS.sponsor;
  if (t.includes("saps") || t.includes("police") || t.includes("k9")) return LOCAL_ANSWERS.saps;
  if (t.includes("who") || t.includes("what") || t.includes("about")) return LOCAL_ANSWERS.who;
  return LOCAL_ANSWERS.default;
}

addBubble("Hi! I'm the PAWS assistant. I'm currently in sync-mode but I can still help with basics. How can I help today?", "ai");

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

    if (!res.ok) throw new Error("Syncing...");
    const data = await res.json();
    document.getElementById(thinkingId)?.remove();
    addBubble(data.reply || "(no reply)", "ai");

  } catch (err) {
    document.getElementById(thinkingId)?.remove();
    addBubble(getLocalReply(text), "ai");
  }
});
