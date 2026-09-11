// Placeholder pixel art. Every plant is a tiny char grid, 9 sprite-pixels wide,
// drawn as literal squares on the canvas — swap these grids for nicer assets
// later and nothing else has to change.
//
// Each plant has a `head` (the top, fixed) and a `stem` row that tiles
// downward, so one sprite can grow to whatever height the tap asks for.
// The stem always lives in columns 4-5 so leaves can be bolted on procedurally.

const PAL = {
  G: '#4e9f3d', g: '#2f6b24', L: '#6fcf52',          // stem + leaves
  P: '#ff7eb6', p: '#d94f93',                         // tulip pink
  R: '#ff4d4d', r: '#b32121',                         // rose red
  Y: '#ffd93d', y: '#e6a700', B: '#6b4423',           // sunflower
  C: '#e24b3b', W: '#f4e9d8', w: '#ffffff',           // mushroom
  T: '#3fa66a', t: '#2e7d51', S: '#d8f3a3',           // cactus
};

const STEM = '....gG...';
const LEAF_L = '.LLLgG...';
const LEAF_R = '....gGLLL';

const PLANTS = {
  sprout: { label: 'sprout', emoji: '🌱', stem: STEM, leafy: true, head: [
    '..LL..LL.',
    '...LgGL..',
    '....gG...',
    '....gG...',
  ]},
  clover: { label: 'clover', emoji: '☘️', stem: STEM, leafy: true, head: [
    '..gg..gg.',
    '..gggggg.',
    '...gggg..',
    '....gG...',
    '....gG...',
  ]},
  mushroom: { label: 'mushroom', emoji: '🍄', stem: '...WWWW..', leafy: false, head: [
    '..CCCCCC.',
    '.CCwCCwCC',
    '.CCCCCCCC',
    '...WWWW..',
    '...WWWW..',
    '..WWWWWW.',
  ]},
  tulip: { label: 'flower', emoji: '🌷', stem: STEM, leafy: true, head: [
    '...pppp..',
    '..pPPPPp.',
    '..pPPPPp.',
    '...pPPp..',
    '....gG...',
    '..L.gG.L.',
    '....gG...',
  ]},
  weed: { label: 'suspicious weed', emoji: '🌿', stem: STEM, leafy: true, head: [
    '.g..gG..g',
    '..g.gG.g.',
    '...ggGg..',
    '....gG...',
    '...LgG...',
    '....gGL..',
    '....gG...',
  ]},
  rose: { label: 'rose', emoji: '🌹', stem: STEM, leafy: true, head: [
    '...RRRR..',
    '..RrRRrR.',
    '..RRrrRR.',
    '...RRRR..',
    '....gG...',
    '...LgGL..',
    '....gG...',
    '....gG...',
  ]},
  sunflower: { label: 'sunflower', emoji: '🌻', stem: STEM, leafy: true, head: [
    '...YYYY..',
    '..YyYYyY.',
    '.YyBBBBy.',
    '.YYBBBBY.',
    '..YyYYyY.',
    '...YYYY..',
    '....gG...',
    '..L.gG.L.',
    '....gG...',
  ]},
  cactus: { label: 'cactus', emoji: '🌵', stem: '...tTTT..', leafy: false, arm: '.T.tTTT.T', head: [
    '...TTTT..',
    '.T.TTTT.T',
    '.T.TTTT.T',
    '.TTTTTTTT',
    '.T.TTTT.T',
    '...TTTT..',
    '...TSTT..',
    '...TTTT..',
    '...TTTT..',
  ]},
};

// Short taps grow short things, tall taps grow tall things.
const SHORT = ['sprout', 'clover', 'mushroom'];
const MID = ['tulip', 'weed', 'rose', 'sprout'];
const TALL = ['sunflower', 'cactus', 'tulip', 'rose', 'weed'];

function pickPlant(rows) {
  const pool = rows <= 7 ? SHORT : rows <= 12 ? MID : TALL;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Draw one plant. `rows` is total height in sprite-pixels, `grow` is 0..1 and
// reveals rows from the ground upward, so the head is the last thing to open.
function drawPlant(ctx, plant, cx, groundY, rows, px, grow) {
  const def = PLANTS[plant.type] || PLANTS.tulip;
  const total = Math.max(def.head.length, rows);
  const visible = Math.ceil(total * Math.min(1, Math.max(0, grow)));
  const left = Math.round(cx - 4.5 * px);
  // Nudge each row one pixel either way so tall stems lean and wander
  // instead of standing there like scaffolding.
  const phase = plant.seed || 0;
  const wob = (r) => Math.round(Math.sin(r * 0.26 + phase)) * px;
  const headShift = wob(def.head.length);

  for (let r = total - visible; r < total; r++) {
    let row;
    if (r < def.head.length) {
      row = def.head[r];
    } else {
      const i = r - def.head.length;                       // how far down the stem
      row = def.leafy && i % 9 === 4 ? LEAF_L
          : def.leafy && i % 9 === 8 ? LEAF_R
          : def.arm && i % 11 === 5 ? def.arm
          : def.stem;
    }
    const y = groundY - (total - r) * px;
    const dx = r < def.head.length ? headShift : wob(r);
    for (let c = 0; c < row.length; c++) {
      if (row[c] === '.') continue;
      ctx.fillStyle = PAL[row[c]] || '#fff';
      ctx.fillRect(left + dx + c * px, y, px, px);
    }
  }
}
