// docs/admin/app.js — Field Intake Terminal
// PIN is NEVER hardcoded. Entered by the officer at session start.
const { PROJECT_REF, SUPABASE_URL, SUPABASE_ANON_KEY } = window.PAWS_CONFIG;

const INTAKE_URL = `${SUPABASE_URL}/functions/v1/paws-intake`;
const PUBLIC_VIEW_URL = `${SUPABASE_URL}/rest/v1/paws_public_dogs?select=paws_ref,breed,status,intake_date&order=intake_date.desc&limit=5`;

let SAVED_PIN = null;

window.onload = () => {
  const pin = prompt("Enter authorized intake PIN to continue:");
  if (!pin || pin.length < 4) {
    document.body.innerHTML = '<div style="text-align:center;padding:80px;color:#ef4444;font-size:18px;">Access denied. PIN required.</div>';
    return;
  }
  SAVED_PIN = pin;
  document.getElementById('app-ui').style.display = 'block';
  fetchRecentIntakes();
};

async function fetchRecentIntakes() {
  const container = document.querySelector('.recent-list');
  try {
    const res = await fetch(PUBLIC_VIEW_URL, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    const data = await res.json();
    if (data && data.length > 0) {
      const listHtml = data.map(dog => `
        <div class="recent-item">
          <span><code>${dog.paws_ref}</code> — ${dog.breed}</span>
          <span style="color:var(--accent);">${(dog.status || '').toUpperCase()}</span>
        </div>
      `).join('');
      container.innerHTML = `<label>Recently Registered</label>${listHtml}`;
    }
  } catch (e) {
    console.error("Failed to fetch recent intakes:", e);
  }
}

async function submitForm(e) {
  e.preventDefault();
  const form = e.target;
  const inputs = form.querySelectorAll('input, select');

  const payload = {
    pin: SAVED_PIN,
    microchip: inputs[0].value,
    dog_name: inputs[1].value,
    breed: inputs[2].value,
    source_tier: "T" + inputs[3].value
  };

  const btn = form.querySelector('button');
  const originalText = btn.innerText;
  btn.innerText = "PROCESSING...";
  btn.disabled = true;

  try {
    const res = await fetch(INTAKE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY
      },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (res.ok) {
      document.getElementById('receipt-paws-id').innerText = result.paws_ref;
      document.getElementById('app-ui').style.display = 'none';
      document.getElementById('success-gate').style.display = 'flex';
    } else {
      alert("ERROR: " + (result.error || "Intake Failed"));
      btn.innerText = originalText;
      btn.disabled = false;
    }
  } catch (err) {
    alert("NETWORK ERROR: Check if Edge Functions are deployed.");
    btn.innerText = originalText;
    btn.disabled = false;
  }
}
