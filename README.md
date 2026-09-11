# 🌱 grow it out

Yap about it. Every tap grows a flower from the ground up to wherever you tapped.
When you stop, you get a garden — and the garden goes to the one person who gets to react to it.

This is the MVP: bare mechanics, placeholder pixel art, no build step, no npm install.

## Run it

```bash
node server.js          # → http://localhost:8321
```

That's it — zero dependencies, plain Node.

Optional:

```bash
PORT=9000 GARDEN_PASS=someword node server.js
```

If 8321 is taken it walks up to the next free port and prints the one it
actually got. `GARDEN_PASS` puts a shared passcode in front of everything. Leave it unset and
anyone with the URL can open the gardens.

## The loop

1. Pick **i'm the yapper** (her) or **i'm the listener** (you). It's stored in
   localStorage; it just decides whose inbox is whose. Either side can record.
2. **+ yap** → hit the button → talk. Tap anywhere on the black screen while
   talking; a plant grows from the dirt up to your finger. Tap height decides
   how tall it gets and which plant you get — low taps give sprouts, clovers and
   mushrooms, high taps give sunflowers, roses and cacti.
3. Stop → garden census + emotional damage rating → **send it**.
4. The other person opens it, presses play, and the garden replays *in time with
   the audio* — plants pop up at the second they were planted.
5. They pick a sticker from the deck and tap the garden to stamp it at that
   moment. Ticks appear on the timeline: green for plants, pink for reactions.
6. She opens it again and sees the reactions floating in her garden. The 🦝
   walks across the ground, because of course it does.

## Files

| File | What it is |
| --- | --- |
| `server.js` | Whole backend. JSON metadata in `data/db.json`, audio blobs in `data/audio/`. Serves byte-range requests, which Safari requires for audio. |
| `public/sprites.js` | **The art.** Every plant is a grid of characters + a colour palette. This is the file to replace with cuter assets. |
| `public/app.js` | Recording, the garden canvas, playback, reactions. |
| `public/style.css` | Chunky pixel styling — hard shadows, no rounded corners. |
| `hosted/garden.html` | The same app as one self-contained page, storing gardens in a Claude artifact's database instead of the Node server. No server to run; see below. |

### Swapping in better art

`sprites.js` is the only file you need to touch. A plant is:

```js
tulip: { label: 'flower', emoji: '🌷', stem: '....gG...', leafy: true, head: [ ...rows... ] }
```

`head` is the fixed top of the plant, drawn as literal pixels. `stem` is one row
that tiles downward as far as the tap asked for, so a single sprite covers every
height. Columns 4–5 are the stem so procedural leaves attach correctly. Keep rows
9 characters wide, add colours to `PAL`, and the rest of the app doesn't change.

## Putting it on the web (GitHub Pages + Supabase)

GitHub Pages serves static files, so it can host the front-end but cannot store
audio. Supabase's free tier covers the rest: Postgres for the gardens and a
private bucket for the recordings. Together they give you a permanent HTTPS
link that works on any phone, with no server of your own to run.

Setup, once:

1. **Make a Supabase project** at supabase.com (free, no card).
2. **Run the schema.** SQL editor → paste all of `supabase/setup.sql` → Run.
   Edit the two emails at the bottom first: those, and only those, can read
   or write anything.
3. **Paste your keys** into `public/config.js` — `supabaseUrl` and
   `supabaseAnonKey` from Settings → Data API. Both are safe to commit: the
   anon key is meant to be public, and row-level security is what actually
   guards the data.
4. **Allow the redirect.** Authentication → URL Configuration → add your Pages
   URL (`https://<you>.github.io/YapGarden/`) to Redirect URLs, or the sign-in
   link will bounce you somewhere else.
5. **Switch Pages on.** Repo Settings -> Pages -> Source: **GitHub Actions**.
   This one is manual: the workflow token is not permitted to create the Pages
   site, so the deploy fails with "Create Pages site failed" until you do it.
6. **Push.** The workflow in `.github/workflows/pages.yml` then deploys
   `public/` on every push to `main`.

Signing in is a magic link: type your email, tap the link in the message **on
the same device**. No passwords.

To go back to the local server, blank out the two values in `config.js` — the
same front-end then talks to `server.js` again.

## Phones

It's a web app, so Samsung and iPhone both just open the URL — no app store, no
matching devices. Add to home screen and the manifest makes it open full-screen
like an app.

Two real constraints:

- **Microphone needs HTTPS** (or `localhost`). Over plain `http://192.168.x.x`
  the mic will be blocked. For testing on phones, run the server and put a tunnel
  in front of it (`cloudflared tunnel --url http://localhost:8321` or ngrok).
- **Audio codecs differ.** The recorder asks for `audio/mp4` first because an
  iPhone can't reliably decode the `audio/webm` Android would otherwise produce.
  If a recording won't play, the player offers a download link instead of dying
  silently. If this turns out to bite in practice, the fix is transcoding to mp3
  server-side.

## What this MVP deliberately doesn't do

- **No real accounts.** "who's this?" is a localStorage toggle, and `GARDEN_PASS`
  is one shared password. Fine for two people and a private URL; not fine for
  anything public.
- **No notifications.** The inbox polls every 12 seconds and marks new items with
  a pink border.
- **No hosting story.** `data/` is local disk — on an ephemeral host (Render free
  tier, Fly without a volume) the gardens vanish on redeploy. Attach a persistent
  volume and point `DATA_DIR` at it.
- Reaction timeline view, GIFs, garden history/search, reply-with-audio, and the
  fancier reaction effects (fire spreading, two flowers growing together) are V2.

## The hosted single-file version

`hosted/garden.html` is the whole app in one file. Instead of talking to
`server.js` it uses a Claude artifact's own database for gardens and reactions
and its asset store for the audio, so there is nothing to run and it is served
over HTTPS (which the microphone requires).

Two limits that do not apply to the Node version:

- **Only editors can record.** The asset store is writer-only, so a view-only
  visitor can listen and react but cannot upload audio.
- **No sign-in.** The page cannot tell who is viewing, so "who's this?" stays a
  manual toggle.

For two people actually using this, the Node version behind a tunnel is the
better answer — no access rules in the way.
