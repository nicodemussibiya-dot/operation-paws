const LOG = document.getElementById('log');
const FORM = document.getElementById('form');
const MSG = document.getElementById('msg');

const STATE = {
  thread: [] 
};

// --- CONFIGURATION ---
const PROJECT_REF = "dorihyvbgbhsxvdrtqqr"; 
const ENDPOINT = `https://${PROJECT_REF}.supabase.co/functions/v1/paws-chat`;

function addBubble(text, cls) {
  const div = document.createElement('div');
  div.className = `bubble ${cls}`;
  
  // Basic markdown-like line break handling
  div.innerText = text; 
  
  LOG.appendChild(div);
  
  // Smooth scroll to bottom
  LOG.scrollTo({
    top: LOG.scrollHeight,
    behavior: 'smooth'
  });
}

// Initial Greeting
addBubble("Hi! I'm the PAWS assistant. I can help with FAQs about the project, welfare screening, or routing you to the right team for donating a dog, sponsoring, or volunteering. How can I help today?", "ai");

FORM.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = MSG.value.trim();
  if (!text) return;

  MSG.value = "";
  addBubble(text, "me");
  STATE.thread.push({ role: "user", content: text });

  // Show "thinking" state
  const thinkingId = 'thinking-' + Date.now();
  const thinkingDiv = document.createElement('div');
  thinkingDiv.className = 'bubble ai thinking';
  thinkingDiv.id = thinkingId;
  thinkingDiv.innerText = "...";
  LOG.appendChild(thinkingDiv);
  LOG.scrollTop = LOG.scrollHeight;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: STATE.thread })
    });

    const data = await res.json();
    
    // Remove thinking indicator
    document.getElementById(thinkingId)?.remove();

    if (!res.ok) throw new Error(data?.error || "Request failed");

    const reply = data.reply || "(no reply)";
    addBubble(reply, "ai");
    STATE.thread.push({ role: "assistant", content: reply });
  } catch (err) {
    document.getElementById(thinkingId)?.remove();
    addBubble("Error: " + String(err.message || err), "ai");
    console.error("Chat error:", err);
  }
});
