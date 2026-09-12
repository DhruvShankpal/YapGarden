/* grow it out */

import { Store } from './store.js';

const $ = (s) => document.querySelector(s);
const SCREENS = ['signin', 'gate', 'home', 'record', 'done', 'inbox', 'garden'];
const show = (name) => {
  SCREENS.forEach((s) => $('#s-' + s).classList.toggle('hidden', s !== name));
  $('#stage-home').classList.toggle('hidden', name !== 'home');
  $('#stage-record').classList.toggle('hidden', name !== 'record');
  $('#stage-play').classList.toggle('hidden', name !== 'garden');
};
const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/* ── what this device looks like ──────────────────────────────────── */

const prefs = {
  tape: 'sepia',
  scene: 'midnight',
  load() {
    try {
      this.tape = localStorage.getItem('gio.tape') || this.tape;
      this.scene = localStorage.getItem('gio.scene') || this.scene;
    } catch (e) {}
  },
  save() {
    try {
      localStorage.setItem('gio.tape', this.tape);
      localStorage.setItem('gio.scene', this.scene);
    } catch (e) {}
  },
};
prefs.load();

/* ── the garden canvas ────────────────────────────────────────────── */

const SAYINGS = { 'valid.': 1, 'I would also crash out.': 1, 'stand UP': 1, 'this is crazy.': 1, 'you are so right.': 1 };

class Stage {
  constructor(canvas, bottomPad) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.px = 6;
    this.bottomPad = bottomPad;
    this.plants = [];
    this.reactions = [];
    this.mode = 'static';
    this.time = 0;
    this.images = {};
    this.stars = Array.from({ length: 48 }, () => ({ x: Math.random(), y: Math.random() * 0.7, a: 0.15 + Math.random() * 0.45 }));
    this.resize();
    addEventListener('resize', () => this.resize());
    const loop = () => { this.draw(); requestAnimationFrame(loop); };
    loop();
  }
  resize() {
    const dpr = Math.min(3, devicePixelRatio || 1);
    this.w = this.c.clientWidth; this.h = this.c.clientHeight;
    this.c.width = Math.round(this.w * dpr); this.c.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.groundY = Math.round(this.h - this.bottomPad);
  }
  plantAt(clientX, clientY, t) {
    const rect = this.c.getBoundingClientRect();
    const rows = Math.max(4, Math.min(64, Math.round((this.groundY - (clientY - rect.top)) / this.px)));
    const plant = { x: (clientX - rect.left) / rect.width, rows, type: pickPlant(rows), t, seed: Math.random() * 6.28 };
    plant._t0 = performance.now();
    this.plants.push(plant);
    return plant;
  }
  load(g) {
    this.plants = (g.plants || []).map((p) => ({ ...p }));
    this.reactions = (g.reactions || []).map((r) => ({ ...r }));
    this.revealAll();
  }
  clear() { this.plants = []; this.reactions = []; this.mode = 'static'; }
  revealAll() {
    this.mode = 'static';
    const t0 = performance.now() - 2000;
    this.plants.forEach((p) => { p._t0 = t0; });
    this.reactions.forEach((r) => { r._t0 = t0; });
  }
  seek(ms) {
    this.time = ms;   // scrub back and the garden regrows from there
    for (const p of this.plants) { if (p.t > ms) p._t0 = null; else if (!p._t0) p._t0 = performance.now() - 2000; }
    for (const r of this.reactions) { if (r.t > ms) r._t0 = null; else if (!r._t0) r._t0 = performance.now() - 2000; }
  }
  draw() {
    const { ctx, w, h, px, groundY } = this;
    const now = performance.now();
    paintScene(ctx, prefs.scene, w, h, groundY, this.stars, now, this.images);

    for (const p of this.plants) {
      if (this.mode === 'timed' && p.t > this.time) { p._t0 = null; continue; }
      if (!p._t0) p._t0 = now;
      const k = Math.min(1, (now - p._t0) / 420);
      drawPlant(ctx, p, Math.round(p.x * w), groundY, p.rows, px, 1 - Math.pow(1 - k, 3));
    }
    for (const r of this.reactions) {
      if (this.mode === 'timed' && r.t > this.time) { r._t0 = null; continue; }
      if (!r._t0) r._t0 = now;
      this.drawReaction(r, now);
    }
  }
  drawReaction(r, now) {
    const { ctx, w, h } = this;
    const age = now - r._t0, pop = Math.min(1, age / 260);
    let x = r.x * w, y = r.y * h;
    if (r.emoji === '🦝') { x = ((age / 4200 + r.x) % 1.2 - 0.1) * w; y = this.groundY - 14; }
    else y += Math.sin(now / 600 + r.x * 10) * 4;

    ctx.save();
    ctx.globalAlpha = 0.35 + 0.65 * pop;
    ctx.textAlign = 'center';
    if (r.kind === 'sticker') {
      const art = getSticker(r.emoji);
      if (art) {
        const size = 46 * (0.6 + 0.4 * pop);
        const k = size / Math.max(art.width, art.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(art, x - art.width * k / 2, y - art.height * k / 2, art.width * k, art.height * k);
      }
    } else if (r.kind === 'text' || SAYINGS[r.emoji]) {
      ctx.font = '9px "Press Start 2P", monospace';
      const tw = ctx.measureText(r.emoji).width, pad = 7;
      ctx.fillStyle = 'rgba(13,10,20,.92)';
      ctx.fillRect(x - tw / 2 - pad, y - 14, tw + pad * 2, 23);
      ctx.strokeStyle = '#ff7eb6'; ctx.lineWidth = 2;
      ctx.strokeRect(x - tw / 2 - pad, y - 14, tw + pad * 2, 23);
      ctx.fillStyle = '#f4e9d8';
      ctx.fillText(r.emoji, x, y + 1);
    } else {
      const size = 24 * (0.6 + 0.4 * pop) * (r.emoji === '🔥' ? 1 + Math.sin(now / 90) * 0.08 : 1);
      ctx.font = `${size}px serif`;
      ctx.fillText(r.emoji, x, y);
    }
    ctx.restore();
  }
}

