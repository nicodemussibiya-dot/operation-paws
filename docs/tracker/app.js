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


// ── 1. Load leaderboard from public view ─────────────────────
async function loadLeaderboard() {
  const el = document.getElementById('leaderboard-body');
  if (!el) return;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/public_source_stats?select=*&limit=10`,
      { headers }
    );
    const data = await res.json();

    el.textContent = '';
    if (!Array.isArray(data) || data.length === 0) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'No leaderboard data yet. Intake will populate this.';
      el.appendChild(p);
      return;
    }

    for (const [i, row] of data.entries()) {
      const wrap = document.createElement('div');
      wrap.className = 'league-row';

      const rank = document.createElement('div');
      rank.className = 'league-rank';
      rank.textContent = String(i + 1).padStart(2, '0');

      const info = document.createElement('div');
      info.className = 'league-info';
      const small = document.createElement('small');
      small.textContent = String(row.tier_label ?? '');
      const h4 = document.createElement('h4');
      h4.textContent = `Source: ${String(row.source_code ?? '')}`;
      info.append(small, h4);

      const score = document.createElement('div');
      score.className = 'league-score';
      const strong = document.createElement('strong');
      strong.setAttribute('style', tierBadge(row.tier_label));
      const accepted = Number(row.saps_accepted ?? 0);
      const pct = Number(row.service_rate_pct ?? 0);
      strong.textContent = `${accepted} Accepted (${pct}%)`;

      const bar = document.createElement('div');
      bar.className = 'score-bar';
      const fill = document.createElement('div');
      fill.className = 'score-fill';
      fill.style.width = `${Math.max(0, Math.min(pct, 100))}%`;
      bar.appendChild(fill);

      score.append(strong, bar);
      wrap.append(rank, info, score);
      el.appendChild(wrap);
    }
  } catch (e) {
    el.textContent = `Unable to reach ledger. ${e.message}`;
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
