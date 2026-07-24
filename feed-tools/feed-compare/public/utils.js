function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function esc(s) { return String(s).replace(/'/g,"\\'"); }

async function api(method, path, body) {
  const r = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  return r.json();
}

function openPost(url) { window.open(url, '_blank', 'noopener'); }

function bskyPostUrl(item) {
  return item.uri.startsWith('at://')
    ? `https://bsky.app/profile/${item.authorDid}/post/${item.uri.split('/').pop()}`
    : item.uri;
}

window._authorBits = function(author, highlightFn) {
  if (!author) return '';
  const highlightCb = highlightFn ? `onclick="event.stopPropagation();${highlightFn}('${esc(author)}')"` : '';
  return `<a class="author-highlight" href="https://bsky.app/profile/${escHtml(author)}" target="_blank" onclick="event.stopPropagation()">@${escHtml(author)}</a>`
    + (highlightFn ? ` <span class="author-ext" ${highlightCb}>[highlight]</span>` : '');
};