/* ── recording ────────────────────────────────────────────────────── */

let recStage = null, recTape = null;
let media = { rec: null, chunks: [], stream: null, mime: '', startedAt: 0, elapsed: 0, tick: 0 };
let draft = null;

const pickMime = () => ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']
  .find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';

function openRecord() {
  show('record');
  if (!recStage) {
    recStage = new Stage($('#stage-record'), 176);
    recTape = new Cassette($('#rec-tape'), () => {
      (media.rec && media.rec.state === 'recording') ? stopRec() : startRec();
    });
    $('#stage-record').addEventListener('pointerdown', (e) => {
      if (!media.rec || media.rec.state !== 'recording') { $('#rec-hint').classList.remove('hidden'); return; }
      recStage.plantAt(e.clientX, e.clientY, Date.now() - media.startedAt);
      $('#rec-count').textContent = recStage.plants.length + ' planted';
    });
  }
  recStage.clear();
  recStage.resize();
  recTape.set({ tape: prefs.tape, running: false, progress: 0, title: '0:00' });
  $('#rec-count').textContent = '0 planted';
  $('#rec-hint').classList.remove('hidden');
}

const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

function micTrouble(name, detail) {
  const framed = window.self !== window.top;
  let policy = null;
  try { policy = document.featurePolicy ? document.featurePolicy.allowsFeature('microphone') : null; } catch (e) {}
  let fix;
  if (policy === false || (name === 'NotAllowedError' && framed)) {
    fix = "this page is embedded in another page that hasn't handed over microphone access. open it directly to yap.";
  } else if (name === 'NotAllowedError') {
    fix = 'your browser blocked the mic. allow the microphone for this site, then tap the tape again.';
  } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    fix = 'no microphone found on this device.';
  } else if (name === 'NotReadableError') {
    fix = 'something else is using the microphone. close it and try again.';
  } else if (name === 'unsupported') {
    fix = 'this browser cannot record audio — no MediaRecorder.';
  } else {
    fix = 'unexpected — ' + esc(detail || 'no detail');
  }
  $('#rec-hint').classList.remove('hidden');
  $('#rec-hint').innerHTML = `<p class="big">no mic 😐</p><p class="small dim">${fix}</p>
    <p class="small dim tiny">${esc(name)}${framed ? ' · embedded' : ' · top-level'}${policy === null ? '' : ' · mic policy: ' + (policy ? 'allowed' : 'blocked')}</p>`;
}

