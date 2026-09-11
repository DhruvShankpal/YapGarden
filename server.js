// Grow It Out — tiny zero-dependency server.
// Stores garden metadata in data/db.json and audio blobs in data/audio/.
// No npm install needed: `node server.js`.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 8321;  // 5173 is Vite's default — too crowded
const PUB = path.join(__dirname, 'public');
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
const AUDIO = path.join(DATA, 'audio');
const DB = path.join(DATA, 'db.json');
const PASS = process.env.GARDEN_PASS || ''; // optional shared passcode
const MAX_BODY = 48 * 1024 * 1024;

fs.mkdirSync(AUDIO, { recursive: true });

const EXT = {
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
};
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
};

function loadDb() {
  try { return JSON.parse(fs.readFileSync(DB, 'utf8')); }
  catch { return { gardens: [] }; }
}
function saveDb(db) {
  const tmp = DB + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB);
}
function send(res, code, body, headers = {}) {
  res.writeHead(code, { 'cache-control': 'no-store', ...headers });
  res.end(body);
}
function json(res, code, obj) {
  send(res, code, JSON.stringify(obj), { 'content-type': 'application/json; charset=utf-8' });
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('too big')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
// Strip the audio payload; clients never need it in list/detail responses.
const publicGarden = (g) => { const { audioFile, ...rest } = g; return rest; };

function serveStatic(req, res, urlPath) {
  const rel = urlPath === '/' ? 'index.html' : decodeURIComponent(urlPath).replace(/^\/+/, '');
  const file = path.resolve(PUB, rel);
  if (!file.startsWith(PUB)) return send(res, 403, 'nope');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'not found');
    send(res, 200, buf, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  });
}

// Safari will not play a media URL that ignores Range requests.
function serveAudio(req, res, id) {
  const g = loadDb().gardens.find((x) => x.id === id);
  if (!g || !g.audioFile) return send(res, 404, 'no audio');
  const file = path.join(AUDIO, g.audioFile);
  let stat;
  try { stat = fs.statSync(file); } catch { return send(res, 404, 'no audio'); }

  const base = { 'content-type': g.mime || 'audio/webm', 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=3600' };
  const range = req.headers.range;
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range);
  if (m) {
    let start = m[1] === '' ? null : parseInt(m[1], 10);
    let end = m[2] === '' ? null : parseInt(m[2], 10);
    if (start === null) { start = Math.max(0, stat.size - (end || 0)); end = stat.size - 1; }
    if (end === null || end >= stat.size) end = stat.size - 1;
    if (start > end) return send(res, 416, '', { 'content-range': `bytes */${stat.size}` });
    res.writeHead(206, { ...base, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${stat.size}` });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...base, 'content-length': stat.size });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (!p.startsWith('/api/')) return serveStatic(req, res, p);

  if (p === '/api/config') return json(res, 200, { needsPass: !!PASS });
  if (PASS && req.headers['x-garden-pass'] !== PASS) return json(res, 401, { error: 'bad passcode' });

  try {
    // GET /api/gardens?to=him  — inbox + sent list
    if (p === '/api/gardens' && req.method === 'GET') {
      const db = loadDb();
      return json(res, 200, { gardens: db.gardens.map(publicGarden).sort((a, b) => b.createdAt - a.createdAt) });
    }

    // POST /api/gardens — { from, to, durationMs, mime, plants, audioBase64 }
    if (p === '/api/gardens' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString('utf8'));
      const id = crypto.randomBytes(8).toString('hex');
      const mime = (body.mime || 'audio/webm').split(';')[0];
      const ext = EXT[mime] || 'bin';
      const audioFile = `${id}.${ext}`;
      if (!body.audioBase64) return json(res, 400, { error: 'no audio' });
      fs.writeFileSync(path.join(AUDIO, audioFile), Buffer.from(body.audioBase64, 'base64'));
      const garden = {
        id,
        author: String(body.author || 'device').slice(0, 64),
        createdAt: Date.now(),
        durationMs: Math.max(0, Number(body.durationMs) || 0),
        mime,
        audioFile,
        plants: Array.isArray(body.plants) ? body.plants.slice(0, 2000) : [],
        reactions: [],
        seenAt: null,
        reactionsSeenAt: null,
      };
      const db = loadDb();
      db.gardens.push(garden);
      saveDb(db);
      return json(res, 201, { garden: publicGarden(garden) });
    }

    const one = /^\/api\/gardens\/([a-f0-9]{16})(\/[a-z]+)?$/.exec(p);
    if (one) {
      const [, id, sub] = one;
      const db = loadDb();
      const g = db.gardens.find((x) => x.id === id);
      if (!g) return json(res, 404, { error: 'not found' });

      if (!sub && req.method === 'GET') return json(res, 200, { garden: publicGarden(g) });

      if (!sub && req.method === 'DELETE') {
        if (g.audioFile) { try { fs.unlinkSync(path.join(AUDIO, g.audioFile)); } catch (e) {} }
        db.gardens = db.gardens.filter((x) => x.id !== id);
        saveDb(db);
        return json(res, 200, { ok: true });
      }

      // POST /api/gardens/:id/reactions — { kind, emoji, t, x, y, from }
      if (sub === '/reactions' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req)).toString('utf8'));
        const r = {
          id: crypto.randomBytes(4).toString('hex'),
          emoji: String(b.emoji || '').slice(0, 64),
          kind: ['text', 'sticker'].includes(b.kind) ? b.kind : 'emoji',
          t: Math.max(0, Number(b.t) || 0),
          x: Math.min(1, Math.max(0, Number(b.x) || 0.5)),
          y: Math.min(1, Math.max(0, Number(b.y) || 0.5)),
          author: String(b.author || 'device').slice(0, 64),
          createdAt: Date.now(),
        };
        g.reactions.push(r);
        g.reactionsSeenAt = null;
        saveDb(db);
        return json(res, 201, { reaction: r });
      }

      // POST /api/gardens/:id/seen — { which: 'recipient' | 'author' }
      if (sub === '/seen' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req)).toString('utf8') || '{}');
        if (b.which === 'author') g.reactionsSeenAt = Date.now();
        else g.seenAt = Date.now();
        saveDb(db);
        return json(res, 200, { ok: true });
      }
      return json(res, 405, { error: 'method not allowed' });
    }

    const aud = /^\/api\/audio\/([a-f0-9]{16})$/.exec(p);
    if (aud && (req.method === 'GET' || req.method === 'HEAD')) return serveAudio(req, res, aud[1]);

    return json(res, 404, { error: 'no such route' });
  } catch (err) {
    return json(res, 400, { error: String(err.message || err) });
  }
});

// If the port is busy, walk up to the next free one rather than dying.
function listen(port, attemptsLeft = 10) {
  server.once('error', (err) => {
    if (err.code !== 'EADDRINUSE' || attemptsLeft === 0) throw err;
    console.log(`   port ${port} is busy, trying ${port + 1}…`);
    listen(port + 1, attemptsLeft - 1);
  });
  server.listen(port, () => {
    console.log(`🌷 grow it out  →  http://localhost:${port}`);
    if (!PASS) console.log('   (no GARDEN_PASS set — anyone with the URL can open it)');
  });
}
listen(PORT);
