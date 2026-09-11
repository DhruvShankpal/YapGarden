/* grow it out — MVP client */

const $ = (s) => document.querySelector(s);
const SCREENS = ['gate', 'pick', 'record', 'done', 'inbox', 'garden'];
const show = (name) => SCREENS.forEach((s) => $('#s-' + s).classList.toggle('hidden', s !== name));

let ME = localStorage.getItem('yg.me') || '';
let PASS = localStorage.getItem('yg.pass') || '';
const other = (who) => (who === 'her' ? 'him' : 'her');
const NAME = { her: 'her', him: 'you' };

const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(PASS ? { 'x-garden-pass': PASS } : {}), ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.status);
  return res.json();
}

/* ─────────────────────────── the garden canvas ─────────────────────────── */

const REACTION_TEXT = { 'valid.': 1, 'I would also crash out.': 1, 'girl stand UP': 1, 'this is crazy.': 1, 'you are so right.': 1 };

class Stage {
  constructor(canvas, bottomPad) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.px = 6;                  // size of one sprite pixel, in CSS px
    this.bottomPad = bottomPad;   // room for the controls
    this.plants = [];
    this.reactions = [];
    this.mode = 'static';         // 'static' = show everything, 'timed' = reveal by this.time
    this.time = 0;                // ms into the recording
    this.stars = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random() * 0.7, a: 0.15 + Math.random() * 0.4 }));
    this.resize();
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    const loop = () => { this.draw(); this._raf = requestAnimationFrame(loop); };
    loop();
  }
  destroy() { cancelAnimationFrame(this._raf); window.removeEventListener('resize', this._onResize); }

  resize() {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    this.w = this.canvas.clientWidth;
    this.h = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.groundY = Math.round(this.h - this.bottomPad);
  }

  // A tap becomes a plant: height of the tap decides how tall (and which) plant.
  plantAt(clientX, clientY, t) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = clientY - rect.top;
    const rows = Math.max(4, Math.min(64, Math.round((this.groundY - y) / this.px)));
    const plant = { x, rows, type: pickPlant(rows), t, seed: Math.random() * 6.28 };
    plant._t0 = performance.now();
    this.plants.push(plant);
    return plant;
  }

  setGarden(g) {
    this.plants = (g.plants || []).map((p) => ({ ...p }));
    this.reactions = (g.reactions || []).map((r) => ({ ...r }));
    this.revealAll();
  }
  revealAll() {
    this.mode = 'static';
    const t0 = performance.now() - 2000;
    this.plants.forEach((p) => { p._t0 = t0; });
    this.reactions.forEach((r) => { r._t0 = t0; });
  }
  seek(ms) {
    this.time = ms;
    // Anything after the playhead un-grows, so scrubbing back replays the garden.
    for (const p of this.plants) { if (p.t > ms) p._t0 = null; else if (!p._t0) p._t0 = performance.now() - 2000; }
    for (const r of this.reactions) { if (r.t > ms) r._t0 = null; else if (!r._t0) r._t0 = performance.now() - 2000; }
  }

  draw() {
    const { ctx, w, h, px, groundY } = this;
    const now = performance.now();
    ctx.fillStyle = '#07060b';
    ctx.fillRect(0, 0, w, h);

    for (const s of this.stars) {
      ctx.fillStyle = `rgba(244,233,216,${s.a})`;
      ctx.fillRect(Math.round(s.x * w), Math.round(s.y * groundY), 2, 2);
    }
    // dirt
    ctx.fillStyle = '#2a1d14';
    ctx.fillRect(0, groundY, w, h - groundY);
    ctx.fillStyle = '#3b2a1c';
    for (let x = 0; x < w; x += px * 2) ctx.fillRect(x, groundY, px, px);

    for (const p of this.plants) {
      if (this.mode === 'timed' && p.t > this.time) { p._t0 = null; continue; }
      if (!p._t0) p._t0 = now;
      const k = Math.min(1, (now - p._t0) / 420);
      const grow = 1 - Math.pow(1 - k, 3); // ease out
      drawPlant(ctx, p, Math.round(p.x * w), groundY, p.rows, px, grow);
    }

    for (const r of this.reactions) {
      if (this.mode === 'timed' && r.t > this.time) { r._t0 = null; continue; }
      if (!r._t0) r._t0 = now;
      this.drawReaction(r, now);
    }
  }

  drawReaction(r, now) {
    const { ctx, w, h } = this;
    const age = now - r._t0;
    const pop = Math.min(1, age / 260);
    let x = r.x * w;
    let y = r.y * h;

    if (r.emoji === '🦝') { // the raccoon does not respect your garden
      x = ((age / 4200 + r.x) % 1.2 - 0.1) * w;
      y = this.groundY - 14;
    } else {
      y += Math.sin(now / 600 + r.x * 10) * 4; // gentle bob
    }

    ctx.save();
    ctx.globalAlpha = 0.35 + 0.65 * pop;
    if (r.kind === 'text' || REACTION_TEXT[r.emoji]) {
      ctx.font = '9px "Press Start 2P", monospace';
      const pad = 6;
      const tw = ctx.measureText(r.emoji).width;
      ctx.fillStyle = '#0d0a14e6';
      ctx.fillRect(x - tw / 2 - pad, y - 14, tw + pad * 2, 22);
      ctx.strokeStyle = '#ff7eb6';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - tw / 2 - pad, y - 14, tw + pad * 2, 22);
      ctx.fillStyle = '#f4e9d8';
      ctx.textAlign = 'center';
      ctx.fillText(r.emoji, x, y + 1);
    } else {
      const size = 22 * (0.6 + 0.4 * pop) * (r.emoji === '🔥' ? 1 + Math.sin(now / 90) * 0.08 : 1);
      ctx.font = `${size}px serif`;
      ctx.textAlign = 'center';
      ctx.fillText(r.emoji, x, y);
    }
    ctx.restore();
  }
}

