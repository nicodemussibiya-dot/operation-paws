// docs/chat/app.js
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.PAWS_CONFIG;

async function sendMessage() {
  const input = document.getElementById('user-input');
  const box = document.getElementById('chat-box');
  const text = input.value.trim();
  if(!text) return;

  // 1. Add user message to terminal
  const userMsg = document.createElement('div');
  userMsg.className = 'message user';
  userMsg.innerText = `> ${text}`;
  box.appendChild(userMsg);
  input.value = '';
  box.scrollTop = box.scrollHeight;

  // 2. Initial AI placeholder
  const aiMsg = document.createElement('div');
  aiMsg.className = 'message ai';
  aiMsg.innerHTML = "[ACCESSING REPOSITORY CONTEXT...]<br>Scanning national registry and escrow data...";
  box.appendChild(aiMsg);
  box.scrollTop = box.scrollHeight;

  // 3. Simulated Repository Intelligence
  // In a real production environment, this would call a LLM with a RAG pipeline 
  // that has indexed the entire GitHub repository.
  
  setTimeout(() => {
    let response = "";
    const lowerText = text.toLowerCase();

    if (lowerText.includes("status") || lowerText.includes("rex")) {
      response = "[SYSTEM QUERY: DOG_STATUS]<br>Candidate REX (PAWS-2026-00402) is currently in TIER 1 training. SPCA welfare audit passed. Escrow funding secured via Standard Bank.";
    } else if (lowerText.includes("elder") || lowerText.includes("church")) {
      response = "[PERSONA SHIFT: COMMUNITY_LEADER]<br>Sir/Ma'am, the Elders can be assured that this project is built on integrity. Proverbs 12:10 is our guiding principle. The animals are loved, and the funds are audited by PwC.";
    } else if (lowerText.includes("milestone") || lowerText.includes("celebrate")) {
      response = "[CELEBRATION PROTOCOL]<br>🏆 MILESTONE REACHED: National K9 Registry has reached 500 tactical assets. R12.8M in strategic funding has been successfully ring-fenced.";
    } else if (lowerText.includes("partner") || lowerText.includes("sponsor")) {
      response = "[PERSONA SHIFT: CORPORATE_STRATEGY]<br>Our partners at Hollard and Standard Bank are seeing a 32% projected reduction in regional risk premiums through our tech-integrated tactical deployment.";
    } else if (lowerText.includes("dead man") || lowerText.includes("dms")) {
      response = "[SECURITY PROTOCOL: DMS_STATUS]<br>Dead Man's Switch is currently ARMED. Handover to AI Surrogate is programmed for 7 days of Commissioner inactivity.";
    } else {
      response = "[AI SURROGATE]<br>I am the PAWS-OS. I can answer questions about the repository architecture, the breeder rivalry, or the strategic rollout. How can I assist you further?";
    }

    aiMsg.innerHTML = response;
    box.scrollTop = box.scrollHeight;
  }, 1500);
}
