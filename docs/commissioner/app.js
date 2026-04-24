// docs/commissioner/app.js
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.PAWS_CONFIG;
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentQueue = [];
let userSession = null;

window.onload = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  userSession = session;

  if (!session) {
    document.getElementById('login-overlay').style.display = 'flex';
  } else {
    document.getElementById('login-overlay').style.display = 'none';
    fetchQueue();
  }
};

async function handleLogin() {
  const email = document.getElementById('login-email').value;
  const msg = document.getElementById('login-msg');
  msg.innerText = "Sending...";
  
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.href
    }
  });

  if (error) {
    msg.innerText = "Error: " + error.message;
  } else {
    msg.innerText = "Check your email for the magic link!";
  }
}

async function fetchQueue() {
  const grid = document.querySelector('.dossier-grid');
  
  const { data, error } = await supabase
    .from('paws_dogs')
    .select('*')
    .eq('status', 'pending_commissioner')
    .order('created_at', { ascending: true });

  if (error) {
    console.error("Queue fetch error:", error);
    return;
  }

  currentQueue = data;
  renderQueue();
}

function renderQueue() {
  const grid = document.querySelector('.dossier-grid');
  
  if (currentQueue.length === 0) {
    grid.innerHTML = '<div class="glass-card" style="padding:40px; grid-column:1/-1; text-align:center;"><h2>All Clear</h2><p class="muted">No dogs pending tactical approval.</p></div>';
    return;
  }

  grid.innerHTML = currentQueue.map(dog => `
    <article class="glass-card dossier hologram-border" id="dog-${dog.id}">
      <div class="holo-strip"></div>
      <div class="dossier-image" style="background-image: url('${dog.photo_urls?.[0] || 'https://placedog.net/800/640?id=' + dog.paws_ref}')">
        <div style="position:absolute; top:20px; right:20px; background:var(--r50-red); padding:6px 12px; border-radius:4px; font-size:10px; font-weight:800;">${dog.source_tier || 'TIER 3'} CANDIDATE</div>
      </div>
      <div class="dossier-content">
        <h3 style="color:var(--r200-gold); margin-bottom:10px;">${dog.name} (<code>${dog.paws_ref}</code>)</h3>
        <div class="info-row"><span>Breed</span> <strong>${dog.breed}</strong></div>
        <div class="info-row"><span>Microchip</span> <strong>${dog.microchip_number}</strong></div>
        <div class="info-row"><span>Intake Date</span> <strong>${new Date(dog.created_at).toLocaleDateString()}</strong></div>
      </div>
      <div class="actions">
        <button class="btn-reject" onclick="decide('${dog.id}', 'REJECTED')">REJECT</button>
        <button class="btn-approve" onclick="decide('${dog.id}', 'APPROVED')">APPROVE ASSET</button>
      </div>
    </article>
  `).join('');
}

async function decide(dogId, decision) {
  // In a real prod setup, this would trigger the 2FA flow.
  // For the turnkey demo, we update the status and log the audit.
  
  const { error } = await supabase
    .from('paws_dogs')
    .update({ 
      status: decision.toLowerCase(),
      commissioner_decision: decision,
      commissioner_decision_at: new Date().toISOString(),
      commissioner_decision_by: userSession.user.id
    })
    .eq('id', dogId);

  if (error) {
    alert("Decision Error: " + error.message);
  } else {
    // Log Audit
    await supabase.from('paws_audit_log').insert([{
      actor_id: userSession.user.id,
      actor_role: 'commissioner',
      action: decision === 'APPROVED' ? 'DOG_APPROVED' : 'DOG_REJECTED',
      target_id: dogId,
      metadata: { decision }
    }]);

    currentQueue = currentQueue.filter(d => d.id !== dogId);
    renderQueue();
  }
}
