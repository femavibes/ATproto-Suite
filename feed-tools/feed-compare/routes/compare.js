import { XMLParser } from 'fast-xml-parser';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATA = (f) => join(process.env.DATA_DIR, f);

function readJSON(file, fallback) {
  const p = DATA(file);
  if (!existsSync(p)) return fallback;
  return JSON.parse(readFileSync(p, 'utf8'));
}
function writeJSON(file, data) {
  writeFileSync(DATA(file), JSON.stringify(data, null, 2));
}

async function resolveDid(handle) {
  const r = await fetch(`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`);
  if (!r.ok) throw new Error(`Could not resolve handle: ${handle}`);
  return (await r.json()).did;
}

export async function toFeedAtUri(input) {
  input = input.trim();
  if (input.startsWith('at://')) return input;
  const m = input.match(/bsky\.app\/profile\/([^/]+)\/feed\/([^/?#]+)/);
  if (!m) throw new Error(`Unrecognised feed URL: ${input}`);
  let did = m[1];
  if (!did.startsWith('did:')) did = await resolveDid(did);
  return `at://${did}/app.bsky.feed.generator/${m[2]}`;
}

async function fetchFeedMeta(atUri) {
  const r = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getFeedGenerator?feed=${encodeURIComponent(atUri)}`, {
    headers: { 'User-Agent': 'feed-compare/1.0' }
  });
  if (!r.ok) return null;
  const { view } = await r.json();
  return { displayName: view.displayName || '', description: view.description || '', creator: view.creator?.handle || '', uri: atUri };
}

async function fetchBskyFeed(atUri, limit) {
  const items = [], seen = new Set();
  let cursor;
  while (items.length < limit) {
    const params = new URLSearchParams({ feed: atUri, limit: '100' });
    if (cursor) params.set('cursor', cursor);
    const r = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getFeed?${params}`, {
      headers: { 'User-Agent': 'feed-compare/1.0' }
    });
    if (!r.ok) throw new Error(`Bluesky API error ${r.status} for ${atUri}`);
    const data = await r.json();
    for (const { post } of data.feed) {
      if (seen.has(post.uri)) continue;
      seen.add(post.uri);
      items.push({ uri: post.uri, title: post.record?.text || '', date: post.record?.createdAt || post.indexedAt || '', author: post.author?.handle || '', authorDid: post.author?.did || '', likes: post.likeCount || 0, reposts: post.repostCount || 0 });
    }
    if (!data.cursor || data.feed.length === 0) break;
    cursor = data.cursor;
  }
  return items.slice(0, limit).map((item, i) => ({ ...item, position: i + 1 }));
}

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function normalizeXmlFeed(raw) {
  if (raw?.items) return raw.items.map(i => ({ uri: i.url || i.id || '', title: i.title || '', date: i.date_published || '', author: '', authorDid: '' }));
  const feed = raw?.feed;
  if (feed?.entry) {
    const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];
    return entries.map(e => ({ uri: (Array.isArray(e.link) ? e.link[0] : e.link)?.['@_href'] || e.id || '', title: typeof e.title === 'object' ? e.title['#text'] : (e.title || ''), date: e.updated || e.published || '', author: '', authorDid: '' }));
  }
  const channel = raw?.rss?.channel;
  if (channel?.item) {
    const items = Array.isArray(channel.item) ? channel.item : [channel.item];
    return items.map(i => ({ uri: i.link || i.guid?.['#text'] || i.guid || '', title: i.title || '', date: i.pubDate || '', author: '', authorDid: '' }));
  }
  return [];
}

export async function fetchFeed(input, limit) {
  if (input.includes('bsky.app') || input.startsWith('at://')) {
    return fetchBskyFeed(await toFeedAtUri(input), limit);
  }
  const r = await fetch(input, { headers: { 'User-Agent': 'feed-compare/1.0' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${input}`);
  const text = await r.text();
  let raw;
  try { raw = JSON.parse(text); } catch { raw = xmlParser.parse(text); }
  return normalizeXmlFeed(raw).slice(0, limit).map((item, i) => ({ ...item, position: i + 1 }));
}

export function compareFeeds(a, b) {
  const aUris = new Set(a.map(i => i.uri));
  const bUris = new Set(b.map(i => i.uri));
  const matchedUris = new Set([...aUris].filter(u => bUris.has(u)));
  const bPosByUri = Object.fromEntries(b.map(i => [i.uri, i.position]));
  const aAnnotated = a.map(item => ({ ...item, matched: matchedUris.has(item.uri), positionDelta: matchedUris.has(item.uri) ? item.position - (bPosByUri[item.uri] ?? item.position) : null }));
  const bAnnotated = b.map(item => ({ ...item, matched: matchedUris.has(item.uri) }));
  const uniqueA = a.filter(i => !matchedUris.has(i.uri));
  const uniqueB = b.filter(i => !matchedUris.has(i.uri));
  const pctDiff = aUris.size > 0 ? Math.round((uniqueA.length / aUris.size) * 100) : 0;
  return { a: aAnnotated, b: bAnnotated, matchedCount: matchedUris.size, uniqueA, uniqueB, pctDiff };
}

export default function registerCompareRoutes(app) {
  app.post('/api/compare', async (req, res) => {
    const { feedA, feedB, limit = 100 } = req.body;
    if (!feedA || !feedB) return res.status(400).json({ error: 'feedA and feedB required' });
    try {
      const isBsky = u => u.includes('bsky.app') || u.startsWith('at://');
      const [rawA, rawB] = await Promise.all([fetchFeed(feedA, limit), fetchFeed(feedB, limit)]);
      const [metaA, metaB] = await Promise.all([
        isBsky(feedA) ? toFeedAtUri(feedA).then(fetchFeedMeta) : null,
        isBsky(feedB) ? toFeedAtUri(feedB).then(fetchFeedMeta) : null,
      ]);
      res.json({ ...compareFeeds(rawA, rawB), metaA, metaB });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/profiles', (_req, res) => res.json(readJSON('profiles.json', [])));
  app.post('/api/profiles', (req, res) => {
    const profiles = readJSON('profiles.json', []);
    const profile = { id: Date.now().toString(), ...req.body };
    profiles.push(profile);
    writeJSON('profiles.json', profiles);
    res.json(profile);
  });
  app.delete('/api/profiles/:id', (req, res) => {
    writeJSON('profiles.json', readJSON('profiles.json', []).filter(p => p.id !== req.params.id));
    res.json({ ok: true });
  });

  app.get('/api/settings', (_req, res) => res.json(readJSON('settings.json', { defaultLimit: 100 })));
  app.post('/api/settings', (req, res) => { writeJSON('settings.json', req.body); res.json(req.body); });
}
