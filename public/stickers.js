// Sticker images get cleaned up in the browser before they are used.
//
// The art people actually have to hand tends to be a screenshot of a pixel-art
// chart: a JPEG, on white, with a ruled grid over it. Stamped as-is that is a
// white rectangle with graph paper on it. So each image is shrunk (which blends
// the grid away), has its background cleared, and is trimmed to its content.
// Cached per id, so this happens once per sticker per page load.

const _stickerCache = {};
const MAX_EDGE = 96;   // plenty for a sticker drawn ~42px across

function getSticker(id) {
  if (_stickerCache[id] !== undefined) return _stickerCache[id];
  const meta = (window.YAP_ASSETS.stickers || []).find((s) => s.id === id);
  if (!meta) return (_stickerCache[id] = null);

  _stickerCache[id] = null;   // not ready yet; draw nothing until it is
  const img = new Image();
  img.onload = () => { try { _stickerCache[id] = cleanUp(img, meta); } catch (e) { _stickerCache[id] = null; } };
  img.onerror = () => { _stickerCache[id] = null; };
  img.src = meta.src;
  return null;
}

function cleanUp(img, meta) {
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;   // averages the ruled grid into its neighbours
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  if (meta.keepBackground) return c;

  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  // Light and near-colourless: the white page and the grey rulings both. The
  // threshold has to reach the rulings, because the outermost ring of these
  // screenshots is usually a ruling — too strict and every seed fails and
  // nothing is removed at all.
  const paper = (i) => {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    return min > 188 && max - min < 30;
  };

  // Flood from the edges only. Pale colours *inside* the drawing survive,
  // because the outline stops the fill from reaching them.
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x, x + (h - 1) * w); }
  for (let y = 0; y < h; y++) { stack.push(y * w, w - 1 + y * w); }
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    if (!paper(i)) continue;
    px[i + 3] = 0;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
  // If that ate nearly everything, the picture was not on a page after all.
  let clearedCount = 0;
  for (let p = 0; p < w * h; p++) if (px[p * 4 + 3] === 0) clearedCount++;
  if (clearedCount > w * h * 0.93) return c;
  ctx.putImageData(data, 0, 0);

  // trim to what is left
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (px[(y * w + x) * 4 + 3] > 8) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < x0 || y1 < y0) return c;
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}
