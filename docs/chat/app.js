// docs/chat/app.js
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.PAWS_CONFIG;

let userRole = null;

const LINKS = {
  commissioner: "../commissioner/",
  elder: "../community-briefing/",
  partner: "../donate/",
  officer: "../admin/",
  breeder: "../tracker/",
  guest: "../start/"
};

window.onload = () => {
  const box = document.getElementById('chat-box');
  // Initial Boot Message
  const bootMsg = document.createElement('div');
  bootMsg.className = 'message ai';
  bootMsg.innerHTML = `
    [BOOT SEQUENCE: COMPLETE]<br>
    [IDENTITY PROTOCOL: ACTIVE]<br><br>
    I am PAWS-OS, your central tactical intelligence. I have indexed the entire national repository, from the R12.8M escrow funds to the Tier 1 breeder promotion rules.<br><br>
    Before we proceed with strategic queries, **who are you?** (e.g. Commissioner, Elder, Partner, Officer, or Breeder)
  `;
  box.appendChild(bootMsg);
};

async function sendMessage() {
  const input = document.getElementById('user-input');
  const box = document.getElementById('chat-box');
  const text = input.value.trim();
  if(!text) return;

  // Add user message to terminal
  const userMsg = document.createElement('div');
  userMsg.className = 'message user';
  userMsg.innerText = `> ${text}`;
  box.appendChild(userMsg);
  input.value = '';
  box.scrollTop = box.scrollHeight;

  const aiMsg = document.createElement('div');
  aiMsg.className = 'message ai';
  aiMsg.innerHTML = "[PROCESSING IDENTITY CONTEXT...]";
  box.appendChild(aiMsg);
  box.scrollTop = box.scrollHeight;

  setTimeout(() => {
    let response = "";
    const lowerText = text.toLowerCase();

    // 1. Identity Detection Logic
    if (!userRole) {
      if (lowerText.includes("commissioner")) {
        userRole = "commissioner";
        response = `[ACCESS GRANTED: LEVEL 10]<br>Welcome back, Commissioner. I have synchronized your tactical queue. 500 assets are ready for your review. R12.8M is secured.<br><br><strong>ACTION:</strong> <a href="${LINKS.commissioner}" style="color:var(--accent); font-weight:800;">OPEN COMMAND CENTER</a>`;
      } else if (lowerText.includes("elder") || lowerText.includes("church") || lowerText.includes("pastor")) {
        userRole = "elder";
        response = `[ACCESS GRANTED: COMMUNITY_LEADER]<br>Sir/Ma'am, it is an honor. I have prepared a briefing that explains our commitment to integrity and welfare. We are guided by Proverbs 12:10.<br><br><strong>ACTION:</strong> <a href="${LINKS.elder}" style="color:var(--accent); font-weight:800;">VIEW COMMUNITY BRIEFING</a>`;
      } else if (lowerText.includes("partner") || lowerText.includes("sponsor") || lowerText.includes("bank")) {
        userRole = "partner";
        response = `[ACCESS GRANTED: STRATEGIC_SPONSOR]<br>Your investment is currently ring-fenced and audited. We are projected to reduce regional risk premiums by 32%.<br><br><strong>ACTION:</strong> <a href="${LINKS.partner}" style="color:var(--accent); font-weight:800;">OPEN SPONSORSHIP HUB</a>`;
      } else if (lowerText.includes("officer") || lowerText.includes("admin") || lowerText.includes("intake")) {
        userRole = "officer";
        response = `[ACCESS GRANTED: FIELD_OPERATIVE]<br>Terminal Node-042 is active. Ready for candidate registration. Ensure microchips are verified before submission.<br><br><strong>ACTION:</strong> <a href="${LINKS.officer}" style="color:var(--accent); font-weight:800;">OPEN INTAKE TERMINAL</a>`;
      } else if (lowerText.includes("breeder") || lowerText.includes("kennel") || lowerText.includes("league")) {
        userRole = "breeder";
        response = `[ACCESS GRANTED: LEAGUE_PARTICIPANT]<br>The National Breeder Rivalry is in full swing. Check your current tier and aptitude rankings below.<br><br><strong>ACTION:</strong> <a href="${LINKS.breeder}" style="color:var(--accent); font-weight:800;">VIEW LEAGUE TRACKER</a>`;
      } else {
        response = `[IDENTIFICATION FAILED]<br>Please state your role so I can direct you to the correct tactical dashboard (e.g. Commissioner, Elder, Partner, etc.).`;
      }
    } else {
      // 2. Role-Aware Interaction (Answers like me)
      if (lowerText.includes("status") || lowerText.includes("rex") || lowerText.includes("audit")) {
        response = `
          [COUNCIL OF PAWS: ROUND ROBIN INITIATED]<br>
          1. Agent Alpha (Auditor): DATA VERIFIED. Microchip active. Escrow clear.<br>
          2. Agent Beta (Welfare): WELFARE VERIFIED. Zero violations.<br>
          3. Agent Gamma (Strategist): TACTICAL VERIFIED. Aptitude 96%.<br><br>
          [THE CHAIR]: Candidate REX is approved. I've logged this to the immutable audit trail for you.
        `;
      } else if (lowerText.includes("good") || lowerText.includes("how are you")) {
        response = `[PAWS-OS]: I am functioning at peak strategic capacity, Commissioner. The repository is clean, the dogs are healthy, and the security is unfuckwithable. We are ready to move.`;
      } else {
        response = `[PAWS-OS]: I am here to assist. I can pull any data from the 500-dog registry or explain our Tier 1 promotion rules. What is your next directive?`;
      }
    }

    aiMsg.innerHTML = response;
    box.scrollTop = box.scrollHeight;
  }, 1200);
}
