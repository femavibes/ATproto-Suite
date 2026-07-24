let allSnaps = [];
let allSessions = [];
let allProfiles = [];
let runningSessions = new Set();
let selectedIds = new Set();

function authorBits(author) { return window._authorBits(author, null); }

async function init() {
  await refresh();
  setInterval(async () => { if (runningSessions.size > 0) await refresh(); }, 5000);
}

async function refresh() {
  [allSnaps, allSessions, allProfiles, runningSessions] = await Promise.all([
    api('GET', '/api/snapshots'),
    api('GET', '/api/sessions'),
    api('GET', '/api/profiles'),
    api('GET', '/api/sessions/running').then(ids => new Set(ids)),
  ]);
  renderSessions();
  renderSnapList();
  populateProfileFilter();
  populateSessionProfileFilter();
}

// --- sessions ---
function showNewSession() {
  document.getElementById('new-session-form').style.display = 'flex';
  api('GET', '/api/profiles').then(profiles => {
    const sel = document.getElementById('ns-profile');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- load a profile --</option>'
      + profiles.map(p => `<option value="${escHtml(p.feedA)}|||${escHtml(p.feedB)}|||${p.limit || 100}|||${p.id}">${escHtml(p.name)}</option>`).join('');
  });
}

function loadProfileIntoSession() {
  const val = document.getElementById('ns-profile').value;
  if (!val) return;
  const parts = val.split('|||');
  document.getElementById('ns-feedA').value = parts[0];
  document.getElementById('ns-feedB').value = parts[1];
  document.getElementById('ns-limit').value = parts[2] || 100;
}
function hideNewSession() { document.getElementById('new-session-form').style.display = 'none'; }

async function createSession() {
  const name = document.getElementById('ns-name').value.trim();
  const feedA = document.getElementById('ns-feedA').value.trim();
  const feedB = document.getElementById('ns-feedB').value.trim();
  const limit = parseInt(document.getElementById('ns-limit').value);
  const intervalMs = parseInt(document.getElementById('ns-interval').value);
  const maxSnapshots = parseInt(document.getElementById('ns-max').value) || 0;
  const profileId = document.getElementById('ns-profile').value.split('|||')[3] || null;
  if (!name || !feedA || !feedB) return alert('Name, Feed A and Feed B required');
  const r = await api('POST', '/api/sessions', { profileId, name, feedA, feedB, limit, intervalMs, maxSnapshots });
  if (r.error) return alert(r.error);
  await api('POST', `/api/sessions/${r.id}/start`);
  hideNewSession();
  await refresh();
}

function renderSessions() {
  const el = document.getElementById('sessions-list');
  const filterProfileId = document.getElementById('filter-session-profile')?.value || '';
  const filtered = filterProfileId ? allSessions.filter(s => s.profileId === filterProfileId) : allSessions;
  if (!filtered.length) { el.innerHTML = '<div class="snap-empty">No sessions yet</div>'; return; }
  el.innerHTML = allSessions.map(s => {
    const running = runningSessions.has(s.id);
    const done = !running && s.maxSnapshots > 0 && s.snapshots.length >= s.maxSnapshots;
    const snapCount = s.snapshots.length;
    const interval = s.intervalMs >= 60000 ? `${s.intervalMs/60000}m` : `${s.intervalMs/1000}s`;
    const progress = s.maxSnapshots > 0 ? `${snapCount}/${s.maxSnapshots}` : `${snapCount}`;
    const profileName = s.profileId ? allProfiles.find(p => p.id === s.profileId)?.name : null;
    const statusBadge = running
      ? `<span style="color:var(--green);font-size:11px">running</span>`
      : done ? `<span style="color:var(--muted);font-size:11px">complete</span>`
      : `<span style="color:var(--muted);font-size:11px">stopped</span>`;
    return `<div class="session-row">
      <div class="session-info">
        <span class="session-name">${escHtml(s.name)} ${statusBadge}</span>
        <span class="session-meta">${progress} snapshot${snapCount !== 1 ? 's' : ''} &middot; every ${interval}${s.maxSnapshots > 0 ? ` &middot; max ${s.maxSnapshots}` : ''}</span>
        <span class="session-feeds">${profileName ? `<span style="color:var(--accent)">${escHtml(profileName)}</span> &middot; ` : ''}${escHtml(s.feedA.split('/').pop())} vs ${escHtml(s.feedB.split('/').pop())}</span>
      </div>
      <div class="session-actions">
        ${snapCount >= 2 ? `<button onclick="loadSession('${s.id}')">View Timeline</button>` : ''}
        ${running ? `<button onclick="toggleSession('${s.id}')" style="color:var(--red)">Stop</button>` : ''}
        <button onclick="deleteSession('${s.id}')" style="color:var(--red)">Delete</button>
      </div>
    </div>`;
  }).join('');
}

