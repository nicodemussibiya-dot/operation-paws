// --- CONFIGURATION ---
const PROJECT_REF = "dorihyvbgbhsxvdrtqqr";
// NOTE: For a real app, you'd use the 'anon' key from your Supabase Dashboard
const ANON_KEY = "YOUR_SUPABASE_ANON_KEY"; 
const API_URL = `https://${PROJECT_REF}.supabase.co/rest/v1/paws_dogs`;
const ADMIN_PIN = "1234"; // Standard PIN for noobies (Change this!)

function checkPin() {
  const pin = document.getElementById('pin').value;
  if (pin === ADMIN_PIN) {
    document.getElementById('gate').style.display = 'none';
    document.getElementById('form-wrap').style.display = 'block';
  } else {
    alert("Incorrect PIN");
  }
}

document.getElementById('intakeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  const resDiv = document.getElementById('result');
  
  btn.innerText = "Processing...";
  btn.disabled = true;

  const payload = {
    dog_name: document.getElementById('dog_name').value,
    breed: document.getElementById('breed').value,
    microchip_id: document.getElementById('microchip').value,
    source_tier: parseInt(document.getElementById('source_tier').value),
    status: 'Screening'
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "apikey": ANON_KEY,
        "Authorization": `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation" // This tells Supabase to return the new row
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.message || "Failed to save dog");

    const dog = data[0];
    resDiv.className = "success";
    resDiv.innerHTML = `
      SUCCESS! Dog Registered.<br>
      <span class="paws-id">${dog.paws_ref}</span>
      <small>Write this on the physical folder</small>
    `;
    
    document.getElementById('intakeForm').reset();
    
  } catch (err) {
    resDiv.className = "error";
    resDiv.innerText = "Error: " + err.message;
  } finally {
    btn.innerText = "Register Dog";
    btn.disabled = false;
  }
});
