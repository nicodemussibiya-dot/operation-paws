const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.PAWS_CONFIG;

async function fetchStats() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/paws_public_stats?select=*`, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    const data = await res.json();
    
    // Default values
    const counts = { lead: 0, accepted: 0, training: 0, deployed: 0 };
    data.forEach(item => { counts[item.status] = item.total; });

    document.getElementById('stat-leads').innerText = counts.lead || 0;
    document.getElementById('stat-accepted').innerText = counts.accepted || 0;
    document.getElementById('stat-training').innerText = counts.training || 0;
    document.getElementById('stat-deployed').innerText = counts.deployed || 0;
  } catch (err) {
    console.error("Stats fetch error:", err);
  }
}

async function fetchRecentActivity() {
  const body = document.getElementById('tracker-body');
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/paws_public_tracker?select=*&limit=10`, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    const data = await res.json();
    
    if (data.length === 0) {
      body.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 40px; color: #9ca3af;">No recent activity found.</td></tr>';
      return;
    }

    body.innerHTML = data.map(row => `
      <tr>
        <td><code>${row.paws_ref}</code></td>
        <td>${row.breed}</td>
        <td><span class="badge ${row.status}">${row.status}</span></td>
        <td>${row.intake_date}</td>
      </tr>
    `).join('');
  } catch (err) {
    body.innerHTML = '<tr><td colspan="4">Error loading data.</td></tr>';
  }
}

// Initial Load
fetchStats();
fetchRecentActivity();