/* ──────────────────────────── record screen ───────────────────────────── */

let recStage = null;
let media = { recorder: null, chunks: [], stream: null, mime: '', startedAt: 0, elapsed: 0 };
let draft = null;

function pickMime() {
  // Safari records audio/mp4; Chrome prefers webm. mp4 first, because an
  // iPhone cannot play back a webm/opus file that Android recorded.
  const want = ['audio/mp4', 'audio/mpeg', 'audio/webm;codecs=opus', 'audio/webm'];
  return want.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}

function openRecord() {
  show('record');
  if (!recStage) {
    recStage = new Stage($('#stage-record'), 132);
    $('#stage-record').addEventListener('pointerdown', (e) => {
      if (!media.recorder || media.recorder.state !== 'recording') {
        $('#rec-hint').classList.remove('hidden');
        return;
      }
      recStage.plantAt(e.clientX, e.clientY, Date.now() - media.startedAt);
      $('#rec-count').textContent = `${recStage.plants.length} planted`;
    });
  }
  recStage.plants = [];
  recStage.reactions = [];
  recStage.resize();
  $('#rec-count').textContent = '0 planted';
  $('#rec-time').textContent = '0:00';
  $('#rec-hint').classList.remove('hidden');
  $('#rec-btn').textContent = 'hold to yap';
  $('#rec-btn').classList.remove('live');
}

async function startRecording() {
  try {
    media.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    $('#rec-hint').classList.remove('hidden');
    $('#rec-hint').innerHTML = '<p class="big">no mic 😐</p><p class="small dim">allow microphone access, and make sure you opened this over https or localhost.</p>';
    return;
  }
  media.mime = pickMime();
  media.chunks = [];
  media.recorder = new MediaRecorder(media.stream, media.mime ? { mimeType: media.mime } : {});
  media.recorder.ondataavailable = (e) => { if (e.data.size) media.chunks.push(e.data); };
  media.recorder.onstop = finishRecording;
  media.recorder.start(1000);
  media.startedAt = Date.now();
  $('#rec-hint').classList.add('hidden');
  $('#rec-btn').textContent = '🔴 stop';
  $('#rec-btn').classList.add('live');
  media.tick = setInterval(() => { $('#rec-time').textContent = fmt(Date.now() - media.startedAt); }, 250);
}

function stopRecording() {
  clearInterval(media.tick);
  media.elapsed = Date.now() - media.startedAt;
  if (media.recorder && media.recorder.state !== 'inactive') media.recorder.stop();
}

function finishRecording() {
  media.stream.getTracks().forEach((t) => t.stop());
  const type = media.recorder.mimeType || media.mime || 'audio/webm';
  draft = {
    blob: new Blob(media.chunks, { type }),
    mime: type,
    durationMs: media.elapsed,
    plants: recStage.plants.map(({ x, rows, type: t, t: ts, seed }) => ({ x, rows, type: t, t: ts, seed })),
  };
  showDone();
}

const VERDICTS = [
  'yeah that person was annoying.',
  'you, however, should probably drink some water.',
  'the garden is doing great. you are doing fine.',
  'certified valid behaviour.',
  'this one goes in the archive.',
];

