let lastFeedA = '', lastFeedB = '';
let lastProfileId = null;
let viewMode = 'sidebyside';
let highlightedAuthor = null;
let fullData = null;

async function init() {
  const [profiles, settings] = await Promise.all([api('GET', '/api/profiles'), api('GET', '/api/settings')]);
  renderProfiles(profiles);
  const lim = settings.defaultLimit || 100;
  document.getElementById('displayLimit').value = lim;
  document.getElementById('defaultLimit').value = lim;
}

function getCurrentProfileId() {
  const feedA = document.getElementById('feedA').value.trim();
  const feedB = document.getElementById('feedB').value.trim();
  // try to match against a saved profile
  const profiles = JSON.parse(document.getElementById('profiles-bar').dataset.profiles || '[]');
  const match = profiles.find(p => p.feedA === feedA && p.feedB === feedB);
  return match?.id || null;
}

async function saveSnapshot() {
  if (!fullData) return;
  const label = prompt('Snapshot label (optional):') ?? '';
  const feedA = lastFeedA, feedB = lastFeedB;
  const limit = parseInt(document.getElementById('displayLimit').value);
  const r = await api('POST', '/api/snapshots', { profileId: lastProfileId, feedA, feedB, limit, label });
  if (r.error) return alert('Error: ' + r.error);
  alert(`Snapshot saved: ${new Date(r.timestamp).toLocaleString()}`);
}

async function startAutoSession() {
  const feedA = lastFeedA || document.getElementById('feedA').value.trim();
  const feedB = lastFeedB || document.getElementById('feedB').value.trim();
  if (!feedA || !feedB) return alert('Run a compare first or enter feed URLs');
  const name = prompt('Name this auto-snapshot session:');
  if (!name) return;
  const intervalMs = parseInt(document.getElementById('autoInterval').value) * 1000;
  const count = parseInt(document.getElementById('autoCount').value) || 10;
  const limit = parseInt(document.getElementById('displayLimit').value);
  const session = await api('POST', '/api/sessions', { profileId: lastProfileId, name, feedA, feedB, limit, intervalMs, maxSnapshots: count });
  if (session.error) return alert(session.error);
  await api('POST', `/api/sessions/${session.id}/start`);
  window.location.href = '/snapshots.html';
}

function renderProfiles(profiles) {
  const bar = document.getElementById('profiles-bar');
  bar.dataset.profiles = JSON.stringify(profiles);
  if (!profiles.length) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  bar.innerHTML = `<span class="profiles-label">Saved</span>` + profiles.map(p =>
    `<span class="profile-chip" onclick="loadProfile('${esc(p.feedA)}','${esc(p.feedB)}',${p.limit || 100},'${p.id}')">
      ${escHtml(p.name)}
      <span class="del" onclick="deleteProfile(event,'${p.id}')">x</span>
    </span>`
  ).join('');
}

function loadProfile(a, b, limit, profileId) {
  document.getElementById('feedA').value = a;
  document.getElementById('feedB').value = b;
  document.getElementById('displayLimit').value = limit;
  lastProfileId = profileId || null;
}

async function deleteProfile(e, id) {
  e.stopPropagation();
  if (!confirm('Delete this profile?')) return;
  await api('DELETE', `/api/profiles/${id}`);
  renderProfiles(await api('GET', '/api/profiles'));
}

async function saveProfile() {
  const feedA = document.getElementById('feedA').value.trim();
  const feedB = document.getElementById('feedB').value.trim();
  if (!feedA || !feedB) return alert('Enter both feed URLs first');
  const name = prompt('Profile name:');
  if (!name) return;
  const limit = parseInt(document.getElementById('displayLimit').value);
  await api('POST', '/api/profiles', { name, feedA, feedB, limit });
  renderProfiles(await api('GET', '/api/profiles'));
}

async function saveSettings() {
  await api('POST', '/api/settings', { defaultLimit: parseInt(document.getElementById('defaultLimit').value) });
}

function toggleSettings() {
  const p = document.getElementById('settings-panel');
  p.style.display = p.style.display === 'none' ? 'flex' : 'none';
}

