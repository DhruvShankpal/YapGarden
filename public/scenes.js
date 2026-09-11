// Backgrounds. Each scene paints the sky and the ground behind the garden.
// Everything is drawn in chunky bands so it stays in the same pixel world as
// the plants — no image files needed. Scenes that name an `image` instead are
// user-supplied art from assets.js.

const SCENES = {
  midnight: {
    label: 'midnight', soil: '#2a1d14', soilTop: '#3b2a1c', stars: true,
    sky: ['#07060b'],
  },
  dusk: {
    label: 'desert dusk', soil: '#8a5a3b', soilTop: '#a06f49', stars: true,
    sky: ['#1b2a5e', '#2d3a72', '#4a4380', '#6b4a7e', '#95527a', '#c4646f', '#e07f63', '#f0a072'],
    sun: { y: 0.78, r: 46, core: '#fff3c4', glow: '#ffb37a' },
    mesas: true,
  },
  lake: {
    label: 'lake sunset', soil: '#3a4a2a', soilTop: '#4d6136', stars: true,
    sky: ['#4a4a8c', '#6a5a9a', '#8f6a94', '#b87f83', '#d99a6c', '#efb977', '#f7d08a'],
    sun: { y: 0.72, r: 38, core: '#fff6d0', glow: '#f2b25c' },
    water: '#6b7fae',
  },
  blossom: {
    label: 'blossom', soil: '#6b7f4a', soilTop: '#86994f', stars: false,
    sky: ['#8fd3f4', '#a5dcf7', '#bde6fa', '#d5eefc'],
    canopy: ['#ff9ecb', '#ff7fb8', '#ffc2dd'],
  },
  forest: {
    label: 'deep forest', soil: '#2f3a1e', soilTop: '#41522a', stars: false,
    sky: ['#0d1a10', '#122417', '#183020', '#1e3b26'],
    canopy: ['#1c3a22', '#26502e', '#2f6236'],
    fireflies: true,
  },
};

// Bands are painted as solid rows so the sky reads as pixel art, not a gradient.
function paintScene(ctx, key, w, h, groundY, stars, now, imageCache) {
  const custom = (window.YAP_ASSETS && window.YAP_ASSETS.backgrounds || []).find((b) => b.id === key);
  if (custom) return paintImage(ctx, custom, w, h, groundY, imageCache);

  const s = SCENES[key] || SCENES.midnight;
  const band = Math.max(4, Math.round(groundY / s.sky.length / 6) * 6);

  // sky
  for (let i = 0; i < s.sky.length; i++) {
    const top = Math.round((groundY / s.sky.length) * i);
    const bottom = Math.round((groundY / s.sky.length) * (i + 1));
    ctx.fillStyle = s.sky[i];
    ctx.fillRect(0, top, w, bottom - top + 1);
  }
  // dithered seams between bands, so the steps read as deliberate
  if (s.sky.length > 1) {
    for (let i = 1; i < s.sky.length; i++) {
      const y = Math.round((groundY / s.sky.length) * i);
      ctx.fillStyle = s.sky[i - 1];
      for (let x = 0; x < w; x += 12) ctx.fillRect(x, y, 6, 6);
    }
  }

  if (s.stars && stars) {
    for (const st of stars) {
      if (st.y * groundY > groundY * 0.72) continue;
      ctx.fillStyle = `rgba(255,251,235,${st.a})`;
      ctx.fillRect(Math.round(st.x * w), Math.round(st.y * groundY), 2, 2);
    }
  }

  if (s.sun) {
    const cx = Math.round(w * 0.5), cy = Math.round(groundY * s.sun.y), r = s.sun.r;
    ctx.fillStyle = s.sun.glow;
    ctx.globalAlpha = 0.35;
    pixelDisc(ctx, cx, cy, r + 16);
    ctx.globalAlpha = 1;
    ctx.fillStyle = s.sun.core;
    pixelDisc(ctx, cx, cy, r);
  }

  if (s.water) {
    const top = Math.round(groundY * 0.86);
    ctx.fillStyle = s.water;
    ctx.fillRect(0, top, w, groundY - top);
    ctx.fillStyle = 'rgba(255,240,200,.35)';   // sun trail on the water
    for (let y = top; y < groundY; y += 6) {
      const wobble = Math.sin((y + now / 600) * 0.6) * 10;
      ctx.fillRect(Math.round(w * 0.5 - 16 + wobble), y, 32, 3);
    }
  }

  if (s.mesas) {
    ctx.fillStyle = '#5e3324';
    mesa(ctx, Math.round(w * 0.12), groundY, 74, 108);
    mesa(ctx, Math.round(w * 0.82), groundY, 58, 74);
  }

  if (s.canopy) {
    // leafy blobs hanging from the top edge
    for (let i = 0; i < s.canopy.length; i++) {
      ctx.fillStyle = s.canopy[i];
      const rows = 3 + i * 2;
      for (let bx = -20; bx < w + 20; bx += 26) {
        const wobble = ((bx * 7 + i * 13) % 5) * 6;
        ctx.fillRect(bx, 0, 26, 26 + wobble + rows * 6);
      }
    }
  }

  if (s.fireflies) {
    for (let i = 0; i < 14; i++) {
      const fx = ((i * 97) % 100) / 100 * w;
      const fy = groundY * (0.35 + ((i * 37) % 50) / 100);
      const blink = (Math.sin(now / 700 + i) + 1) / 2;
      ctx.fillStyle = `rgba(226,255,150,${0.15 + blink * 0.7})`;
      ctx.fillRect(Math.round(fx), Math.round(fy + Math.sin(now / 1400 + i) * 10), 3, 3);
    }
  }

  ctx.fillStyle = s.soil;
  ctx.fillRect(0, groundY, w, h - groundY);
  ctx.fillStyle = s.soilTop;
  for (let x = 0; x < w; x += 12) ctx.fillRect(x, groundY, 6, 6);
}

// A disc made of whole pixels, drawn as rows — no antialiased circle.
function pixelDisc(ctx, cx, cy, r) {
  const px = 4;
  for (let y = -r; y <= r; y += px) {
    const half = Math.round(Math.sqrt(Math.max(0, r * r - y * y)) / px) * px;
    ctx.fillRect(cx - half, cy + y, half * 2, px);
  }
}

function mesa(ctx, cx, groundY, w, h) {
  ctx.fillRect(cx - w / 2, groundY - h, w, h);
  ctx.fillRect(cx - w / 2 - 8, groundY - h * 0.45, 8, h * 0.45);
  ctx.fillRect(cx + w / 2, groundY - h * 0.6, 10, h * 0.6);
}

function paintImage(ctx, entry, w, h, groundY, cache) {
  let img = cache[entry.id];
  if (!img) {
    img = cache[entry.id] = new Image();
    img.src = entry.src;
  }
  ctx.fillStyle = entry.fallback || '#07060b';
  ctx.fillRect(0, 0, w, h);
  if (img.complete && img.naturalWidth) {
    // cover, pixel-crisp
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
    ctx.drawImage(img, Math.round((w - dw) / 2), Math.round((h - dh) / 2), Math.round(dw), Math.round(dh));
  }
  if (entry.soil !== 'none') {
    ctx.fillStyle = entry.soil || 'rgba(30,20,12,.85)';
    ctx.fillRect(0, groundY, w, h - groundY);
  }
}

function sceneList() {
  const custom = (window.YAP_ASSETS && window.YAP_ASSETS.backgrounds || [])
    .map((b) => ({ id: b.id, label: b.label || b.id }));
  return [...Object.entries(SCENES).map(([id, s]) => ({ id, label: s.label })), ...custom];
}
