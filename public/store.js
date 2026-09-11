// Two backends behind one interface: Supabase (GitHub Pages, shared between
// phones) or the local Node server (`node server.js`). Which one is decided
// by whether config.js has Supabase credentials.

const cfg = window.YAP_CONFIG || {};
const useSupabase = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);

const EXT = { 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/mpeg': 'mp3', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/wav': 'wav' };
const BUCKET = 'gardens';

/* ── supabase ─────────────────────────────────────────────────────── */

let sb = null;
async function client() {
  if (sb) return sb;
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  return sb;
}

// The database speaks snake_case; the app speaks camelCase.
let myUid = null;

const fromRow = (row) => ({
  id: row.id, mine: row.author === myUid,
  createdAt: new Date(row.created_at).getTime(),
  durationMs: row.duration_ms, mime: row.mime, audioPath: row.audio_path,
  plants: row.plants || [], seenAt: row.seen_at, reactionsSeenAt: row.reactions_seen_at,
  // The list query asks for a count; a single garden carries the rows themselves.
  reactionCount: Array.isArray(row.reactions) && row.reactions.length && 'count' in row.reactions[0]
    ? row.reactions[0].count : 0,
  reactions: [],
});
const reactionFromRow = (row) => ({
  id: row.id, emoji: row.emoji, kind: row.kind, t: row.t,
  x: row.x, y: row.y, mine: row.author === myUid,
  createdAt: new Date(row.created_at).getTime(),
});

// Local mode has no accounts, so a per-device id stands in for one.
function deviceId() {
  try {
    let id = localStorage.getItem('gio.device');
    if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random())); localStorage.setItem('gio.device', id); }
    return id;
  } catch (e) { return 'device'; }
}

/* ── local node server ────────────────────────────────────────────── */

let PASS = '';
try { PASS = localStorage.getItem('yg.pass') || ''; } catch (e) {}

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(PASS ? { 'x-garden-pass': PASS } : {}), ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.status);
  return res.json();
}

const toBase64 = (blob) => new Promise((resolve, reject) => {
  const fr = new FileReader();
  fr.onload = () => resolve(String(fr.result).split(',')[1]);
  fr.onerror = reject;
  fr.readAsDataURL(blob);
});

/* ── the interface the app uses ───────────────────────────────────── */

export const Store = {
  mode: useSupabase ? 'supabase' : 'local',
  needsAuth: useSupabase,

  setPass(p) { PASS = p; try { localStorage.setItem('yg.pass', p); } catch (e) {} },

  note: '',

  async session() {
    if (!useSupabase) return { email: null };
    const s = await client();
    const { data } = await s.auth.getSession();
    myUid = data.session ? data.session.user.id : null;
    return data.session ? { email: data.session.user.email } : null;
  },

  async onAuthChange(cb) {
    if (!useSupabase) return;
    const s = await client();
    s.auth.onAuthStateChange((_e, sess) => {
      myUid = sess ? sess.user.id : null;
      cb(sess ? { email: sess.user.email } : null);
    });
  },

  async signIn(email) {
    const s = await client();
    const { error } = await s.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.origin + location.pathname },
    });
    if (error) throw new Error(error.message);
  },

  async signOut() {
    if (!useSupabase) return;
    const s = await client();
    await s.auth.signOut();
  },

  async list() {
    if (!useSupabase) {
      const { gardens } = await api('/gardens');
      const me = deviceId();
      return gardens.map((g) => ({ ...g, mine: g.author === me }));
    }
    if (!myUid) await this.session();
    const s = await client();
    const { data, error } = await s.from('gardens').select('*, reactions(count)').order('created_at', { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return data.map(fromRow);
  },

  async get(id) {
    if (!useSupabase) {
      const { garden } = await api('/gardens/' + id);
      garden.audioUrl = '/api/audio/' + id;
      garden.mine = garden.author === deviceId();
      return garden;
    }
    const s = await client();
    const [g, rs] = await Promise.all([
      s.from('gardens').select('*').eq('id', id).single(),
      s.from('reactions').select('*').eq('garden_id', id).order('t'),
    ]);
    if (g.error) throw new Error(g.error.message);
    const garden = fromRow(g.data);
    garden.reactions = (rs.data || []).map(reactionFromRow);
    const signed = await s.storage.from(BUCKET).createSignedUrl(garden.audioPath, 60 * 60);
    garden.audioUrl = signed.data ? signed.data.signedUrl : '';
    return garden;
  },

  async create(g, blob) {
    if (!useSupabase) {
      const { garden } = await api('/gardens', {
        method: 'POST',
        body: JSON.stringify({ ...g, author: deviceId(), audioBase64: await toBase64(blob) }),
      });
      return garden.id;
    }
    const s = await client();
    const id = crypto.randomUUID();
    const path = `${id}.${EXT[g.mime.split(';')[0]] || 'bin'}`;
    const up = await s.storage.from(BUCKET).upload(path, blob, { contentType: g.mime, upsert: false });
    if (up.error) throw new Error('audio upload failed: ' + up.error.message);
    const { error } = await s.from('gardens').insert({
      id, duration_ms: g.durationMs, mime: g.mime, audio_path: path, plants: g.plants,
    });
    if (error) {
      await s.storage.from(BUCKET).remove([path]);   // don't leave the audio orphaned
      throw new Error(error.message);
    }
    return id;
  },

  async react(gardenId, r) {
    if (!useSupabase) return api(`/gardens/${gardenId}/reactions`, { method: 'POST', body: JSON.stringify({ ...r, author: deviceId() }) });
    const s = await client();
    const { error } = await s.from('reactions').insert({
      garden_id: gardenId, emoji: r.emoji, kind: r.kind, t: r.t, x: r.x, y: r.y,
    });
    if (error) throw new Error(error.message);
  },

  // Delete a garden and its recording. Reactions go with it, by cascade.
  async remove(garden) {
    if (!useSupabase) return api('/gardens/' + garden.id, { method: 'DELETE' });
    const s = await client();
    const { error } = await s.from('gardens').delete().eq('id', garden.id);
    if (error) throw new Error(error.message);
    if (garden.audioPath) await s.storage.from(BUCKET).remove([garden.audioPath]);
  },

  async seen(gardenId, which) {
    if (!useSupabase) return api(`/gardens/${gardenId}/seen`, { method: 'POST', body: JSON.stringify({ which }) });
    const s = await client();
    const col = which === 'author' ? 'reactions_seen_at' : 'seen_at';
    await s.from('gardens').update({ [col]: new Date().toISOString() }).eq('id', gardenId);
  },
};