function showDone() {
  show('done');
  const counts = {};
  draft.plants.forEach((p) => { counts[p.type] = (counts[p.type] || 0) + 1; });
  const perMin = draft.plants.length / Math.max(0.5, draft.durationMs / 60000);
  const chili = '🌶️'.repeat(Math.max(1, Math.min(5, Math.round(perMin / 3))));
  $('#done-stats').innerHTML = `${fmt(draft.durationMs)} of yapping<br>${draft.plants.length} plants grown`;
  $('#done-census').textContent = Object.entries(counts)
    .map(([k, n]) => `${PLANTS[k].emoji} ${n} ${PLANTS[k].label}${n > 1 ? 's' : ''}`).join('\n')
    || 'a suspiciously empty garden';
  $('#done-verdict').innerHTML = `emotional damage: ${chili}<br>${VERDICTS[Math.floor(Math.random() * VERDICTS.length)]}`;
  $('#done-err').textContent = '';
  $('#done-send').textContent = `🌱 send it to ${ME === 'her' ? 'him' : 'her'}`;
  $('#done-send').disabled = false;
}

const toBase64 = (blob) => new Promise((resolve, reject) => {
  const fr = new FileReader();
  fr.onload = () => resolve(String(fr.result).split(',')[1]);
  fr.onerror = reject;
  fr.readAsDataURL(blob);
});

async function sendDraft() {
  $('#done-send').disabled = true;
  $('#done-err').textContent = 'sending…';
  try {
    await api('/gardens', {
      method: 'POST',
      body: JSON.stringify({
        from: ME, to: other(ME), mime: draft.mime, durationMs: draft.durationMs,
        plants: draft.plants, audioBase64: await toBase64(draft.blob),
      }),
    });
    draft = null;
    openInbox();
  } catch (err) {
    $('#done-err').textContent = 'could not send: ' + err.message;
    $('#done-send').disabled = false;
  }
}

/* ──────────────────────────────── inbox ───────────────────────────────── */

let pollTimer = null;

async function openInbox() {
  show('inbox');
  $('#inbox-title').textContent = ME === 'her' ? 'your gardens' : 'her gardens';
  await refreshInbox();
  clearInterval(pollTimer);
  pollTimer = setInterval(() => { if (!$('#s-inbox').classList.contains('hidden')) refreshInbox(); }, 12000);
}

