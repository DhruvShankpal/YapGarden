// The mark: a cassette with a flower growing out of it. Both halves of what
// the app is, in one shape. Drawn rather than shipped as an image so it stays
// crisp at any size and picks up whichever tape colour is in use.

function drawLogo(ctx, w, h, now, tapeKey) {
  const t = (typeof TAPES !== 'undefined' && TAPES[tapeKey]) || { shell: '#6b5646', shellHi: '#8a7057', shellLo: '#4a3a2e', card: '#efe3cf' };
  const px = Math.max(3, Math.floor(Math.min(w / 30, h / 30)));
  const cx = Math.round(w / 2);
  const baseY = Math.round(h - px * 3);

  // the flower, swaying, growing out of the reel window
  const sway = Math.sin(now / 900) * px * 0.6;
  const stemTop = baseY - px * 20;
  ctx.fillStyle = '#2f6b24';
  for (let y = 0; y < 14; y++) {
    const yy = baseY - px * 8 - y * px;
    const dx = Math.round(Math.sin(y * 0.28 + now / 900) * px * 0.5);
    ctx.fillRect(cx - px + dx, yy, px * 2, px);
  }
  ctx.fillStyle = '#6fcf52';
  ctx.fillRect(cx - px * 4 + Math.round(sway * 0.4), baseY - px * 14, px * 3, px);
  ctx.fillRect(cx + px * 2 + Math.round(sway * 0.4), baseY - px * 17, px * 3, px);

  const fx = cx + Math.round(sway), fy = stemTop + px * 2;
  const petal = '#ff7eb6', petalLo = '#d94f93';
  ctx.fillStyle = petalLo;
  ctx.fillRect(fx - px * 3, fy - px * 3, px * 6, px * 5);
  ctx.fillStyle = petal;
  ctx.fillRect(fx - px * 2, fy - px * 3, px * 4, px * 4);
  ctx.fillStyle = '#ffd93d';
  ctx.fillRect(fx - px, fy - px, px * 2, px * 2);

  // the cassette it grows out of
  const bw = px * 20, bh = px * 11;
  const bx = cx - bw / 2, by = baseY - bh;
  ctx.fillStyle = t.shellLo; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = t.shell;   ctx.fillRect(bx + px, by + px, bw - px * 2, bh - px * 2);
  ctx.fillStyle = t.shellHi; ctx.fillRect(bx + px, by + px, bw - px * 2, px);
  ctx.fillStyle = t.card;    ctx.fillRect(bx + px * 2, by + px * 2, bw - px * 4, px * 3);
  ctx.fillStyle = '#1b1622'; ctx.fillRect(bx + px * 3, by + px * 6, bw - px * 6, px * 4);

  const spin = now / 420;
  for (const rx of [bx + px * 6, bx + bw - px * 6]) {
    ctx.fillStyle = t.shellHi;
    ctx.fillRect(rx - px * 1.5, by + px * 7, px * 3, px * 2);
    ctx.save();
    ctx.translate(rx, by + px * 8);
    ctx.rotate(spin);
    ctx.fillStyle = t.card;
    for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillRect(-px * 0.4, -px * 1.6, px * 0.8, px * 0.9); }
    ctx.restore();
  }
}