async function startRec() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) return micTrouble('unsupported', '');
  try { media.stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (err) { return micTrouble((err && err.name) || 'Error', (err && err.message) || ''); }

  media.mime = pickMime();
  media.chunks = [];
  media.rec = new MediaRecorder(media.stream, media.mime ? { mimeType: media.mime } : {});
  media.rec.ondataavailable = (e) => { if (e.data.size) media.chunks.push(e.data); };
  media.rec.onstop = endRec;
  media.rec.start(1000);
  media.startedAt = Date.now();
  $('#rec-hint').classList.add('hidden');
  recTape.set({ running: true });
  media.tick = setInterval(() => {
    const ms = Date.now() - media.startedAt;
    // No fixed length to a rant, so the reels wind on a rolling five minutes.
    recTape.set({ title: fmt(ms), progress: Math.min(1, ms / 300000) });
  }, 200);
}

function stopRec() {
  clearInterval(media.tick);
  media.elapsed = Date.now() - media.startedAt;
  recTape.set({ running: false });
  if (media.rec && media.rec.state !== 'inactive') media.rec.stop();
}

function endRec() {
  media.stream.getTracks().forEach((t) => t.stop());
  const type = media.rec.mimeType || media.mime || 'audio/webm';
  draft = {
    blob: new Blob(media.chunks, { type }), mime: type, durationMs: media.elapsed,
    plants: recStage.plants.map(({ x, rows, type: t, t: ts, seed }) => ({ x, rows, type: t, t: ts, seed })),
  };
  showDone();
}

const VERDICTS = ['yeah that person was annoying.', 'you, however, should probably drink some water.',
  'the garden is doing great. you are doing fine.', 'certified valid behaviour.', 'this one goes in the archive.'];

function showDone() {
  show('done');
  const counts = {};
  draft.plants.forEach((p) => { counts[p.type] = (counts[p.type] || 0) + 1; });
  const perMin = draft.plants.length / Math.max(0.5, draft.durationMs / 60000);
  const chilli = '🌶️'.repeat(Math.max(1, Math.min(5, Math.round(perMin / 3))));
  $('#done-stats').innerHTML = `${fmt(draft.durationMs)} of yapping<br>${draft.plants.length} plants grown`;
  $('#done-census').textContent = Object.entries(counts)
    .map(([k, n]) => `${PLANTS[k].emoji} ${n} ${PLANTS[k].label}${n > 1 ? 's' : ''}`).join('\n') || 'a suspiciously empty garden';
  $('#done-verdict').innerHTML = `emotional damage: ${chilli}<br>${VERDICTS[Math.floor(Math.random() * VERDICTS.length)]}`;
  $('#done-err').textContent = '';
  $('#done-send').disabled = false;
}

/* ── home ─────────────────────────────────────────────────────────── */

const TAGLINES = [
  'got something to get out?',
  'go on then.',
  'the garden is listening.',
  'say the whole thing.',
  'nobody here but the flowers.',
];

let homeStage = null, homeSeeded = 0;

function openHome() {
  show('home');
  if (!homeStage) {
    homeStage = new Stage($('#stage-home'), 34);
    const logo = $('#home-logo');
    const lctx = logo.getContext('2d');
    const paint = () => {
      const dpr = Math.min(3, devicePixelRatio || 1);
      const cw = logo.clientWidth, ch = logo.clientHeight;
      if (logo.width !== Math.round(cw * dpr)) {
        logo.width = Math.round(cw * dpr); logo.height = Math.round(ch * dpr);
      }
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lctx.imageSmoothingEnabled = false;
      lctx.clearRect(0, 0, cw, ch);
      drawLogo(lctx, cw, ch, performance.now(), prefs.tape);
      requestAnimationFrame(paint);
    };
    paint();
  }
  homeStage.resize();
  $('#home-tag').textContent = TAGLINES[Math.floor(Math.random() * TAGLINES.length)];
  seedHomeGarden();
  refreshHomeStats();
}

// A little garden grows itself across the bottom, then starts over.
function seedHomeGarden() {
  clearInterval(homeSeeded);
  const grow = () => {
    homeStage.plants = [];
    const n = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const rows = 6 + Math.floor(Math.random() * 13);   // short, so it frames rather than covers
      homeStage.plants.push({
        x: 0.06 + (i + Math.random() * 0.6) * (0.88 / n), rows, type: pickPlant(rows),
        t: 0, seed: Math.random() * 6.28, _t0: performance.now() + i * 260,
      });
    }
  };
  grow();
  homeSeeded = setInterval(grow, 9000);
}