async function refreshInbox() {
  let gardens = [];
  try { ({ gardens } = await api('/gardens?who=' + ME)); } catch (err) { /* offline: keep what's there */ }
  const list = $('#inbox-list');
  if (!gardens.length) {
    list.innerHTML = '<p class="small dim">nothing here yet. go yap about something.</p>';
    return;
  }
  list.innerHTML = '';
  for (const g of gardens) {
    const mine = g.from === ME;
    const unread = mine ? (g.reactions.length && !g.reactionsSeenAt) : !g.seenAt;
    const el = document.createElement('div');
    el.className = 'card' + (unread ? ' unread' : '');
    const when = new Date(g.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    el.innerHTML = `<div>
        <div class="title">${mine ? 'you yapped' : 'she yapped'} ${fmt(g.durationMs)}</div>
        <div class="sub">${when} · ${g.plants.length} plants · ${g.reactions.length} reactions${unread ? ' · NEW' : ''}</div>
      </div><div class="grow">${mine ? '🌷' : '🎙️'}</div>`;
    el.onclick = () => openGarden(g.id);
    list.appendChild(el);
  }
}

/* ───────────────────────── garden playback + reactions ─────────────────── */

const DECK = [
  ['🥺', '🫂', '❤️', '😭', '🫡'],
  ['👁️👄👁️', '💀', '🚨', '🤨', '😦'],
  ['😡', '🔨', '🔥', '⚔️', '🗡️'],
  ['🦆', '🦝', '🍞', '🐌', '🧍'],
  ['valid.', 'I would also crash out.', 'girl stand UP', 'this is crazy.', 'you are so right.'],
];

let playStage = null;
let current = null;
let picked = null;

async function openGarden(id) {
  const { garden } = await api('/gardens/' + id);
  current = garden;
  picked = null;
  show('garden');
  if (!playStage) {
    playStage = new Stage($('#stage-play'), 168);
    $('#stage-play').addEventListener('pointerdown', onStageTapReact);
  }
  playStage.resize();
  playStage.setGarden(garden);

  const audio = $('#g-audio');
  audio.src = '/api/audio/' + id;
  audio.currentTime = 0;
  $('#g-play').textContent = '▶';
  $('#g-meta').textContent = `${garden.from === ME ? 'you' : 'her'} · ${fmt(garden.durationMs)} · ${garden.plants.length}🌱`;
  $('#g-time').textContent = '0:00';
  $('#g-fill').style.width = '0%';
  renderTicks();

  const amRecipient = garden.to === ME;
  $('#g-deck').classList.toggle('hidden', !amRecipient);
  $('#g-deckhint').textContent = amRecipient
    ? 'pick a sticker, then tap the garden to stamp it at that moment'
    : `${garden.reactions.length} reaction${garden.reactions.length === 1 ? '' : 's'} — press play to watch them land`;
  if (amRecipient) buildDeck();

  api(`/gardens/${id}/seen`, { method: 'POST', body: JSON.stringify({ which: amRecipient ? 'recipient' : 'author' }) }).catch(() => {});
}

function buildDeck() {
  const deck = $('#g-deck');
  deck.innerHTML = '';
  for (const group of DECK) {
    for (const item of group) {
      const b = document.createElement('button');
      const isText = item.length > 3 && !/\p{Extended_Pictographic}/u.test(item);
      b.className = isText ? 'txt' : '';
      b.textContent = item;
      b.onclick = () => {
        picked = { emoji: item, kind: isText ? 'text' : 'emoji' };
        deck.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        $('#g-deckhint').textContent = 'now tap the garden 👆';
      };
      deck.appendChild(b);
    }
  }
}

async function onStageTapReact(e) {
  if (!current || current.to !== ME) return;
  if (!picked) { $('#g-deckhint').textContent = 'pick a sticker first 👇'; return; }
  const rect = $('#stage-play').getBoundingClientRect();
  const audio = $('#g-audio');
  const r = {
    ...picked,
    t: Math.round(audio.currentTime * 1000),
    x: (e.clientX - rect.left) / rect.width,
    y: (e.clientY - rect.top) / rect.height,
    from: ME,
  };
  const local = { ...r, _t0: performance.now() };
  playStage.reactions.push(local);
  current.reactions.push(local);
  renderTicks();
  try { await api(`/gardens/${current.id}/reactions`, { method: 'POST', body: JSON.stringify(r) }); }
  catch (err) { $('#g-deckhint').textContent = 'reaction did not save 😔'; }
}

function renderTicks() {
  const total = Math.max(1, current.durationMs);
  $('#g-ticks').innerHTML = [
    ...current.plants.map((p) => `<i style="left:${(p.t / total) * 100}%"></i>`),
    ...current.reactions.map((r) => `<i class="react" style="left:${(r.t / total) * 100}%"></i>`),
  ].join('');
}

function wirePlayer() {
  const audio = $('#g-audio');
  $('#g-play').onclick = () => (audio.paused ? audio.play() : audio.pause());
  audio.onplay = () => { $('#g-play').textContent = '❚❚'; playStage.mode = 'timed'; };
  audio.onpause = () => { $('#g-play').textContent = '▶'; };
  audio.onended = () => { $('#g-play').textContent = '↻'; playStage.revealAll(); };
  // Android records webm/opus, which some iPhones refuse to decode. Rather than
  // a silent dead play button, hand over the file.
  audio.onerror = () => {
    if (!current) return;
    $('#g-deckhint').innerHTML = `this browser won't play that recording — <a href="/api/audio/${current.id}" download>download it instead</a>`;
  };
  audio.ontimeupdate = () => {
    const ms = audio.currentTime * 1000;
    const total = Math.max(1, current ? current.durationMs : 1);
    $('#g-time').textContent = fmt(ms);
    $('#g-fill').style.width = Math.min(100, (ms / total) * 100) + '%';
    if (playStage.mode === 'timed') playStage.time = ms;
  };
  $('#g-track').onclick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ms = ((e.clientX - rect.left) / rect.width) * Math.max(1, current.durationMs);
    try { audio.currentTime = ms / 1000; } catch (_) {}
    playStage.mode = 'timed';
    playStage.seek(ms);
  };
}

/* ──────────────────────────────── boot ────────────────────────────────── */

function setMe(who) {
  ME = who;
  localStorage.setItem('yg.me', who);
  openInbox();
}

async function boot() {
  wirePlayer();

  $('#gate-go').onclick = async () => {
    PASS = $('#gate-input').value.trim();
    try {
      await api('/gardens?who=her');
      localStorage.setItem('yg.pass', PASS);
      ME ? openInbox() : show('pick');
    } catch (err) { $('#gate-err').textContent = 'nope, try again'; }
  };
  document.querySelectorAll('.pick').forEach((b) => { b.onclick = () => setMe(b.dataset.me); });
  $('#inbox-new').onclick = openRecord;
  $('#inbox-switch').onclick = () => { localStorage.removeItem('yg.me'); ME = ''; show('pick'); };
  $('#rec-back').onclick = () => { if (media.recorder && media.recorder.state === 'recording') stopRecording(); else openInbox(); };
  $('#rec-btn').onclick = () => {
    if (media.recorder && media.recorder.state === 'recording') stopRecording();
    else startRecording();
  };
  $('#done-send').onclick = sendDraft;
  $('#done-trash').onclick = () => { draft = null; openInbox(); };
  $('#g-back').onclick = () => { $('#g-audio').pause(); openInbox(); };

  const { needsPass } = await api('/config').catch(() => ({ needsPass: false }));
  if (needsPass) {
    try { await api('/gardens?who=her'); } catch (err) { return show('gate'); }
  }
  ME ? openInbox() : show('pick');
}

boot();