async function runCompare() {
  const feedA = document.getElementById('feedA').value.trim();
  const feedB = document.getElementById('feedB').value.trim();
  const limit = parseInt(document.getElementById('displayLimit').value);
  if (!feedA || !feedB) { showError('Enter both feed URLs'); return; }
  hideError();
  setLoading(true);
  try {
    const data = await api('POST', '/api/compare', { feedA, feedB, limit });
    if (data.error) { showError(data.error); return; }
    fullData = data;
    lastFeedA = feedA; lastFeedB = feedB;
    lastProfileId = getCurrentProfileId();
    highlightedAuthor = null;
    document.getElementById('refreshBtn').style.display = '';
    document.getElementById('snapshotBtn').style.display = '';
    renderResults();
  } catch (e) { showError(e.message); }
  finally { setLoading(false); }
}

async function runRefresh() {
  if (!lastFeedA || !lastFeedB) return;
  const limit = parseInt(document.getElementById('displayLimit').value);
  hideError();
  setLoading(true);
  try {
    const data = await api('POST', '/api/compare', { feedA: lastFeedA, feedB: lastFeedB, limit });
    if (data.error) { showError(data.error); return; }
    fullData = data;
    highlightedAuthor = null;
    renderResults();
  } catch (e) { showError(e.message); }
  finally { setLoading(false); }
}

function setLoading(on) {
  const btn = document.getElementById('compareBtn');
  btn.disabled = on;
  btn.innerHTML = on ? '<span class="spinner"></span>Fetching...' : 'Compare';
  document.getElementById('refreshBtn').disabled = on;
}

// --- rendering ---

function renderResults() {
  const { a, b, matchedCount, uniqueA, uniqueB, pctDiff, metaA, metaB } = fullData;
  const diffColor = pctDiff > 30 ? 'red' : pctDiff > 10 ? 'yellow' : 'green';

  const feedHeadersHtml = (metaA || metaB) ? `
    <div class="feed-headers">
      <div class="feed-header a">
        <div class="feed-name">${escHtml(metaA?.displayName || 'Feed A')}</div>
        ${metaA?.description ? `<div class="feed-desc">${escHtml(metaA.description)}</div>` : ''}
        ${metaA?.creator ? `<div class="feed-creator">by @${escHtml(metaA.creator)}</div>` : ''}
      </div>
      <div class="feed-header b">
        <div class="feed-name">${escHtml(metaB?.displayName || 'Feed B')}</div>
        ${metaB?.description ? `<div class="feed-desc">${escHtml(metaB.description)}</div>` : ''}
        ${metaB?.creator ? `<div class="feed-creator">by @${escHtml(metaB.creator)}</div>` : ''}
      </div>
    </div>` : '';

  const avgLikes = (arr) => arr.length ? Math.round(arr.reduce((s, i) => s + i.likes, 0) / arr.length) : 0;

  const statsHtml = `
    <div class="stats-bar">
      <div class="stat"><div class="val">${a.length}</div><div class="lbl">Feed A</div></div>
      <div class="stat"><div class="val">${b.length}</div><div class="lbl">Feed B</div></div>
      <div class="stat-divider"></div>
      <div class="stat green"><div class="val">${matchedCount}</div><div class="lbl">Matching</div></div>
      <div class="stat red"><div class="val">${uniqueA.length}</div><div class="lbl">Only A</div></div>
      <div class="stat blue"><div class="val">${uniqueB.length}</div><div class="lbl">Only B</div></div>
      <div class="stat-divider"></div>
      <div class="stat ${diffColor}"><div class="val">${pctDiff}%</div><div class="lbl">Diff from A</div></div>
      <div class="stat-divider"></div>
      <div class="stat"><div class="val">${avgLikes(a)}</div><div class="lbl">Avg likes A</div></div>
      <div class="stat"><div class="val">${avgLikes(b)}</div><div class="lbl">Avg likes B</div></div>
      <div class="toolbar">
        <button class="${viewMode === 'sidebyside' ? 'active' : ''}" onclick="setView('sidebyside')">Side by Side</button>
        <button class="${viewMode === 'merged' ? 'active' : ''}" onclick="setView('merged')">Merged</button>
        <button class="${viewMode === 'byauthor' ? 'active' : ''}" onclick="setView('byauthor')">By Author</button>
      </div>
    </div>
    <div class="legend">
      <span><div class="dot match"></div>Match</span>
      <span><div class="dot ua"></div>Only in A</span>
      <span><div class="dot ub"></div>Only in B</span>
      ${highlightedAuthor ? '' : '<span style="color:var(--muted);font-size:11px">Click an author to highlight across both feeds</span>'}
    </div>`;

  const highlightBarHtml = highlightedAuthor ? `
    <div class="highlight-bar">
      Highlighting: <strong>@${escHtml(highlightedAuthor)}</strong>
      <button onclick="clearHighlight()">Clear</button>
    </div>` : '';

  const contentHtml = viewMode === 'sidebyside' ? renderSideBySide(a, b)
    : viewMode === 'merged' ? renderMerged(a, b)
    : renderAuthorGrouped(a, b);

  document.getElementById('results').innerHTML = feedHeadersHtml + statsHtml + highlightBarHtml + contentHtml;
}

