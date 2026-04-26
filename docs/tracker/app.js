// docs/tracker/app.js — reads from paws_public_dogs & public_source_stats only
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.PAWS_CONFIG;

const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };

// ── Helpers ──────────────────────────────────────────────────
function fmtTime() {
  return new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
}

function tierBadge(tier) {
  const map = {
    'Premier Partner': 'color:#fbbf24;',
    'Gold':            'color:#f59e0b;',
    'Silver':          'color:#94a3b8;',
    'Standard':        'color:var(--muted);',
  };
  return map[tier] || 'color:var(--muted);';
}

const escapeHTML = str => String(str).replace(/[&<>'"]/g, tag => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[tag]));

// ── 1. Load leaderboard from public view ─────────────────────
async function loadLeaderboard() {
  const el = document.getElementById('leaderboard-body');
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/public_source_stats?select=*&limit=10`,
      { headers }
    );
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      el.innerHTML = '<p class="muted">No leaderboard data yet. Intake will populate this.</p>';
      return;
    }

    el.innerHTML = data.map((row, i) => `
      <div class="league-row">
        <div class="league-rank">${String(i + 1).padStart(2, '0')}</div>
        <div class="league-info">
          <small>${escapeHTML(row.tier_label)}</small>
          <h4>Source: ${escapeHTML(row.source_code)}</h4>
        </div>
        <div class="league-score">
          <strong style="${tierBadge(row.tier_label)}">${Number(row.saps_accepted)} Accepted (${Number(row.service_rate_pct)}%)</strong>
          <div class="score-bar">
            <div class="score-fill" style="width: ${Math.min(Number(row.service_rate_pct), 100)}%;"></div>
          </div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    el.innerHTML = `<p class="muted">Unable to reach ledger. ${e.message}</p>`;
  }
}

// ── 2. Load aggregate stats ───────────────────────────────────
async function loadStats() {
  try {
    // Total count
    const r1 = await fetch(
      `${SUPABASE_URL}/rest/v1/paws_public_dogs?select=paws_ref`,
      { headers: { ...headers, Prefer: 'count=exact' } }
    );
    const total = r1.headers.get('content-range')?.split('/')[1] ?? '—';
    document.getElementById('total-count').innerText = total;

    // Accepted count
    const r2 = await fetch(
      `${SUPABASE_URL}/rest/v1/paws_public_dogs?select=paws_ref&status=in.(approved,accepted,deployed)`,
      { headers: { ...headers, Prefer: 'count=exact' } }
    );
    const accepted = r2.headers.get('content-range')?.split('/')[1] ?? '—';
    document.getElementById('total-accepted').innerText = accepted;
  } catch (e) {
    console.error('Stats fetch error:', e);
  }
}

// ── 3. Update timestamps ──────────────────────────────────────
function updateTimestamps() {
  const t = fmtTime();
  ['time-ct', 'time-w', 'time-d'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerText = t;
  });
  const sync = document.getElementById('last-sync');
  if (sync) sync.innerText = `LAST SYNC: ${t}`;
}

// ── Init ──────────────────────────────────────────────────────
loadLeaderboard();
loadStats();
updateTimestamps();
