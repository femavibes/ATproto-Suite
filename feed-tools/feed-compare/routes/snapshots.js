import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { fetchFeed, compareFeeds, toFeedAtUri } from './compare.js';

const DATA = (f) => join(process.env.DATA_DIR, f);
const SNAP_DIR = () => { const d = DATA('snapshots'); if (!existsSync(d)) mkdirSync(d); return d; };

function readJSON(file, fallback) {
  const p = DATA(file);
  if (!existsSync(p)) return fallback;
  return JSON.parse(readFileSync(p, 'utf8'));
}
function writeJSON(file, data) { writeFileSync(DATA(file), JSON.stringify(data, null, 2)); }

function readSnap(id) {
  const p = join(SNAP_DIR(), `${id}.json`);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}
function writeSnap(snap) { writeFileSync(join(SNAP_DIR(), `${snap.id}.json`), JSON.stringify(snap, null, 2)); }
function listSnaps() {
  return readdirSync(SNAP_DIR())
    .filter(f => f.endsWith('.json'))
    .map(f => { const s = JSON.parse(readFileSync(join(SNAP_DIR(), f), 'utf8')); return { id: s.id, profileId: s.profileId, sessionId: s.sessionId || null, label: s.label, timestamp: s.timestamp, feedA: s.feedA, feedB: s.feedB, limit: s.limit, stats: s.stats }; })
    .sort((a, b) => b.timestamp - a.timestamp);
}

// Active auto-snapshot timers: sessionId -> intervalHandle
const activeTimers = new Map();

async function takeSnapshot(profileId, feedA, feedB, limit, label, sessionId = null) {
  const [rawA, rawB] = await Promise.all([fetchFeed(feedA, limit), fetchFeed(feedB, limit)]);
  const result = compareFeeds(rawA, rawB);
  const id = Date.now().toString();
  const snap = {
    id, profileId, sessionId, label, timestamp: Date.now(),
    feedA, feedB, limit,
    stats: { matchedCount: result.matchedCount, uniqueA: result.uniqueA.length, uniqueB: result.uniqueB.length, pctDiff: result.pctDiff, totalA: result.a.length, totalB: result.b.length },
    result,
  };
  writeSnap(snap);
  // attach to session
  if (sessionId) {
    const sessions = readJSON('sessions.json', []);
    const s = sessions.find(s => s.id === sessionId);
    if (s) { s.snapshots.push(id); writeJSON('sessions.json', sessions); }
  }
  return snap;
}

export default function registerSnapshotRoutes(app) {
  // --- snapshots ---
  app.get('/api/snapshots', (_req, res) => res.json(listSnaps()));
  app.get('/api/snapshots/:id', (req, res) => {
    const s = readSnap(req.params.id);
    if (!s) return res.status(404).json({ error: 'not found' });
    res.json(s);
  });
  app.post('/api/snapshots', async (req, res) => {
    const { profileId, feedA, feedB, limit = 100, label = '' } = req.body;
    if (!feedA || !feedB) return res.status(400).json({ error: 'feedA and feedB required' });
    try {
      const snap = await takeSnapshot(profileId, feedA, feedB, limit, label);
      res.json({ id: snap.id, timestamp: snap.timestamp, stats: snap.stats });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.delete('/api/snapshots/:id', (req, res) => {
    const p = join(SNAP_DIR(), `${req.params.id}.json`);
    if (existsSync(p)) unlinkSync(p);
    // remove from any session
    const sessions = readJSON('sessions.json', []);
    sessions.forEach(s => { s.snapshots = s.snapshots.filter(id => id !== req.params.id); });
    writeJSON('sessions.json', sessions);
    res.json({ ok: true });
  });

  // --- sessions ---
  app.get('/api/sessions', (_req, res) => res.json(readJSON('sessions.json', [])));
  app.post('/api/sessions', (req, res) => {
    const { profileId, name, feedA, feedB, limit = 100, intervalMs, maxSnapshots = 0 } = req.body;
    if (!name || !feedA || !feedB) return res.status(400).json({ error: 'name, feedA, feedB required' });
    const sessions = readJSON('sessions.json', []);
    const session = { id: Date.now().toString(), profileId, name, feedA, feedB, limit, intervalMs, maxSnapshots, snapshots: [], createdAt: Date.now() };
    sessions.push(session);
    writeJSON('sessions.json', sessions);
    res.json(session);
  });
  app.delete('/api/sessions/:id', (req, res) => {
    stopSession(req.params.id);
    writeJSON('sessions.json', readJSON('sessions.json', []).filter(s => s.id !== req.params.id));
    res.json({ ok: true });
  });

  // --- auto-snapshot start/stop ---
  app.post('/api/sessions/:id/start', (req, res) => {
    const sessions = readJSON('sessions.json', []);
    const session = sessions.find(s => s.id === req.params.id);
    if (!session) return res.status(404).json({ error: 'session not found' });
    if (activeTimers.has(session.id)) return res.json({ running: true });

    const scheduleNext = () => {
      const handle = setTimeout(async () => {
        // re-read session from disk to get current snapshot count
        const current = readJSON('sessions.json', []).find(s => s.id === session.id);
        if (!current || !activeTimers.has(session.id)) return;
        if (session.maxSnapshots > 0 && current.snapshots.length >= session.maxSnapshots) {
          stopSession(session.id);
          return;
        }
        await takeSnapshot(session.profileId, session.feedA, session.feedB, session.limit, new Date().toISOString(), session.id).catch(console.error);
        scheduleNext();
      }, session.intervalMs);
      activeTimers.set(session.id, handle);
    };

    // immediate first snapshot then schedule
    takeSnapshot(session.profileId, session.feedA, session.feedB, session.limit, new Date().toISOString(), session.id)
      .then(() => {
        const current = readJSON('sessions.json', []).find(s => s.id === session.id);
        if (session.maxSnapshots > 0 && current && current.snapshots.length >= session.maxSnapshots) {
          stopSession(session.id);
        } else {
          scheduleNext();
        }
      })
      .catch(console.error);

    activeTimers.set(session.id, null); // mark as running immediately
    res.json({ running: true });
  });
  app.post('/api/sessions/:id/stop', (req, res) => {
    stopSession(req.params.id);
    res.json({ running: false });
  });
  app.get('/api/sessions/running', (_req, res) => res.json([...activeTimers.keys()]));
}

function stopSession(id) {
  if (activeTimers.has(id)) { clearTimeout(activeTimers.get(id)); activeTimers.delete(id); }
}