function authorBits(author) { return window._authorBits(author, 'highlightAuthor'); }

function postCard(item, cls, showDelta = true) {
  const isHighlighted = highlightedAuthor && item.author === highlightedAuthor;
  const d = item.positionDelta;
  const inlineDelta = showDelta && d === 0 ? `<span class="delta same">= same pos</span>` : '';
  const blockDelta = showDelta && d != null && d !== 0
    ? (d > 0 ? `<span class="delta down">-${d} in B</span>` : `<span class="delta up">+${Math.abs(d)} in B</span>`)
    : '';
  const bskyUrl = item.uri.startsWith('at://')
    ? `https://bsky.app/profile/${item.authorDid}/post/${item.uri.split('/').pop()}`
    : item.uri;
  return `<div class="post ${cls}${isHighlighted ? ' highlighted' : ''}" onclick="openPost('${esc(bskyUrl)}')">
    <div class="post-top">
      <div class="pos">#${item.position}</div>
      <div class="body">
        <div class="title">${escHtml(item.title || '(no text)')}</div>
        <div class="meta">
          ${authorBits(item.author)}
          ${item.likes ? `<span>${item.likes.toLocaleString()} likes</span>` : ''}
          ${item.reposts ? `<span>${item.reposts.toLocaleString()} reposts</span>` : ''}
          ${item.date ? `<span>${new Date(item.date).toLocaleString()}</span>` : ''}
          ${inlineDelta}
        </div>
        ${blockDelta ? `<div class="delta-row">${blockDelta}</div>` : (showDelta ? `<div class="delta-row"></div>` : '')}
      </div>
    </div>
  </div>`;
}

function renderSideBySide(a, b) {
  const len = Math.max(a.length, b.length);
  let rows = '';
  for (let i = 0; i < len; i++) {
    const aCard = a[i] ? postCard(a[i], a[i].matched ? 'match' : 'unique-a') : '<div class="post-placeholder"></div>';
    const bCard = b[i] ? postCard(b[i], b[i].matched ? 'match' : 'unique-b') : '<div class="post-placeholder"></div>';
    rows += `<div class="sbs-row">${aCard}${bCard}</div>`;
  }
  return `<div class="side-by-side">
    <div class="sbs-headers"><span>Feed A</span><span>Feed B</span></div>
    ${rows}
  </div>`;
}

function renderMerged(a, b) {
  const toMs = d => d ? new Date(d).getTime() || 0 : 0;
  const matchItems = a.filter(i => i.matched).sort((x, y) => toMs(y.date) - toMs(x.date)).map(i => ({ ...i, _cls: 'match', _src: 'A+B' }));
  const uaItems = a.filter(i => !i.matched).sort((x, y) => toMs(y.date) - toMs(x.date)).map(i => ({ ...i, _cls: 'unique-a', _src: 'A only' }));
  const ubItems = b.filter(i => !i.matched).sort((x, y) => toMs(y.date) - toMs(x.date)).map(i => ({ ...i, _cls: 'unique-b', _src: 'B only' }));
  const html = [...matchItems, ...uaItems, ...ubItems].map(i => {
    const isHighlighted = highlightedAuthor && i.author === highlightedAuthor;
    const bskyUrl = i.uri.startsWith('at://')
      ? `https://bsky.app/profile/${i.authorDid}/post/${i.uri.split('/').pop()}`
      : i.uri;
    return `<div class="merged-post ${i._cls}${isHighlighted ? ' highlighted' : ''}" onclick="openPost('${esc(bskyUrl)}')">
      <div class="info">
        <div class="title">${escHtml(i.title || '(no text)')}</div>
        <div class="meta" style="font-size:11px;display:flex;gap:8px;flex-wrap:wrap;margin-top:3px">
          ${authorBits(i.author)}
          ${i.likes ? `<span>${i.likes.toLocaleString()} likes</span>` : ''}
          ${i.date ? `<span>${new Date(i.date).toLocaleString()}</span>` : ''}
        </div>
      </div>
      <div class="source">${i._src}</div>
    </div>`;
  }).join('');
  return `<div class="merged-list">${html}</div>`;
}

