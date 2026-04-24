// --- CONFIGURATION (Zero Keys!) ---
const PROJECT_REF = "dorihyvbgbhsxvdrtqqr";
const INTAKE_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/paws-intake`;

let SAVED_PIN = ""; // Temporary storage for session

function checkPin() {
  const pinInput = document.getElementById('pin').value;
  if (pinInput.length === 4) {
    SAVED_PIN = pinInput;
    document.getElementById('gate').style.display = 'none';
    document.getElementById('form-wrap').style.display = 'block';
  } else {
    alert("PIN must be 4 digits");
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
    pin: SAVED_PIN // PIN is sent to be verified by the server
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
    
  } catch (err) {
    resDiv.className = "error";
    resDiv.innerText = "Error: " + err.message;
    console.error(err);
  } finally {
    btn.innerText = "Register Dog";
    btn.disabled = false;
  }
});