async function refreshHomeStats() {
  let gardens = [];
  try { gardens = await Store.list(); } catch (err) { return; }
  const plants = gardens.reduce((n, g) => n + (g.plants || []).length, 0);
  const waiting = gardens.filter((g) => (g.mine
    ? (g.reactionCount || 0) && !g.reactionsSeenAt
    : !g.seenAt)).length;
  $('#home-gardens').textContent = waiting ? `gardens · ${waiting} new` : `gardens (${gardens.length})`;
  $('#home-gardens').classList.toggle('primary', waiting > 0);
  $('#home-stats').textContent = gardens.length
    ? `${gardens.length} garden${gardens.length === 1 ? '' : 's'} · ${plants} plants grown`
    : 'no gardens yet';
}

/* ── gardens ──────────────────────────────────────────────────────── */

async function openInbox() {
  show('inbox');
  $('#inbox-list').innerHTML = '<p class="foot">looking…</p>';
  let gardens = [];
  try { gardens = await Store.list(); }
  catch (err) { $('#inbox-list').innerHTML = `<p class="err small">${esc(err.message)}</p>`; return; }
  $('#inbox-note').textContent = Store.note || '';
  if (!gardens.length) {
    $('#inbox-list').innerHTML = '<p class="foot">nothing here yet. go yap about something.</p>';
    return;
  }
  $('#inbox-list').innerHTML = '';
  for (const g of gardens) {
    const n = g.reactionCount != null ? g.reactionCount : (g.reactions || []).length;
    const unread = g.mine ? (n && !g.reactionsSeenAt) : !g.seenAt;
    const b = document.createElement('button');
    b.className = 'card' + (unread ? ' unread' : '');
    const when = new Date(g.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    b.innerHTML = `<span><span class="title">${g.mine ? 'you yapped' : 'they yapped'} ${fmt(g.durationMs)}</span><br>
      <span class="sub">${when} · ${(g.plants || []).length} plants · ${n} reactions${unread ? ' · NEW' : ''}</span></span>
      <span class="grow">${g.mine ? '🌷' : '🎙️'}</span>`;
    b.onclick = () => openGarden(g.id);
    if (g.mine) {
      const bin = document.createElement('button');
      bin.className = 'card-bin';
      bin.textContent = 'delete';
      arm(bin, 'delete', 'sure?', async () => {
        try { await Store.remove(g); openInbox(); }
        catch (err) {
          bin.textContent = 'failed';
          $('#inbox-note').textContent = err.message;
        }
      });
      const side = document.createElement('span');
      side.className = 'card-side';
      side.append(bin, b.lastElementChild);
      b.appendChild(side);
    }
    $('#inbox-list').appendChild(b);
  }
}

const DECK = [
  { group: 'support', items: ['🥺', '🫂', '❤️', '😭', '🫡'] },
  { group: 'what', items: ['👁️👄👁️', '💀', '🚨', '🤨', '😦'] },
  { group: 'rage', items: ['😡', '🔨', '🔥', '⚔️', '🗡️'] },
  { group: 'useless', items: ['🦆', '🦝', '🍞', '🐌', '🧍'] },
  { group: 'said', items: ['valid.', 'I would also crash out.', 'stand UP', 'this is crazy.', 'you are so right.'] },
];

let playStage = null, playTape = null, current = null, picked = null;

async function openGarden(id) {
  let g;
  try { g = await Store.get(id); } catch (err) { return; }
  if (!g) return;
  current = g;
  picked = null;
  show('garden');
  if (!playStage) {
    playStage = new Stage($('#stage-play'), 250);
    playTape = new Cassette($('#g-tape'), () => { const a = $('#g-audio'); a.paused ? a.play() : a.pause(); });
    $('#stage-play').addEventListener('pointerdown', stamp);
  }
  playStage.resize();
  playStage.load(g);
  playTape.set({ tape: prefs.tape, running: false, progress: 0, title: fmt(g.durationMs) });

  const audio = $('#g-audio');
  audio.src = g.audioUrl || '';
  audio.currentTime = 0;
  $('#g-meta').textContent = `${g.mine ? 'you' : 'them'} · ${fmt(g.durationMs)} · ${(g.plants || []).length}🌱`;
  $('#g-time').textContent = '0:00';
  $('#g-fill').style.width = '0%';
  ticks();

  // Anyone who can open a garden can react to it, their own included.
  const n = g.reactions.length;
  $('#g-deck').classList.remove('hidden');
  $('#g-deckhint').textContent = n
    ? `${n} reaction${n === 1 ? '' : 's'} — press play to watch them land, or stamp another`
    : 'pick a sticker, then tap the garden to stamp it at that moment';
  buildDeck();

  const bin = $('#g-bin');
  bin.classList.toggle('hidden', !g.mine);
  bin.textContent = '🗑';
  bin.classList.remove('armed');
  if (g.mine) arm(bin, '🗑', 'delete?', async () => {
    audio.pause();
    try { await Store.remove(g); openInbox(); }
    catch (err) {
      bin.textContent = '🗑';
      $('#g-deckhint').textContent = err.message;
    }
  });

  Store.seen(id, g.mine ? 'author' : 'recipient').catch(() => {});
}

function buildDeck() {
  const deck = $('#g-deck');
  deck.innerHTML = '';
  const stickers = window.YAP_ASSETS.stickers || [];
  const add = (node, value) => {
    node.onclick = () => {
      picked = value;
      deck.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      node.classList.add('on');
      $('#g-deckhint').textContent = 'now tap the garden 👆';
    };
    deck.appendChild(node);
  };
  for (const s of stickers) {
    const b = document.createElement('button');
    b.className = 'pic';
    b.title = s.label || s.id;
    b.setAttribute('aria-label', s.label || s.id);
    const slot = document.createElement('span');
    slot.className = 'slot';
    b.appendChild(slot);
    paintThumb(slot, s.id);
    add(b, { emoji: s.id, kind: 'sticker' });
  }
  for (const group of DECK) for (const item of group.items) {
    const b = document.createElement('button');
    const isText = item.length > 3 && !/\p{Extended_Pictographic}/u.test(item);
    if (isText) b.className = 'txt';
    b.textContent = item;
    add(b, { emoji: item, kind: isText ? 'text' : 'emoji' });
  }
}

// getSticker returns null until the image has loaded and been cleaned.
function paintThumb(slot, id, tries = 0) {
  const art = getSticker(id);
  if (art) {
    const k = 30 / Math.max(art.width, art.height);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(art.width * k));
    c.height = Math.max(1, Math.round(art.height * k));
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = false;
    cx.drawImage(art, 0, 0, c.width, c.height);
    slot.replaceChildren(c);
  } else if (tries < 40) {
    setTimeout(() => paintThumb(slot, id, tries + 1), 100);
  }
}