async function toggleSession(id) {
  const running = runningSessions.has(id);
  await api('POST', `/api/sessions/${id}/${running ? 'stop' : 'start'}`);
  await refresh();
}

async function deleteSession(id) {
  if (!confirm('Delete this session? Snapshots will be kept.')) return;
  await api('DELETE', `/api/sessions/${id}`);
  await refresh();
}

async function loadSession(id) {
  const session = allSessions.find(s => s.id === id);
  if (!session) return;
  const snapIds = session.snapshots;
  const snaps = await Promise.all(snapIds.map(id => api('GET', `/api/snapshots/${id}`)));
  renderTimeline(snaps.filter(Boolean), session.name);
}

// --- snapshot list ---
function populateSessionProfileFilter() {
  const sel = document.getElementById('filter-session-profile');
  if (!sel) return;
  const current = sel.value;
  const used = allSessions.filter(s => s.profileId).map(s => s.profileId);
  const profiles = allProfiles.filter(p => used.includes(p.id));
  sel.innerHTML = '<option value="">All profiles</option>'
    + profiles.map(p => `<option value="${escHtml(p.id)}">${escHtml(p.name)}</option>`).join('');
  sel.value = current;
}


  const sel = document.getElementById('filter-profile');
  const current = sel.value;
  // group by profileId first, then fall back to feed combo
  const options = new Map();
  allSnaps.forEach(s => {
    const profile = s.profileId ? allProfiles.find(p => p.id === s.profileId) : null;
    const key = s.profileId || `${s.feedA}||${s.feedB}`;
    const label = profile ? profile.name : `${s.feedA.split('/').pop()} vs ${s.feedB.split('/').pop()}`;
    if (!options.has(key)) options.set(key, { label, count: 0 });
    options.get(key).count++;
  });
  sel.innerHTML = '<option value="">All</option>' + [...options.entries()].map(([key, v]) =>
    `<option value="${escHtml(key)}">${escHtml(v.label)} (${v.count})</option>`
  ).join('');
  sel.value = current;
}

function renderSnapList() {
  const filterKey = document.getElementById('filter-profile').value;
  const filtered = filterKey
    ? allSnaps.filter(s => (s.profileId || `${s.feedA}||${s.feedB}`) === filterKey)
    : allSnaps;

  document.getElementById('snap-count').textContent = `(${filtered.length})`;
  const el = document.getElementById('snap-list');
  if (!filtered.length) { el.innerHTML = '<div class="snap-empty">No snapshots yet</div>'; return; }

  el.innerHTML = filtered.map(s => {
    const sel = selectedIds.has(s.id);
    const sessionName = s.sessionId ? allSessions.find(ss => ss.id === s.sessionId)?.name : null;
    const profileName = s.profileId ? allProfiles.find(p => p.id === s.profileId)?.name : null;
    return `<div class="snap-row ${sel ? 'selected' : ''}" onclick="toggleSelect('${s.id}')">
      <div class="snap-check">${sel ? '[x]' : '[ ]'}</div>
      <div class="snap-info">
        <div class="snap-label">${escHtml(s.label || new Date(s.timestamp).toLocaleString())}</div>
        <div class="snap-meta">
          ${new Date(s.timestamp).toLocaleString()}
          ${profileName ? `&middot; <span style="color:var(--accent)">${escHtml(profileName)}</span>` : ''}
          ${sessionName ? `&middot; ${escHtml(sessionName)}` : ''}
        </div>
        <div class="snap-stats">
          <span class="green">${s.stats.matchedCount} match</span>
          <span class="red">${s.stats.uniqueA} only A</span>
          <span class="blue">${s.stats.uniqueB} only B</span>
          <span class="${s.stats.pctDiff > 30 ? 'red' : s.stats.pctDiff > 10 ? 'yellow' : 'green'}">${s.stats.pctDiff}% diff</span>
        </div>
      </div>
      <button onclick="event.stopPropagation();deleteSnap('${s.id}')" style="color:var(--red);font-size:11px">Delete</button>
    </div>`;
  }).join('');
}

function toggleSelect(id) {
  selectedIds.has(id) ? selectedIds.delete(id) : selectedIds.add(id);
  const btn = document.getElementById('compare-selected-btn');
  document.getElementById('sel-count').textContent = selectedIds.size;
  btn.style.display = selectedIds.size >= 2 ? '' : 'none';
  renderSnapList();
}

async function compareSelected() {
  if (selectedIds.size < 2) return;
  const snaps = await Promise.all([...selectedIds].map(id => api('GET', `/api/snapshots/${id}`)));
  renderTimeline(snaps.filter(Boolean).sort((a, b) => a.timestamp - b.timestamp), 'Selected Snapshots');
}