function renderAuthorGrouped(a, b) {
  const toMs = d => d ? new Date(d).getTime() || 0 : 0;
  const allPosts = [
    ...a.map(i => ({ ...i, _cls: i.matched ? 'match' : 'unique-a', _src: 'A' })),
    ...b.filter(i => !i.matched).map(i => ({ ...i, _cls: 'unique-b', _src: 'B' })),
  ];

  // Group by authorDid, track which feeds each author appears in
  const groups = new Map(); // did -> { handle, posts[], inA, inB }
  for (const post of allPosts) {
    if (!groups.has(post.authorDid)) groups.set(post.authorDid, { handle: post.author, posts: [], inA: false, inB: false });
    const g = groups.get(post.authorDid);
    g.posts.push(post);
    if (post._src === 'A') g.inA = true;
    // matched posts from A count as in B too
    if (post._src === 'B' || post.matched) g.inB = true;
  }
  // also mark inB for authors whose posts matched
  for (const post of b) {
    if (post.matched && groups.has(post.authorDid)) groups.get(post.authorDid).inB = true;
  }

  const shared = [], onlyA = [], onlyB = [];
  for (const g of groups.values()) {
    g.posts.sort((x, y) => toMs(y.date) - toMs(x.date));
    if (g.inA && g.inB) shared.push(g);
    else if (g.inA) onlyA.push(g);
    else onlyB.push(g);
  }

  // sort each bucket: most posts desc, then newest post as tiebreaker
  const sortGroups = (arr) => arr.sort((x, y) =>
    (y.posts.length - x.posts.length) || (toMs(y.posts[0]?.date) - toMs(x.posts[0]?.date))
  );
  sortGroups(shared); sortGroups(onlyA); sortGroups(onlyB);

  const renderGroup = (g) => {
    const isHighlighted = highlightedAuthor && g.handle === highlightedAuthor;
    const header = `<div class="author-group-header${isHighlighted ? ' highlighted' : ''}">
      ${authorBits(g.handle)}
      <span class="author-post-count">${g.posts.length} post${g.posts.length !== 1 ? 's' : ''}</span>
    </div>`;
    const posts = g.posts.map(i => postCard(i, i._cls, false)).join('');
    return header + posts;
  };

  const sections = [
    { groups: shared, label: `In both feeds (${shared.length} authors)`, cls: 'match' },
    { groups: onlyA, label: `Only in Feed A (${onlyA.length} authors)`, cls: 'unique-a' },
    { groups: onlyB, label: `Only in Feed B (${onlyB.length} authors)`, cls: 'unique-b' },
  ];

  return sections.map(({ groups, label, cls }) =>
    groups.length ? `<div class="author-section">
      <div class="author-section-label ${cls}-label">${label}</div>
      ${groups.map(renderGroup).join('')}
    </div>` : ''
  ).join('');
}

function openPost(url) { window.open(url, '_blank', 'noopener'); }
function highlightAuthor(handle) { highlightedAuthor = handle; renderResults(); }
function clearHighlight() { highlightedAuthor = null; renderResults(); }
function setView(mode) { viewMode = mode; renderResults(); }
function showError(msg) { const e = document.getElementById('error'); e.textContent = msg; e.style.display = 'block'; }
function hideError() { document.getElementById('error').style.display = 'none'; }

document.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runCompare(); });
init();