async function stamp(e) {
  if (!current) return;
  if (!picked) { $('#g-deckhint').textContent = 'pick a sticker first 👇'; return; }
  const rect = $('#stage-play').getBoundingClientRect();
  const r = { ...picked, t: Math.round($('#g-audio').currentTime * 1000),
    x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height, createdAt: Date.now() };
  playStage.reactions.push({ ...r, _t0: performance.now() });
  current.reactions.push(r);
  ticks();
  try { await Store.react(current.id, r); }
  catch (err) { $('#g-deckhint').textContent = 'that reaction did not save 😔'; }
}

function ticks() {
  const total = Math.max(1, current.durationMs);
  $('#g-ticks').innerHTML = [
    ...(current.plants || []).map((p) => `<i style="left:${(p.t / total) * 100}%"></i>`),
    ...(current.reactions || []).map((r) => `<i class="react" style="left:${(r.t / total) * 100}%"></i>`),
  ].join('');
}

// Two taps to delete, rather than a dialog: the second tap within four
// seconds does it, and it disarms itself if you walk away.
function arm(btn, idle, confirm, run) {
  let armed = false, timer = 0;
  btn.onclick = (e) => {
    e.stopPropagation();
    if (armed) {
      clearTimeout(timer);
      armed = false;
      btn.classList.remove('armed');
      run();
      return;
    }
    armed = true;
    btn.textContent = confirm;
    btn.classList.add('armed');
    timer = setTimeout(() => {
      armed = false;
      btn.textContent = idle;
      btn.classList.remove('armed');
    }, 4000);
  };
}

/* ── customise ────────────────────────────────────────────────────── */

let setTape = null;