async function deleteSnap(id) {
  if (!confirm('Delete this snapshot?')) return;
  selectedIds.delete(id);
  await api('DELETE', `/api/snapshots/${id}`);
  await refresh();
}

// --- timeline ---
function renderTimeline(snaps, title) {
  if (snaps.length < 2) { alert('Need at least 2 snapshots to compare'); return; }
  const el = document.getElementById('timeline');
  el.style.display = '';
  el.scrollIntoView({ behavior: 'smooth' });

  // Stats over time table
  const statsRows = snaps.map(s => `<tr>
    <td>${new Date(s.timestamp).toLocaleString()}</td>
    <td>${escHtml(s.label || '')}</td>
    <td class="green">${s.stats.matchedCount}</td>
    <td class="red">${s.stats.uniqueA}</td>
    <td class="blue">${s.stats.uniqueB}</td>
    <td class="${s.stats.pctDiff > 30 ? 'red' : s.stats.pctDiff > 10 ? 'yellow' : 'green'}">${s.stats.pctDiff}%</td>
  </tr>`).join('');

  // Post tracking: collect all unique post URIs across all snapshots
  const allUris = new Set();
  snaps.forEach(s => { s.result.a.forEach(p => allUris.add(p.uri)); s.result.b.forEach(p => allUris.add(p.uri)); });

  // For each URI build position history across snapshots
  const postMeta = {}; // uri -> { title, author, authorDid }
  snaps.forEach(s => {
    [...s.result.a, ...s.result.b].forEach(p => {
      if (!postMeta[p.uri]) postMeta[p.uri] = { title: p.title, author: p.author, authorDid: p.authorDid };
    });
  });

  // Build position map per snapshot: uri -> { posA, posB, likes, reposts }
  const snapMaps = snaps.map(s => {
    const m = {};
    s.result.a.forEach(p => { m[p.uri] = { posA: p.position, likes: p.likes, reposts: p.reposts }; });
    s.result.b.forEach(p => { if (!m[p.uri]) m[p.uri] = {}; m[p.uri].posB = p.position; });
    return m;
  });

  // Re-rank diff: posts with biggest total position movement across snapshots (A positions only)
  const movers = [...allUris].map(uri => {
    const positions = snapMaps.map(m => m[uri]?.posA).filter(p => p != null);
    if (positions.length < 2) return null;
    const movement = Math.max(...positions) - Math.min(...positions);
    const trend = positions[positions.length - 1] - positions[0]; // negative = climbed
    return { uri, movement, trend, positions, ...postMeta[uri] };
  }).filter(Boolean).sort((a, b) => b.movement - a.movement).slice(0, 20);

  const moverRows = movers.map(m => {
    const trendCls = m.trend < 0 ? 'green' : m.trend > 0 ? 'red' : 'yellow';
    const trendStr = m.trend < 0 ? `+${Math.abs(m.trend)}` : m.trend > 0 ? `-${m.trend}` : '=';
    const posHistory = m.positions.join(' -> ');
    return `<tr>
      <td style="max-width:300px;font-size:12px">${escHtml(m.title?.slice(0, 80) || '')}${m.title?.length > 80 ? '...' : ''}</td>
      <td>${authorBits(m.author)}</td>
      <td class="${trendCls}" style="font-weight:700">${trendStr}</td>
      <td style="font-size:11px;color:var(--muted)">${posHistory}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="snap-panel">
      <div class="snap-panel-header">
        <span>Timeline: ${escHtml(title)} (${snaps.length} snapshots)</span>
        <button onclick="document.getElementById('timeline').style.display='none'">Close</button>
      </div>

      <h4 style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:12px 0 6px">Stats Over Time</h4>
      <div style="overflow-x:auto">
        <table class="timeline-table">
          <thead><tr><th>Time</th><th>Label</th><th class="green">Match</th><th class="red">Only A</th><th class="blue">Only B</th><th>% Diff</th></tr></thead>
          <tbody>${statsRows}</tbody>
        </table>
      </div>

      <h4 style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:16px 0 6px">Top Position Movers (Feed A)</h4>
      <div style="overflow-x:auto">
        <table class="timeline-table">
          <thead><tr><th>Post</th><th>Author</th><th>Net Change</th><th>Position History</th></tr></thead>
          <tbody>${moverRows.length ? moverRows : '<tr><td colspan="4" style="color:var(--muted);text-align:center">Not enough data — need posts that appear in multiple snapshots</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

function showError(msg) { const e = document.getElementById('error'); e.textContent = msg; e.style.display = 'block'; }

init();
