// --- CONFIGURATION ---
const PROJECT_REF = "dorihyvbgbhsxvdrtqqr";
const INTAKE_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/paws-intake`;
const PUBLIC_VIEW_URL = `https://${PROJECT_REF}.supabase.co/rest/v1/paws_public_tracker?select=*&order=intake_date.desc&limit=5`;
const ANON_KEY = "YOUR_SUPABASE_ANON_KEY"; // Needed for the public view

let SAVED_PIN = ""; 

function checkPin() {
  const pinInput = document.getElementById('pin').value;
  if (pinInput.length === 4) {
    SAVED_PIN = pinInput;
    document.getElementById('gate').style.display = 'none';
    document.getElementById('form-wrap').style.display = 'block';
    loadRecentDogs(); // Load list once unlocked
  } else {
    alert("PIN must be 4 digits");
  }
}

async function loadRecentDogs() {
  const recentDiv = document.getElementById('recent');
  try {
    const res = await fetch(PUBLIC_VIEW_URL, {
      headers: { "apikey": ANON_KEY, "Authorization": `Bearer ${ANON_KEY}` }
    });
    const dogs = await res.json();
    
    if (dogs.length === 0) {
      recentDiv.innerHTML = "<p style='font-size:13px;'>No dogs registered yet.</p>";
      return;
    }

    recentDiv.innerHTML = dogs.map(dog => `
      <div class="recent-item">
        <div>
          <span>${dog.paws_ref}</span><br>
          <small>${dog.breed}</small>
        </div>
        <small>${dog.status}</small>
      </div>
    `).join('');
  } catch (err) {
    recentDiv.innerHTML = "<p style='font-size:13px; color:red;'>Failed to load list.</p>";
  }
}

document.getElementById('intakeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  const resDiv = document.getElementById('result');
  
  btn.innerText = "Encrypting & Saving...";
  btn.disabled = true;

  const payload = {
    dog_name: document.getElementById('dog_name').value,
    breed: document.getElementById('breed').value,
    microchip_id: document.getElementById('microchip').value,
    source_tier: parseInt(document.getElementById('source_tier').value),
    pin: SAVED_PIN 
  };

  try {
    const response = await fetch(INTAKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.error || "Failed to save dog");

    resDiv.className = "success";
    resDiv.innerHTML = `
      SUCCESS! Dog Registered.<br>
      <span class="paws-id">${data.paws_ref}</span>
      <small>Write this on the physical folder</small>
    `;
    
    document.getElementById('intakeForm').reset();
    loadRecentDogs(); // Refresh the list
    
  } catch (err) {
    resDiv.className = "error";
    resDiv.innerText = "Error: " + err.message;
  } finally {
    btn.innerText = "Register Dog";
    btn.disabled = false;
  }
});