function openSettings() {
  $('#s-settings').classList.remove('hidden');
  if (!setTape) setTape = new Cassette($('#set-tape'), null);
  setTape.set({ tape: prefs.tape, running: true, progress: 0.4, title: 'side a' });

  const tapes = $('#set-tapes');
  tapes.innerHTML = '';
  for (const [id, t] of Object.entries(TAPES)) {
    const b = document.createElement('button');
    b.style.background = `linear-gradient(145deg, ${t.shellHi}, ${t.shell} 60%, ${t.shellLo})`;
    b.title = t.label;
    b.setAttribute('aria-label', t.label);
    b.className = id === prefs.tape ? 'on' : '';
    b.onclick = () => {
      prefs.tape = id; prefs.save();
      setTape.set({ tape: id });
      [recTape, playTape].forEach((c) => c && c.set({ tape: id }));
      tapes.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
    };
    tapes.appendChild(b);
  }

  const scenes = $('#set-scenes');
  scenes.innerHTML = '';
  for (const s of sceneList()) {
    const b = document.createElement('button');
    b.textContent = s.label;
    b.className = s.id === prefs.scene ? 'on' : '';
    b.onclick = () => {
      prefs.scene = s.id; prefs.save();
      scenes.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
    };
    scenes.appendChild(b);
  }
}

/* ── wiring ───────────────────────────────────────────────────────── */

const audio = $('#g-audio');
audio.onplay = () => { playTape.set({ running: true }); playStage.mode = 'timed'; };
audio.onpause = () => playTape.set({ running: false });
audio.onended = () => { playTape.set({ running: false, progress: 1 }); playStage.revealAll(); };
audio.onerror = () => { if (current) $('#g-deckhint').textContent = "this browser won't play that recording."; };
audio.ontimeupdate = () => {
  const ms = audio.currentTime * 1000;
  const total = Math.max(1, current ? current.durationMs : 1);
  $('#g-time').textContent = fmt(ms);
  $('#g-fill').style.width = Math.min(100, (ms / total) * 100) + '%';
  playTape.set({ progress: Math.min(1, ms / total), title: fmt(ms) });
  if (playStage.mode === 'timed') playStage.time = ms;
};
$('#g-track').onclick = (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const ms = ((e.clientX - rect.left) / rect.width) * Math.max(1, current.durationMs);
  try { audio.currentTime = ms / 1000; } catch (_) {}
  playStage.mode = 'timed';
  playStage.seek(ms);
};

$('#done-send').onclick = async () => {
  $('#done-send').disabled = true;
  $('#done-err').textContent = 'sending…';
  try {
    await Store.create({ mime: draft.mime, durationMs: draft.durationMs, plants: draft.plants }, draft.blob);
    draft = null;
    openHome();
  } catch (err) {
    $('#done-err').textContent = 'could not send: ' + err.message;
    $('#done-send').disabled = false;
  }
};
$('#done-trash').onclick = () => { draft = null; openHome(); };
$('#inbox-new').onclick = openRecord;
$('#inbox-back').onclick = openHome;
$('#home-yap').onclick = openRecord;
$('#home-gardens').onclick = openInbox;
$('#home-cog').onclick = openSettings;
$('#inbox-cog').onclick = openSettings;
$('#set-close').onclick = () => $('#s-settings').classList.add('hidden');
$('#rec-back').onclick = () => { (media.rec && media.rec.state === 'recording') ? stopRec() : openHome(); };
$('#g-back').onclick = () => { audio.pause(); openInbox(); };

$('#gate-go').onclick = async () => {
  Store.setPass($('#gate-input').value.trim());
  try { await Store.list(); openHome(); }
  catch (err) { $('#gate-err').textContent = 'nope, try again'; }
};
$('#signin-go').onclick = async () => {
  const email = $('#signin-input').value.trim();
  if (!email) return;
  $('#signin-go').disabled = true;
  $('#signin-msg').textContent = 'sending…';
  try {
    await Store.signIn(email);
    $('#signin-msg').textContent = 'check your email — tap the link on this device.';
  } catch (err) {
    $('#signin-msg').textContent = err.message;
    $('#signin-go').disabled = false;
  }
};
$('#signin-out').onclick = async () => { await Store.signOut(); show('signin'); };

async function boot() {
  if (Store.needsAuth) {
    Store.onAuthChange((session) => { if (session) openHome(); });
    if (!(await Store.session())) return show('signin');
    $('#signin-out').classList.remove('hidden');
    return openHome();
  }
  const { needsPass } = await fetch('/api/config').then((r) => r.json()).catch(() => ({ needsPass: false }));
  if (needsPass) {
    try { await Store.list(); } catch (err) { return show('gate'); }
  }
  openHome();
}

boot();
