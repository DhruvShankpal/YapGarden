// The transport control: a cassette you tap to start and stop. Used for both
// recording and playback — the reels turn while it is running, and the tape
// winds from the left spool to the right as it goes.

const TAPES = {
  sepia:  { label: 'sepia',  shell: '#6b5646', shellHi: '#8a7057', shellLo: '#4a3a2e', card: '#efe3cf', stripe: ['#c2a17a', '#8a7057'] },
  frost:  { label: 'frost',  shell: '#bcd4ef', shellHi: '#dcebfb', shellLo: '#8fb0d4', card: '#ffffff', stripe: ['#ffc2dd', '#a9e5e0'] },
  ember:  { label: 'ember',  shell: '#e8763a', shellHi: '#f79a63', shellLo: '#b4501f', card: '#ffe9d2', stripe: ['#ffb26b', '#c9421f'] },
  navy:   { label: 'navy',   shell: '#2d5375', shellHi: '#41729b', shellLo: '#1b3550', card: '#dbe7f2', stripe: ['#6fa8cf', '#20405e'] },
  lagoon: { label: 'lagoon', shell: '#3fb3a5', shellHi: '#63d6c6', shellLo: '#25806f', card: '#e0fbf4', stripe: ['#8ef0dd', '#1f6f63'] },
  amber:  { label: 'amber',  shell: '#f0a93c', shellHi: '#ffc76a', shellLo: '#b8781c', card: '#fff3d6', stripe: ['#ffd98a', '#c2701a'] },
  orchid: { label: 'orchid', shell: '#b8479b', shellHi: '#d970bd', shellLo: '#7e2b6a', card: '#fbe3f5', stripe: ['#f0a2dc', '#7a2665'] },
  lilac:  { label: 'lilac',  shell: '#c7a9ee', shellHi: '#e2cffb', shellLo: '#9575c4', card: '#f6f0ff', stripe: ['#b7e3f5', '#8ad2a8'] },
};

class Cassette {
  constructor(canvas, onToggle) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.tape = 'sepia';
    this.running = false;
    this.progress = 0;      // 0..1, how far the tape has wound
    this.title = '';
    this.spin = 0;
    this.last = performance.now();
    canvas.addEventListener('click', () => onToggle && onToggle());
    canvas.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle && onToggle(); }
    });
    this.resize();
    addEventListener('resize', () => this.resize());
    const loop = () => { this.draw(); requestAnimationFrame(loop); };
    loop();
  }

  resize() {
    const dpr = Math.min(3, devicePixelRatio || 1);
    this.w = this.c.clientWidth;
    this.h = this.c.clientHeight;
    this.c.width = Math.round(this.w * dpr);
    this.c.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  set(state) { Object.assign(this, state); }

  draw() {
    const now = performance.now();
    const dt = Math.min(64, now - this.last);
    this.last = now;
    if (this.running) this.spin += dt * 0.004;

    const { ctx, w, h } = this;
    const t = TAPES[this.tape] || TAPES.sepia;
    const px = Math.max(3, Math.round(Math.min(w / 66, h / 42)));
    const bw = px * 62, bh = px * 38;
    const x0 = Math.round((w - bw) / 2), y0 = Math.round((h - bh) / 2);

    ctx.clearRect(0, 0, w, h);

    // shell
    ctx.fillStyle = t.shellLo; ctx.fillRect(x0, y0, bw, bh);
    ctx.fillStyle = t.shell;   ctx.fillRect(x0 + px, y0 + px, bw - px * 2, bh - px * 3);
    ctx.fillStyle = t.shellHi; ctx.fillRect(x0 + px, y0 + px, bw - px * 2, px);      // top highlight
    // corner screws
    ctx.fillStyle = t.shellLo;
    for (const [sx, sy] of [[2, 2], [58, 2], [2, 33], [58, 33]]) ctx.fillRect(x0 + px * sx, y0 + px * sy, px * 2, px * 2);

    // paper label with its stripes
    const lx = x0 + px * 4, ly = y0 + px * 4, lw = px * 54, lh = px * 12;
    ctx.fillStyle = t.card; ctx.fillRect(lx, ly, lw, lh);
    ctx.fillStyle = t.stripe[0]; ctx.fillRect(lx, ly, lw, px * 2);
    ctx.fillStyle = t.stripe[1]; ctx.fillRect(lx, ly + px * 2, lw, px);
    if (this.title) {
      ctx.fillStyle = '#2b2536';
      ctx.font = `${Math.max(8, px * 2.2)}px 'Press Start 2P', monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.title, lx + px * 2, ly + px * 8);
    }

    // window + reels
    const winY = y0 + px * 18, winH = px * 12;
    ctx.fillStyle = t.shellLo; ctx.fillRect(lx, winY, lw, winH);
    ctx.fillStyle = '#1b1622'; ctx.fillRect(lx + px, winY + px, lw - px * 2, winH - px * 2);

    const cy = winY + winH / 2;
    const supply = 1 - this.progress;
    this.reel(ctx, lx + px * 12, cy, px, 4 + supply * 4, t, this.spin);
    this.reel(ctx, lx + px * 42, cy, px, 4 + this.progress * 4, t, this.spin);
    // tape stretched between the spools
    ctx.fillStyle = '#3a2f26';
    ctx.fillRect(lx + px * 12, cy - px, px * 30, px * 2);

    // bottom lip
    ctx.fillStyle = t.shellLo;
    ctx.fillRect(x0 + px * 8, y0 + px * 32, bw - px * 16, px * 4);
    ctx.fillStyle = '#1b1622';
    for (const hx of [14, 22, 38, 46]) ctx.fillRect(x0 + px * hx, y0 + px * 33, px * 2, px * 2);

    // running light
    ctx.fillStyle = this.running ? '#ff5b5b' : t.shellLo;
    ctx.fillRect(x0 + px * 4, y0 + px * 32, px * 2, px * 2);
  }

  // A hub with teeth, plus a spool of tape whose thickness tracks progress.
  reel(ctx, cx, cy, px, spoolPx, t, angle) {
    ctx.fillStyle = '#241d17';
    discPx(ctx, cx, cy, px * spoolPx, px);
    ctx.fillStyle = t.shellHi;
    discPx(ctx, cx, cy, px * 3.2, px);
    ctx.fillStyle = '#3a3a44';
    discPx(ctx, cx, cy, px * 2.2, px);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = t.card;
    for (let i = 0; i < 6; i++) {           // six teeth, like a real hub
      ctx.rotate(Math.PI / 3);
      ctx.fillRect(-px * 0.5, -px * 2.4, px, px * 1.2);
    }
    ctx.restore();
    ctx.fillStyle = '#15121c';
    discPx(ctx, cx, cy, px * 0.9, px);
  }
}

function discPx(ctx, cx, cy, r, px) {
  for (let y = -r; y <= r; y += px) {
    const half = Math.sqrt(Math.max(0, r * r - y * y));
    ctx.fillRect(Math.round(cx - half), Math.round(cy + y), Math.round(half * 2), px);
  }
}
