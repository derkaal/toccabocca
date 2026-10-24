'use strict';

/* =====================================================================
   Pocket Town – a drag-and-play "digital dollhouse" for touch and mouse.
   The world is a fixed 1600x1040 stage (900px scene + 140px pocket tray)
   that is scaled to fit the screen. Everything uses pointer events, so
   fingers, touchpads and mice all behave the same.
   ===================================================================== */

const W = 1600, H = 1040, TRAY_Y = 900;
const POCKET_MAX = 12, MAX_CHARS = 14, MAX_PETS = 8, MAX_LOOSE_ITEMS = 36;
const SAVE_KEY = 'pocketTown.v1';

const SKINS = ['#ffe0cc', '#f6c9a3', '#e8b088', '#c98d5e', '#9a6640', '#6b4428'];
const HAIR_STYLES = ['short', 'long', 'bun', 'spiky', 'curly', 'pigtails', 'none'];
const HAIR_COLORS = ['#2b1b0e', '#6b3e1f', '#b97a3a', '#f2d16b', '#d9472b', '#e8e8e8', '#7b5cff', '#ff6fb5', '#2fb5a3'];
const EYE_COLORS = ['#2b2b2b', '#5c3d2e', '#1c7ed6', '#2f9e44', '#7048e8'];
const CLOTHES = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#748ffc', '#da77f2', '#f783ac', '#343a40', '#ffffff', '#8d6e63'];
const SHOES = ['#343a40', '#ffffff', '#e03131', '#1971c2', '#f08c00', '#9c36b5', '#2f9e44'];

const CATS = {
  food: ['🍎', '🍌', '🍇', '🍓', '🧀', '🥕', '🍉', '🥚', '🍗', '🥦', '🍕', '🌭', '🥪', '🍦', '🍰', '🧁', '🍩', '🍪', '🥐', '🍫', '🥞', '🍐', '🍊', '🍒', '🍑', '🌽', '🍔'],
  drink: ['☕', '🧋', '🥤', '🍵', '🧃', '🥛'],
  hat: ['🎩', '👒', '🧢', '👑', '🎓'],
  face: ['🕶️', '👓', '🥽'],
  pet: ['🐶', '🐱', '🐰', '🐹', '🐢', '🐥', '🦔'],
};
const CAT_OF = {};
for (const [cat, list] of Object.entries(CATS)) for (const em of list) CAT_OF[em] = cat;
const catOf = em => CAT_OF[em] || 'toy';
const YUCKY = ['🥦', '🌽'];

const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/* ---------------------------------------------------------------- audio */

let AC = null;
function audio() {
  if (!AC) {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (err) { return null; }
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f1, f2, dur, type = 'sine', vol = 0.15, delay = 0) {
  if (S.muted) return;
  const a = audio(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f1, t);
  o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.2, delay = 0, freq = 1000) {
  if (S.muted) return;
  const a = audio(); if (!a) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}
const SFX = {
  pop: () => tone(500, 950, 0.08, 'sine', 0.18),
  drop: () => tone(260, 140, 0.09, 'triangle', 0.14),
  lift: () => tone(420, 720, 0.09, 'sine', 0.07),
  chomp: () => { noise(0.07, 0.3, 0, 900); tone(170, 90, 0.07, 'square', 0.05); },
  yum: () => { tone(523, 523, 0.11, 'sine', 0.14); tone(659, 659, 0.11, 'sine', 0.14, 0.11); tone(784, 784, 0.2, 'sine', 0.14, 0.22); },
  giggle: () => { for (let i = 0; i < 4; i++) tone(700 + i * 70, 950 + i * 70, 0.07, 'sine', 0.1, i * 0.08); },
  yuck: () => tone(320, 110, 0.35, 'sawtooth', 0.07),
  quack: () => { tone(430, 250, 0.12, 'sawtooth', 0.1); tone(430, 250, 0.12, 'sawtooth', 0.1, 0.17); },
  splash: () => noise(0.4, 0.35, 0, 1600),
  whoosh: () => noise(0.35, 0.15, 0, 700),
  click: () => tone(1200, 800, 0.03, 'square', 0.07),
  sparkle: () => { for (let i = 0; i < 5; i++) tone(1200 + i * 200, 1500 + i * 200, 0.06, 'sine', 0.06, i * 0.05); },
  wear: () => { tone(600, 600, 0.07, 'sine', 0.12); tone(900, 900, 0.1, 'sine', 0.12, 0.07); },
};
function petSound(pet) {
  switch (pet.emoji) {
    case '🐶': tone(520, 330, 0.09, 'square', 0.07); tone(520, 330, 0.09, 'square', 0.07, 0.14); break;
    case '🐱': tone(600, 950, 0.14, 'sine', 0.12); tone(950, 520, 0.28, 'sine', 0.12, 0.14); break;
    case '🐥': for (let i = 0; i < 3; i++) tone(1800, 2400, 0.05, 'sine', 0.08, i * 0.09); break;
    default: tone(1100, 1600, 0.08, 'sine', 0.1); tone(1300, 1800, 0.08, 'sine', 0.1, 0.1);
  }
}

/* ----------------------------------------------------------- characters */

function hairBack(st, c) {
  if (st === 'long') return `<path d="M20 50 Q18 14 50 14 Q82 14 80 50 L86 106 Q50 118 14 106 Z" fill="${c}"/>`;
  if (st === 'pigtails') return `<circle cx="15" cy="58" r="13" fill="${c}"/><circle cx="85" cy="58" r="13" fill="${c}"/>`;
  if (st === 'bun') return `<circle cx="50" cy="13" r="14" fill="${c}"/>`;
  return '';
}
function hairFront(st, c) {
  switch (st) {
    case 'short': return `<path d="M19 47 Q19 15 50 15 Q81 15 81 47 Q73 30 58 32 Q50 24 42 32 Q27 30 19 47Z" fill="${c}"/>`;
    case 'long': return `<path d="M19 54 Q19 15 50 15 Q81 15 81 54 Q77 31 50 29 Q23 31 19 54Z" fill="${c}"/>`;
    case 'bun':
    case 'pigtails': return `<path d="M20 45 Q21 17 50 17 Q79 17 80 45 Q66 29 50 29 Q34 29 20 45Z" fill="${c}"/>`;
    case 'spiky': return `<path d="M19 47 L21 22 L31 30 L35 9 L46 26 L52 5 L58 26 L68 9 L70 30 L80 22 L81 47 Q66 31 50 31 Q34 31 19 47Z" fill="${c}"/>`;
    case 'curly': return [[22, 40, 10], [28, 26, 11], [40, 18, 11], [53, 15, 11], [65, 19, 11], [74, 28, 11], [79, 41, 9]]
      .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join('') +
      `<path d="M22 44 Q24 22 50 22 Q76 22 78 44 Q64 32 50 32 Q36 32 22 44Z" fill="${c}"/>`;
    default: return '';
  }
}

function charSVG(L, pose = 'stand', viewBox = '0 0 100 200', w = 120, h = 240) {
  const sit = pose === 'sit';
  const up = sit ? 26 : 0;
  const leg = (x, cx) => sit
    ? `<g class="leg"><rect x="${x}" y="170" width="15" height="22" rx="6" fill="${L.pants}"/><ellipse cx="${cx}" cy="193" rx="10.5" ry="6" fill="${L.shoes}"/></g>`
    : `<g class="leg"><rect x="${x}" y="140" width="14" height="50" rx="6" fill="${L.pants}"/><ellipse cx="${cx}" cy="192" rx="11" ry="6.5" fill="${L.shoes}"/></g>`;
  return `<svg viewBox="${viewBox}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <ellipse class="shadow" cx="50" cy="197" rx="27" ry="4.5" fill="rgba(0,0,0,.14)"/>
    <g class="legs">${leg(33, 40)}${leg(53, 60)}</g>
    <g transform="translate(0 ${up})">
      ${hairBack(L.hair, L.hairColor)}
      <g class="arm l"><rect x="17" y="94" width="13" height="46" rx="6.5" fill="${L.shirt}"/><circle cx="23.5" cy="142" r="7" fill="${L.skin}"/></g>
      <g class="arm r"><rect x="70" y="94" width="13" height="46" rx="6.5" fill="${L.shirt}"/><circle cx="76.5" cy="142" r="7" fill="${L.skin}"/></g>
      <rect x="27" y="87" width="46" height="63" rx="15" fill="${L.shirt}"/>
      <rect x="44" y="72" width="12" height="18" fill="${L.skin}"/>
      <path d="M40 88 Q50 99 60 88" fill="none" stroke="rgba(0,0,0,.14)" stroke-width="3" stroke-linecap="round"/>
      <circle cx="21" cy="51" r="6" fill="${L.skin}"/><circle cx="79" cy="51" r="6" fill="${L.skin}"/>
      <circle cx="50" cy="48" r="30" fill="${L.skin}"/>
      ${hairFront(L.hair, L.hairColor)}
      <g class="eyes"><ellipse cx="39" cy="50" rx="4.2" ry="5.6" fill="${L.eyes}"/><ellipse cx="61" cy="50" rx="4.2" ry="5.6" fill="${L.eyes}"/>
        <circle cx="40.6" cy="48" r="1.6" fill="#fff"/><circle cx="62.6" cy="48" r="1.6" fill="#fff"/></g>
      <g class="eyes-happy" fill="none" stroke="${L.eyes}" stroke-width="3" stroke-linecap="round"><path d="M34 52 Q39 45 44 52"/><path d="M56 52 Q61 45 66 52"/></g>
      <ellipse cx="31" cy="61" rx="6" ry="4" fill="#ff8fa3" opacity=".45"/><ellipse cx="69" cy="61" rx="6" ry="4" fill="#ff8fa3" opacity=".45"/>
      <path class="m-smile" d="M43 63 Q50 70 57 63" fill="none" stroke="#7a2e2e" stroke-width="3" stroke-linecap="round"/>
      <ellipse class="m-open" cx="50" cy="66" rx="7" ry="8" fill="#7a1f2b"/>
      <path class="m-chomp" d="M41 66 L59 66" stroke="#7a2e2e" stroke-width="4" stroke-linecap="round"/>
      <path class="m-grin" d="M41 62 Q50 76 59 62 Z" fill="#7a1f2b"/>
      <path class="m-yuck" d="M41 67 Q45.5 62 50 67 Q54.5 72 59 67" fill="none" stroke="#7a2e2e" stroke-width="3" stroke-linecap="round"/>
    </g>
  </svg>`;
}

function randomLook() {
  return {
    skin: pick(SKINS), hair: pick(HAIR_STYLES.slice(0, 6)), hairColor: pick(HAIR_COLORS),
    eyes: pick(EYE_COLORS), shirt: pick(CLOTHES), pants: pick(CLOTHES), shoes: pick(SHOES),
  };
}

// Points on a character in stage coordinates (character anchor = bottom centre of the feet).
function anchors(ch) {
  const sit = ch.pose === 'sit', f = ch.flip ? -1 : 1;
  return {
    mouth: { x: ch.x, y: ch.y - (sit ? 130 : 161) },
    hand: { x: ch.x + 31.8 * f, y: ch.y - (sit ? 38 : 70) },
    head: { x: ch.x, y: ch.y - (sit ? 185 : 216) },
    face: { x: ch.x, y: ch.y - (sit ? 149 : 180) },
  };
}
function onBody(ch, c) {
  return Math.abs(c.x - ch.x) < 55 && c.y < ch.y && c.y > ch.y - (ch.pose === 'sit' ? 200 : 235);
}

/* --------------------------------------------------------------- scenes */

const sky = n => n ? '#1d2b5c' : '#9fdcff';
const stars = (pts) => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff8d6"/>`).join('');
const sunOrMoon = (n, x, y, r) => n
  ? `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff3bf"/><circle cx="${x + r * 0.4}" cy="${y - r * 0.2}" r="${r * 0.85}" fill="${sky(n)}"/>`
  : `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffd43b"/>`;
const cloud = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#fff"><ellipse cx="0" cy="0" rx="50" ry="26"/><ellipse cx="40" cy="-14" rx="40" ry="30"/><ellipse cx="80" cy="0" rx="46" ry="24"/></g>`;
const trash = (x, y) => ({
  id: 'trash', x, y, w: 80, h: 100, trash: true,
  svg: () => `<rect x="8" y="22" width="64" height="76" rx="8" fill="#868e96"/>
    <rect x="20" y="34" width="6" height="54" rx="3" fill="#adb5bd"/><rect x="37" y="34" width="6" height="54" rx="3" fill="#adb5bd"/><rect x="54" y="34" width="6" height="54" rx="3" fill="#adb5bd"/>
    <g class="lid"><rect x="2" y="10" width="76" height="14" rx="6" fill="#495057"/><rect x="30" y="2" width="20" height="10" rx="4" fill="#495057"/></g>`,
  tap: (p, el) => { animate(el, 'open', 500); SFX.click(); },
});

// Tap handler for a prop that produces items.
function spawnTap(pool, from, spread = 110, anim = 'wiggle') {
  return (p, el) => {
    animate(el, anim, 650);
    const f = typeof from === 'function' ? from(p) : from;
    spawnItem(pick(pool), f.x, f.y, f.x + rand(-spread, spread));
  };
}

const SCENES = {
  home: {
    name: 'Home', icon: '🏠', color: '#ffd8a8',
    floor: { top: 640, bottom: 880 },
    surfaces: [{ x1: 955, x2: 1285, y: 450 }, { x1: 595, x2: 845, y: 350 }],
    seats: [{ id: 'sofa1', x: 480, y: 589 }, { id: 'sofa2', x: 680, y: 589 }, { id: 'stool', x: 1120, y: 689 }],
    bg: n => `
      <defs><pattern id="wp" width="90" height="90" patternUnits="userSpaceOnUse"><rect width="90" height="90" fill="#ffe6cc"/>
        <circle cx="45" cy="45" r="7" fill="#ffd3a6"/><circle cx="0" cy="0" r="7" fill="#ffd3a6"/><circle cx="90" cy="0" r="7" fill="#ffd3a6"/><circle cx="0" cy="90" r="7" fill="#ffd3a6"/><circle cx="90" cy="90" r="7" fill="#ffd3a6"/></pattern></defs>
      <rect width="1600" height="620" fill="url(#wp)"/>
      <rect y="610" width="1600" height="290" fill="#d9a06b"/>
      ${[690, 770, 850].map(y => `<rect y="${y}" width="1600" height="4" fill="#c88a55"/>`).join('')}
      <rect y="598" width="1600" height="18" fill="#fff3e3"/>
      <rect x="160" y="100" width="320" height="250" rx="14" fill="#fff"/>
      <rect x="176" y="116" width="288" height="218" rx="6" fill="${sky(n)}"/>
      ${n ? stars([[210, 150, 3], [260, 200, 2], [400, 160, 3], [430, 280, 2], [230, 290, 2]]) + sunOrMoon(n, 380, 200, 34) : sunOrMoon(n, 400, 170, 34) + cloud(220, 260, 0.8)}
      <rect x="316" y="116" width="8" height="218" fill="#fff"/><rect x="176" y="221" width="288" height="8" fill="#fff"/>
      <rect x="140" y="345" width="360" height="16" rx="8" fill="#fff3e3"/>
      <rect x="620" y="150" width="200" height="150" rx="8" fill="#a86b3c"/><rect x="632" y="162" width="176" height="126" fill="#e7f5ff"/>
      <path d="M632 288 L690 210 L730 250 L770 200 L808 288Z" fill="#69db7c"/><circle cx="780" cy="190" r="14" fill="#ffd43b"/>
      <rect x="590" y="350" width="260" height="16" rx="6" fill="#a86b3c"/>
      <ellipse cx="620" cy="790" rx="300" ry="70" fill="#8fd1b5"/><ellipse cx="620" cy="790" rx="240" ry="50" fill="none" stroke="#fff" stroke-width="6" stroke-dasharray="14 12"/>
      <rect x="370" y="430" width="420" height="150" rx="34" fill="#5c7cfa"/>
      <rect x="390" y="560" width="190" height="70" rx="18" fill="#748ffc"/><rect x="580" y="560" width="190" height="70" rx="18" fill="#748ffc"/>
      <rect x="340" y="500" width="70" height="140" rx="26" fill="#4c6ef5"/><rect x="750" y="500" width="70" height="140" rx="26" fill="#4c6ef5"/>
      <rect x="380" y="636" width="18" height="22" fill="#5c3d2e"/><rect x="762" y="636" width="18" height="22" fill="#5c3d2e"/>
      <rect x="960" y="170" width="320" height="140" rx="10" fill="#e9ecef"/><rect x="975" y="185" width="140" height="110" rx="8" fill="#f8f9fa"/><rect x="1125" y="185" width="140" height="110" rx="8" fill="#f8f9fa"/>
      <rect x="1100" y="270" width="8" height="18" rx="4" fill="#adb5bd"/><rect x="1132" y="270" width="8" height="18" rx="4" fill="#adb5bd"/>
      <rect x="960" y="455" width="320" height="170" fill="#f8f9fa"/>
      <rect x="975" y="480" width="140" height="125" rx="8" fill="#e9ecef" stroke="#ced4da" stroke-width="3"/><rect x="1125" y="480" width="140" height="125" rx="8" fill="#e9ecef" stroke="#ced4da" stroke-width="3"/>
      <rect x="1095" y="500" width="8" height="24" rx="4" fill="#adb5bd"/><rect x="1137" y="500" width="8" height="24" rx="4" fill="#adb5bd"/>
      <rect x="950" y="440" width="340" height="22" rx="6" fill="#868e96"/>
      <ellipse cx="1120" cy="660" rx="48" ry="14" fill="#ff922b"/>
      <path d="M1090 668 L1080 740 M1150 668 L1160 740 M1120 672 L1120 742" stroke="#5c3d2e" stroke-width="8" stroke-linecap="round"/>`,
    props: [
      {
        id: 'toybox', x: 80, y: 560, w: 220, h: 120,
        svg: () => `<rect x="10" y="35" width="200" height="85" rx="12" fill="#ff922b"/><rect x="10" y="62" width="200" height="12" fill="#fd7e14"/>
          <text x="110" y="110" font-size="30" text-anchor="middle">⭐</text>
          <g class="lid"><rect x="0" y="20" width="220" height="24" rx="10" fill="#ffa94d"/></g>`,
        tap: spawnTap(['🧸', '⚽', '🪀', '🎈', '🧩', '🎲', '🚗', '🎨', '📚', '🎸', '🪁', '🦖'], { x: 190, y: 560 }, 110, 'open'),
      },
      {
        id: 'lamp', x: 850, y: 290, w: 90, h: 360,
        svg: s => `${s.lampOn ? '<circle cx="45" cy="60" r="80" fill="rgba(255,224,130,.35)"/>' : ''}
          <rect x="41" y="80" width="8" height="262" fill="#495057"/><ellipse cx="45" cy="346" rx="34" ry="10" fill="#343a40"/>
          <path d="M14 92 L30 20 L60 20 L76 92 Z" fill="${s.lampOn ? '#ffe066' : '#ffd8a8'}" stroke="#f59f00" stroke-width="3"/>`,
        tap: () => { S.lampOn = !S.lampOn; SFX.click(); buildScene(); save(); },
      },
      {
        id: 'fridge', x: 1300, y: 210, w: 180, h: 420,
        svg: () => `<rect width="180" height="420" rx="18" fill="#dee2e6"/><rect x="10" y="10" width="160" height="400" rx="10" fill="#fff9db"/>
          <rect x="10" y="140" width="160" height="6" fill="#e9ecef"/><rect x="10" y="270" width="160" height="6" fill="#e9ecef"/>
          <text x="55" y="125" font-size="44" text-anchor="middle">🥛</text><text x="125" y="125" font-size="44" text-anchor="middle">🧀</text>
          <text x="60" y="255" font-size="44" text-anchor="middle">🍉</text><text x="125" y="255" font-size="44" text-anchor="middle">🥕</text>
          <text x="90" y="385" font-size="44" text-anchor="middle">🍗</text>
          <g class="door"><rect width="180" height="420" rx="18" fill="#f1f3f5" stroke="#ced4da" stroke-width="4"/>
            <line x1="4" y1="150" x2="176" y2="150" stroke="#ced4da" stroke-width="4"/>
            <rect x="146" y="50" width="12" height="70" rx="6" fill="#adb5bd"/><rect x="146" y="180" width="12" height="110" rx="6" fill="#adb5bd"/>
            <circle cx="50" cy="60" r="10" fill="#ff6b6b"/><circle cx="80" cy="90" r="10" fill="#4dabf7"/><rect x="40" y="200" width="50" height="60" rx="4" fill="#fff" transform="rotate(-6 65 230)"/></g>`,
        tap: spawnTap(['🍎', '🍌', '🍇', '🍓', '🧀', '🥕', '🍉', '🥚', '🍗', '🥦', '🍕', '🌭', '🥪', '🍦', '🥛', '🧃', '🍔', '🌽'], { x: 1390, y: 420 }, 140, 'open'),
      },
      trash(1505, 545),
    ],
  },

  cafe: {
    name: 'Café', icon: '☕', color: '#b2f2bb',
    floor: { top: 650, bottom: 880 },
    surfaces: [{ x1: 235, x2: 925, y: 452 }, { x1: 1095, x2: 1405, y: 550 }],
    seats: [{ id: 'bar1', x: 430, y: 700 }, { id: 'bar2', x: 740, y: 700 }, { id: 'ch1', x: 1020, y: 705 }, { id: 'ch2', x: 1480, y: 705 }],
    bg: n => `
      <defs><pattern id="cf" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="#fff"/><rect width="50" height="50" fill="#ffc9a3"/><rect x="50" y="50" width="50" height="50" fill="#ffc9a3"/></pattern></defs>
      <rect width="1600" height="640" fill="#d3f0e6"/>
      <rect y="400" width="1600" height="240" fill="#a7dcc9"/>
      ${Array.from({ length: 20 }, (_, i) => `<rect x="${i * 80 + 36}" y="400" width="8" height="240" fill="#96d0bb"/>`).join('')}
      <rect y="630" width="1600" height="270" fill="url(#cf)"/>
      <rect y="622" width="1600" height="14" fill="#7c5c45"/>
      <rect x="380" y="90" width="380" height="200" rx="14" fill="#5c3d2e"/><rect x="394" y="104" width="352" height="172" rx="8" fill="#2f3e46"/>
      <text x="570" y="160" font-size="44" font-weight="900" fill="#fff" text-anchor="middle" font-family="sans-serif">MENU</text>
      <text x="570" y="230" font-size="38" text-anchor="middle">☕ 🧋 🍰 🧁</text>
      <rect x="1170" y="90" width="350" height="250" rx="14" fill="#fff"/><rect x="1186" y="106" width="318" height="218" rx="6" fill="${sky(n)}"/>
      ${n ? stars([[1220, 140, 3], [1300, 200, 2], [1460, 150, 3]]) + sunOrMoon(n, 1420, 230, 30) : cloud(1230, 200, 0.8) + sunOrMoon(n, 1440, 160, 30)}
      <rect x="1341" y="106" width="8" height="218" fill="#fff"/>
      <path d="M1150 80 L1540 80 L1520 130 L1170 130 Z" fill="#ff6b6b"/>
      ${[1170, 1240, 1310, 1380, 1450].map(x => `<path d="M${x} 80 L${x + 35} 80 L${x + 35} 130 L${x} 130 Z" fill="#fff"/>`).join('')}
      ${[900, 1250, 1400].map(x => `<line x1="${x}" y1="0" x2="${x}" y2="70" stroke="#495057" stroke-width="3"/><path d="M${x - 28} 98 Q${x} 50 ${x + 28} 98 Z" fill="#ffd43b"/>${n ? `<circle cx="${x}" cy="104" r="16" fill="rgba(255,240,170,.9)"/>` : ''}`).join('')}
      <rect x="240" y="470" width="680" height="160" rx="10" fill="#c08457"/>
      ${[260, 480, 700].map(x => `<rect x="${x}" y="492" width="200" height="118" rx="10" fill="#d29a6d"/>`).join('')}
      <rect x="225" y="450" width="710" height="26" rx="8" fill="#7c4f2c"/>
      ${[430, 740].map(x => `<rect x="${x - 6}" y="676" width="12" height="70" fill="#495057"/><ellipse cx="${x}" cy="748" rx="30" ry="8" fill="#495057"/><ellipse cx="${x}" cy="671" rx="42" ry="13" fill="#e8590c"/>`).join('')}
      ${[1020, 1480].map(x => `<rect x="${x - 34}" y="560" width="68" height="120" rx="16" fill="#e8590c"/><rect x="${x - 40}" y="674" width="80" height="16" rx="6" fill="#d9480f"/><path d="M${x - 32} 690 L${x - 36} 750 M${x + 32} 690 L${x + 36} 750" stroke="#7c4f2c" stroke-width="8" stroke-linecap="round"/>`).join('')}
      <rect x="1235" y="566" width="30" height="128" fill="#7c4f2c"/><ellipse cx="1250" cy="696" rx="70" ry="12" fill="#7c4f2c"/>
      <rect x="1090" y="546" width="320" height="24" rx="10" fill="#f08c00"/>`,
    props: [
      {
        id: 'coffee', x: 290, y: 300, w: 170, h: 152,
        svg: () => `<rect x="10" y="0" width="150" height="40" rx="12" fill="#343a40"/>
          <rect x="20" y="30" width="130" height="122" rx="10" fill="#495057"/><rect x="45" y="60" width="80" height="62" rx="8" fill="#212529"/>
          <rect x="75" y="58" width="20" height="14" fill="#adb5bd"/><text x="85" y="114" font-size="34" text-anchor="middle">☕</text>
          <circle cx="138" cy="20" r="8" fill="#ff6b6b"/><circle cx="114" cy="20" r="8" fill="#51cf66"/>
          <text x="22" y="27" fill="#fff" font-size="17" font-weight="900" font-family="sans-serif">CAFÉ</text>`,
        tap: spawnTap(['☕', '🧋', '🥤', '🍵', '🧃', '🥛'], { x: 375, y: 420 }, 70),
      },
      {
        id: 'cakes', x: 600, y: 330, w: 270, h: 122,
        svg: () => `<rect x="0" y="108" width="270" height="14" rx="6" fill="#dee2e6"/>
          <text x="75" y="102" font-size="46" text-anchor="middle">🍰</text><text x="135" y="102" font-size="46" text-anchor="middle">🧁</text><text x="195" y="102" font-size="46" text-anchor="middle">🍩</text>
          <path d="M15 110 Q15 10 135 10 Q255 10 255 110 Z" fill="rgba(208,235,255,.45)" stroke="#a5d8ff" stroke-width="4"/>
          <circle cx="135" cy="8" r="9" fill="#a5d8ff"/>`,
        tap: spawnTap(['🍰', '🧁', '🍩', '🍪', '🥐', '🍫', '🍦', '🥞'], { x: 735, y: 420 }, 140),
      },
      trash(1515, 548),
    ],
  },

  park: {
    name: 'Park', icon: '🌳', color: '#c0eb75',
    floor: { top: 610, bottom: 880 },
    surfaces: [],
    seats: [{ id: 'bench1', x: 780, y: 661 }, { id: 'bench2', x: 920, y: 661 }],
    zones: [{ x1: 1080, y1: 690, x2: 1520, y2: 845, kind: 'splash' }],
    bg: n => `
      <defs><linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${n ? '#0b1640' : '#7cc8ff'}"/><stop offset="1" stop-color="${n ? '#2a3a78' : '#d6f1ff'}"/></linearGradient></defs>
      <rect width="1600" height="620" fill="url(#skyg)"/>
      ${n ? stars([[120, 80, 3], [380, 140, 2], [620, 60, 3], [860, 120, 2], [1050, 70, 3], [1200, 180, 2], [1500, 60, 3]]) + `<circle cx="1380" cy="130" r="50" fill="#fff3bf"/><circle cx="1400" cy="120" r="42" fill="#0b1640"/>`
        : `<circle cx="1400" cy="130" r="60" fill="#ffd43b"/>` + cloud(650, 120) + cloud(1000, 200, 0.7) + cloud(300, 70, 0.6)}
      <ellipse cx="300" cy="610" rx="520" ry="150" fill="#a3d977"/><ellipse cx="1250" cy="620" rx="620" ry="170" fill="#94d26a"/>
      <rect y="570" width="1600" height="330" fill="#7dc75a"/>
      <path d="M560 900 Q620 760 760 700 Q860 660 1010 680 L1010 720 Q880 710 800 750 Q690 810 700 900 Z" fill="#ead7a8"/>
      ${[[120, 820], [300, 700], [480, 860], [980, 860], [1560, 700], [60, 660], [420, 640]].map(([x, y]) => `<path d="M${x} ${y} l8 -22 l6 22 l8 -18 l4 18 Z" fill="#5fae45"/>`).join('')}
      <ellipse cx="1300" cy="768" rx="235" ry="82" fill="#4dabf7"/><ellipse cx="1300" cy="762" rx="205" ry="64" fill="#74c0fc"/>
      <ellipse cx="1180" cy="790" rx="26" ry="10" fill="#51cf66"/><ellipse cx="1420" cy="745" rx="22" ry="8" fill="#51cf66"/>
      <rect x="690" y="560" width="320" height="22" rx="8" fill="#b5651d"/><rect x="690" y="592" width="320" height="22" rx="8" fill="#b5651d"/>
      <rect x="700" y="582" width="12" height="60" fill="#8b4513"/><rect x="988" y="582" width="12" height="60" fill="#8b4513"/>
      <rect x="680" y="630" width="340" height="20" rx="8" fill="#c97a2b"/>
      <rect x="700" y="650" width="14" height="50" fill="#8b4513"/><rect x="986" y="650" width="14" height="50" fill="#8b4513"/>`,
    props: [
      {
        id: 'tree', x: 60, y: 60, w: 480, h: 580,
        svg: () => `<rect x="205" y="280" width="70" height="300" rx="20" fill="#8b5a2b"/>
          <circle cx="240" cy="190" r="150" fill="#51b364"/><circle cx="110" cy="260" r="100" fill="#46a35a"/>
          <circle cx="370" cy="260" r="110" fill="#46a35a"/><circle cx="240" cy="300" r="110" fill="#5cbf6e"/>
          ${[[150, 200], [300, 150], [360, 290], [200, 320], [100, 280], [250, 90]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="13" fill="#ff6b6b"/>`).join('')}`,
        tap: spawnTap(['🍎', '🍐', '🍊', '🍒', '🍑'], p => ({ x: p.x + rand(100, 380), y: p.y + rand(180, 300) }), 20, 'shake'),
      },
      {
        id: 'flowers', x: 520, y: 600, w: 160, h: 60,
        svg: () => `<ellipse cx="80" cy="40" rx="80" ry="22" fill="#8d5524"/>
          ${[[30, 28, '#ff8787'], [60, 20, '#ffd43b'], [95, 24, '#da77f2'], [128, 30, '#ff922b']].map(([x, y, c]) => `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 18}" stroke="#2f9e44" stroke-width="4"/><circle cx="${x}" cy="${y}" r="10" fill="${c}"/><circle cx="${x}" cy="${y}" r="4" fill="#fff3bf"/>`).join('')}`,
        tap: spawnTap(['🌷', '🌻', '🌼', '🌸', '🌹'], { x: 600, y: 590 }, 100),
      },
      {
        id: 'balls', x: 1000, y: 552, w: 110, h: 80,
        svg: () => `<text x="35" y="34" font-size="34" text-anchor="middle">⚽</text><text x="75" y="30" font-size="34" text-anchor="middle">🏀</text>
          <path d="M5 30 L105 30 L92 80 L18 80 Z" fill="#e8a33d"/>
          <path d="M14 46 L98 46 M18 62 L94 62" stroke="#c47f1c" stroke-width="5"/>`,
        tap: spawnTap(['⚽', '🏀', '🏈', '🎾', '🪁', '🛹', '🥏'], { x: 1055, y: 560 }, 120),
      },
      {
        id: 'doghouse', x: 1420, y: 450, w: 160, h: 150,
        svg: () => `<rect x="15" y="60" width="130" height="90" fill="#ffd43b"/><path d="M0 70 L80 0 L160 70 Z" fill="#e03131"/>
          <path d="M50 150 L50 105 Q80 75 110 105 L110 150 Z" fill="#5c3d2e"/>
          <text x="80" y="58" font-size="26" text-anchor="middle">🦴</text>`,
        tap: (p, el) => {
          animate(el, 'wiggle', 500);
          if (S.ents.filter(e => e.cat === 'pet').length >= MAX_PETS) { toast('That is a lot of pets already! 🐾'); return; }
          const pet = spawnItem(pick(CATS.pet), 1500, 560, rand(1360, 1540));
          if (pet) setTimeout(() => petSound(pet), 200);
        },
      },
      {
        id: 'duck', x: 1250, y: 680, w: 100, h: 90,
        svg: () => `<ellipse cx="50" cy="80" rx="46" ry="8" fill="rgba(255,255,255,.45)"/><text x="50" y="76" font-size="70" text-anchor="middle">🦆</text>`,
        tap: (p, el) => { animate(el, 'swim', 2400); SFX.quack(); },
      },
    ],
  },

  boutique: {
    name: 'Boutique', icon: '👗', color: '#fcc2d7',
    floor: { top: 655, bottom: 880 },
    surfaces: [{ x1: 880, x2: 1110, y: 300 }, { x1: 880, x2: 1110, y: 440 }],
    seats: [{ id: 'style', x: 700, y: 659, style: true }],
    bg: () => `
      <defs><pattern id="bp" width="60" height="60" patternUnits="userSpaceOnUse"><rect width="60" height="60" fill="#ffe3f1"/><rect width="30" height="60" fill="#ffd6ea"/></pattern></defs>
      <rect width="1600" height="640" fill="url(#bp)"/>
      <rect y="630" width="1600" height="270" fill="#f3c4dc"/>
      ${[700, 780, 860].map(y => `<rect y="${y}" width="1600" height="4" fill="#e9a8c8"/>`).join('')}
      <rect y="620" width="1600" height="16" fill="#fff"/>
      <rect x="40" y="160" width="170" height="50" rx="14" fill="#fff"/>
      <text x="125" y="195" font-size="24" font-weight="900" text-anchor="middle" fill="#c2255c" font-family="sans-serif">👋 FRIENDS</text>
      <ellipse cx="420" cy="360" rx="110" ry="180" fill="#f2c94c"/><ellipse cx="420" cy="360" rx="92" ry="162" fill="#d0ebff"/>
      <path d="M370 260 L420 220 M380 300 L450 240" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".7"/>
      <rect x="590" y="150" width="220" height="70" rx="18" fill="#c2255c"/>
      <text x="700" y="198" font-size="32" font-weight="900" text-anchor="middle" fill="#fff" font-family="sans-serif">✂️ STYLE</text>
      <rect x="640" y="470" width="120" height="170" rx="30" fill="#e64980"/>
      <rect x="622" y="628" width="156" height="30" rx="14" fill="#f06595"/>
      <rect x="690" y="658" width="20" height="70" fill="#adb5bd"/><ellipse cx="700" cy="730" rx="52" ry="11" fill="#868e96"/>
      ${[300, 440].map(y => `<rect x="880" y="${y}" width="230" height="14" rx="6" fill="#fff"/><path d="M900 ${y + 14} l0 26 l22 -26 Z M1090 ${y + 14} l0 26 l-22 -26 Z" fill="#eebefa"/>`).join('')}
      <ellipse cx="800" cy="800" rx="260" ry="55" fill="#faa2c1"/>
      <text x="572" y="650" font-size="80" text-anchor="middle">🪴</text>`,
    props: [
      {
        id: 'friendDoor', x: 30, y: 220, w: 190, h: 410,
        svg: () => `<rect width="190" height="410" rx="14" fill="#f8f9fa"/><rect x="14" y="14" width="162" height="396" rx="8" fill="#3b2b5a"/>
          ${stars([[50, 80, 4], [120, 140, 3], [80, 240, 4], [140, 320, 3], [60, 360, 2]])}
          <g class="door"><rect x="14" y="14" width="162" height="396" rx="8" fill="#b197fc"/>
            <rect x="34" y="40" width="122" height="150" rx="10" fill="#9775fa"/><rect x="34" y="220" width="122" height="160" rx="10" fill="#9775fa"/>
            <circle cx="150" cy="215" r="10" fill="#ffd43b"/><text x="95" y="135" font-size="56" text-anchor="middle">💜</text></g>`,
        tap: (p, el) => {
          animate(el, 'open', 900);
          if (S.ents.filter(e => e.type === 'char').length >= MAX_CHARS) { toast('The town is full of friends! 🎉'); return; }
          const ch = addChar(S.loc, 125, 720);
          render();
          const cel = els.get(ch.id);
          if (cel) animate(cel.firstChild, 'jump', 500);
          setFace(ch, 'happy', 900);
          fxAt('👋', 125, 520); SFX.giggle(); save();
        },
      },
      {
        id: 'wardrobe', x: 1150, y: 170, w: 320, h: 460,
        svg: () => `<rect width="320" height="460" rx="14" fill="#9c6644"/><rect x="14" y="14" width="292" height="432" rx="8" fill="#f8e1c8"/>
          <rect x="24" y="50" width="272" height="8" rx="4" fill="#868e96"/>
          ${[['#ff6b6b', 40], ['#4dabf7', 95], ['#ffd43b', 150], ['#69db7c', 205], ['#da77f2', 255]].map(([c, x]) => `<path d="M${x} 58 l25 0 l12 20 l0 120 l-50 0 l0 -120 Z" fill="${c}"/>`).join('')}
          <text x="80" y="300" font-size="50" text-anchor="middle">🎩</text><text x="160" y="300" font-size="50" text-anchor="middle">👒</text><text x="240" y="300" font-size="50" text-anchor="middle">🕶️</text>
          <text x="120" y="400" font-size="50" text-anchor="middle">👑</text><text x="200" y="400" font-size="50" text-anchor="middle">🎀</text>
          <g class="dl"><rect x="14" y="14" width="146" height="432" rx="8" fill="#b07d55"/><rect x="34" y="40" width="106" height="380" rx="8" fill="#c08f66"/><circle cx="145" cy="240" r="9" fill="#ffd43b"/></g>
          <g class="dr"><rect x="160" y="14" width="146" height="432" rx="8" fill="#b07d55"/><rect x="180" y="40" width="106" height="380" rx="8" fill="#c08f66"/><circle cx="175" cy="240" r="9" fill="#ffd43b"/></g>`,
        tap: spawnTap(['🎩', '👒', '🧢', '👑', '🎓', '🕶️', '👓', '🥽', '🎀', '🎒', '👜', '☂️', '💍', '🧣'], { x: 1310, y: 560 }, 140, 'open'),
      },
      trash(1490, 548),
    ],
  },
};
const SCENE_ORDER = ['home', 'cafe', 'park', 'boutique'];

/* ---------------------------------------------------------------- state */

let S = { loc: 'home', night: false, lampOn: true, muted: false, nextId: 1, ents: [] };

function addChar(loc, x, y, look) {
  const e = { id: 'e' + S.nextId++, type: 'char', loc, x, y, pose: 'stand', seat: null, flip: Math.random() < 0.5, look: look || randomLook() };
  S.ents.push(e);
  return e;
}
function addItem(loc, emoji, x, y) {
  const e = { id: 'e' + S.nextId++, type: 'item', loc, x, y, emoji, cat: catOf(emoji), heldBy: null, slot: null };
  S.ents.push(e);
  return e;
}
const byId = id => S.ents.find(e => e.id === id);

function newWorld() {
  S = { loc: 'home', night: false, lampOn: true, muted: S.muted, nextId: 1, ents: [] };
  const a = addChar('home', 480, 589); a.pose = 'sit'; a.seat = 'home:sofa1';
  addChar('home', 1180, 780);
  addItem('home', '🐱', 260, 810);
  addItem('home', '🍎', 1020, 450); addItem('home', '🍌', 1210, 450); addItem('home', '🧸', 700, 350);
  addChar('cafe', 600, 790);
  addItem('cafe', '☕', 1180, 550); addItem('cafe', '🧁', 1330, 550); addItem('cafe', '🍰', 840, 452);
  const p = addChar('park', 780, 661); p.pose = 'sit'; p.seat = 'park:bench1';
  addItem('park', '⚽', 980, 800); addItem('park', '🐶', 560, 810);
  addChar('boutique', 960, 790);
  addItem('boutique', '🎩', 950, 300); addItem('boutique', '🕶️', 1050, 440); addItem('boutique', '👑', 960, 440);
}

let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 300);
}
function saveNow() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(S, (k, v) => (k[0] === '_' ? undefined : v)));
  } catch (err) { /* storage unavailable – play on without saving */ }
}
function load() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (err) { data = null; }
  if (!data || !Array.isArray(data.ents) || !SCENES[data.loc]) { newWorld(); return false; }
  S = Object.assign({ night: false, lampOn: true, muted: false }, data);
  // Food that was mid-bite when the page closed is gone; drop broken references.
  S.ents = S.ents.filter(e => e.slot !== 'mouth' && (e.loc === 'pocket' || SCENES[e.loc]));
  for (const e of S.ents) if (e.heldBy && !byId(e.heldBy)) { e.heldBy = null; e.slot = null; }
  return true;
}

/* ------------------------------------------------------------ rendering */

const stage = document.getElementById('stage');
const bgEl = document.getElementById('bg');
const propsEl = document.getElementById('props');
const entsEl = document.getElementById('ents');
const nightEl = document.getElementById('night');
const fxEl = document.getElementById('fx');
const els = new Map();
let scale = 1;

function layout() {
  const vw = window.innerWidth, vh = window.innerHeight;
  scale = Math.min(vw / W, vh / H);
  const left = (vw - W * scale) / 2, top = (vh - H * scale) / 2;
  stage.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
}

function buildScene() {
  const sc = SCENES[S.loc];
  bgEl.innerHTML = `<svg viewBox="0 0 1600 900" width="1600" height="900">${sc.bg(S.night)}</svg>`;
  propsEl.innerHTML = sc.props.map(p =>
    `<div class="prop" data-pid="${p.id}" style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px">` +
    `<svg viewBox="0 0 ${p.w} ${p.h}" width="${p.w}" height="${p.h}">${p.svg(S)}</svg></div>`).join('');
  document.getElementById('locLabel').textContent = `${sc.icon} ${sc.name}`;
  document.getElementById('btnNight').textContent = S.night ? '☀️' : '🌙';
  const lamp = S.loc === 'home' && S.lampOn;
  nightEl.style.opacity = S.night ? 1 : 0;
  nightEl.style.background = lamp
    ? 'radial-gradient(circle at 895px 340px, rgba(255,210,120,.18) 0, rgba(255,210,120,.1) 180px, rgba(12,18,60,.5) 460px)'
    : 'rgba(12,18,60,.5)';
}

function makeEl(e) {
  const el = document.createElement('div');
  el.dataset.id = e.id;
  if (e.type === 'char') {
    el.className = 'ent char fh';
    el.innerHTML = '<div class="hit"></div><div class="wrap"><div class="flipper"><div class="fig"></div>' +
      '<div class="slot slot-hand"></div><div class="slot slot-face"></div><div class="slot slot-head"></div><div class="slot slot-mouth"></div></div></div>';
    el.style.setProperty('--bd', `${-rand(0, 4).toFixed(2)}s`);
    updateCharLook(e, el);
  } else {
    el.className = 'ent item' + (e.cat === 'pet' ? ' pet' : '');
    el.innerHTML = `<div class="wrap">${e.emoji}</div>`;
  }
  return el;
}
function updateCharLook(e, el = els.get(e.id)) {
  if (!el) return;
  el.querySelector('.fig').innerHTML = charSVG(e.look, e.pose);
  el.classList.toggle('sit', e.pose === 'sit');
}

function holderOf(e) { return e.heldBy ? byId(e.heldBy) : null; }
function isVisible(e) {
  const h = e.heldBy ? holderOf(e) : e;
  return !!h && (h.loc === S.loc || h.loc === 'pocket');
}

function positionEl(e, el = els.get(e.id)) {
  if (!el) return;
  if (e.heldBy) {
    const s = { hand: 0.7, face: 0.95, head: 1, mouth: 0.55 }[e.slot] || 1;
    el.style.transform = e.slot === 'head' ? 'translate(-50%, -72%)' : `translate(-50%, -50%) scale(${s})`;
    el.style.zIndex = e.slot === 'mouth' ? 3 : '';
    el.classList.remove('fall');
    return;
  }
  const isChar = e.type === 'char';
  const w = isChar ? 120 : 80, h = isChar ? 240 : 80;
  const small = e._drag ? e.y > TRAY_Y + 20 : e.loc === 'pocket';
  const s = small ? (isChar ? 0.45 : 0.75) : 1;
  el.style.transform = `translate(${e.x - w / 2}px, ${e.y - h}px) scale(${s})`;
  el.style.zIndex = e._drag ? 5000 : e.loc === 'pocket' ? 4000 : e._eating ? 2999 : Math.round(e.y) + (isChar ? 0 : 1);
  el.classList.toggle('fall', !!e._fall);
  if (isChar) el.querySelector('.flipper').classList.toggle('flip', !!e.flip);
}

function render() {
  const pocket = S.ents.filter(e => e.loc === 'pocket' && !e.heldBy).sort((a, b) => (a.po ?? 0) - (b.po ?? 0));
  pocket.forEach((e, i) => { e.po = i; if (!e._drag) { e.x = 190 + i * 105; e.y = 1030; } });

  const live = new Set();
  // Holders first so held items have a parent element to attach to.
  const order = [...S.ents].sort((a, b) => (a.heldBy ? 1 : 0) - (b.heldBy ? 1 : 0));
  for (const e of order) {
    if (!isVisible(e)) continue;
    live.add(e.id);
    let el = els.get(e.id);
    if (!el) { el = makeEl(e); els.set(e.id, el); }
    const parent = e.heldBy ? els.get(e.heldBy).querySelector('.slot-' + e.slot) : entsEl;
    if (el.parentNode !== parent) parent.appendChild(el);
    positionEl(e, el);
  }
  for (const [id, el] of els) {
    if (!live.has(id) && !el.classList.contains('dying')) { el.remove(); els.delete(id); }
  }
}

function animate(el, cls, ms) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth; // restart the animation
  el.classList.add(cls);
  clearTimeout(el['_t_' + cls]);
  el['_t_' + cls] = setTimeout(() => el.classList.remove(cls), ms);
}

function fxAt(emoji, x, y) {
  const d = document.createElement('div');
  d.className = 'fx';
  d.textContent = emoji;
  d.style.left = x + 'px';
  d.style.top = y + 'px';
  d.style.setProperty('--dx', `${rand(-40, 40)}px`);
  fxEl.appendChild(d);
  setTimeout(() => d.remove(), 1050);
}

let toastTimer = 0;
function toast(msg, ms = 2200) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function setFace(ch, face, ms) {
  const el = els.get(ch.id);
  if (!el) return;
  el.dataset.face = face;
  clearTimeout(ch._faceT);
  if (ms) ch._faceT = setTimeout(() => { if (el.dataset.face === face) el.dataset.face = ''; }, ms);
}

/* ---------------------------------------------------------- world rules */

// Where does something dropped at (x, y) come to rest? On a surface below it, or on the floor.
function settle(sc, x, y) {
  x = clamp(x, 40, W - 40);
  const f = sc.floor;
  if (y >= f.top) return { x, y: Math.min(y, f.bottom) };
  let best = null;
  for (const s of sc.surfaces) {
    if (x >= s.x1 && x <= s.x2 && s.y >= y - 30 && (!best || s.y < best.y)) best = s;
  }
  if (best) return { x, y: best.y };
  return { x, y: f.top + rand(0, 25) };
}
function land(e, x, y) {
  const p = settle(SCENES[e.loc], x, y);
  const moved = Math.abs(p.y - e.y) > 6 || Math.abs(p.x - e.x) > 6;
  e.x = p.x; e.y = p.y;
  if (moved) {
    e._fall = true;
    clearTimeout(e._fallT);
    e._fallT = setTimeout(() => { e._fall = false; const el = els.get(e.id); if (el) el.classList.remove('fall'); }, 420);
  }
}

const sceneChars = () => S.ents.filter(e => e.type === 'char' && e.loc === S.loc && !e._drag);
const scenePets = () => S.ents.filter(e => e.cat === 'pet' && e.loc === S.loc && !e.heldBy && !e._drag);
const isEdible = e => e.cat === 'food' || e.cat === 'drink';

function nearest(list, pointOf, c, max) {
  let best = null, bd = max;
  for (const x of list) {
    const d = dist(pointOf(x), c);
    if (d < bd) { bd = d; best = x; }
  }
  return best;
}

function zoneAt(sc, c) {
  for (const p of sc.props) {
    if (p.trash && c.x > p.x - 15 && c.x < p.x + p.w + 15 && c.y > p.y - 30 && c.y < p.y + p.h + 10) return { kind: 'trash', prop: p };
  }
  for (const z of sc.zones || []) {
    if (c.x > z.x1 && c.x < z.x2 && c.y > z.y1 && c.y < z.y2) return z;
  }
  return null;
}

function removeEnt(e, how) {
  S.ents = S.ents.filter(x => x !== e);
  const el = els.get(e.id);
  if (how === 'splash') { fxAt('💦', e.x, e.y - 40); SFX.splash(); }
  else if (how === 'trash') {
    fxAt('💨', e.x, e.y - 40); SFX.whoosh();
    const pe = propsEl.querySelector('[data-pid="trash"]');
    animate(pe, 'open', 500);
  }
  if (el) {
    el.classList.add('dying');
    setTimeout(() => { el.remove(); if (els.get(e.id) === el) els.delete(e.id); }, 320);
  }
}

// Keep each place from filling up with hundreds of items: the oldest loose item vanishes.
function enforceItemLimit() {
  const loose = S.ents.filter(e => e.type === 'item' && e.loc === S.loc && !e.heldBy && e.cat !== 'pet' && !e._drag && !e._eating);
  if (loose.length >= MAX_LOOSE_ITEMS) {
    const old = loose[0];
    fxAt('💨', old.x, old.y - 40);
    removeEnt(old);
  }
}

function spawnItem(emoji, x, y, tx) {
  enforceItemLimit();
  const it = addItem(S.loc, emoji, x, y);
  render();
  const el = els.get(it.id);
  animate(el.firstChild, 'spawn', 400);
  SFX.pop();
  setTimeout(() => {
    if (it._drag || !byId(it.id) || it.heldBy) return;
    land(it, tx ?? x, y);
    positionEl(it);
    setTimeout(SFX.drop, 330);
    save();
  }, 160);
  return it;
}

function freeSeatNear(sc, ch) {
  let best = null, bd = 100;
  for (const s of sc.seats) {
    const key = S.loc + ':' + s.id;
    if (S.ents.some(o => o !== ch && o.seat === key)) continue;
    const d = dist(s, ch);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
function standUp(ch) {
  if (ch.pose !== 'sit') return;
  ch.pose = 'stand';
  ch.seat = null;
  updateCharLook(ch);
}

function syncHeld(ch) {
  for (const it of S.ents) if (it.heldBy === ch.id) it.loc = ch.loc;
}

function wear(ch, item, slot) {
  const old = S.ents.find(x => x.heldBy === ch.id && x.slot === slot && x !== item);
  if (old) {
    const a = anchors(ch)[slot];
    old.heldBy = null; old.slot = null; old.loc = ch.loc;
    old.x = a.x + (ch.flip ? -70 : 70); old.y = a.y + 40;
    render();
    land(old, old.x, old.y);
  }
  item.heldBy = ch.id;
  item.slot = slot;
  item.loc = ch.loc;
  if (slot === 'hand') SFX.pop();
  else { SFX.wear(); setFace(ch, 'happy', 800); fxAt('✨', ch.x, anchors(ch).head.y); }
}

function eat(ch, food) {
  ch._busy = true;
  food._eating = true;
  food.heldBy = ch.id;
  food.slot = 'mouth';
  food.loc = ch.loc;
  render();
  const fel = els.get(food.id);
  const a = anchors(ch).mouth;

  if (YUCKY.includes(food.emoji) && Math.random() < 0.6) {
    setFace(ch, 'yuck');
    SFX.yuck();
    setTimeout(() => {
      food.heldBy = null; food.slot = null; food._eating = false;
      food.x = a.x; food.y = a.y + 40;
      render();
      land(food, a.x + (Math.random() < 0.5 ? -150 : 150), a.y + 40);
      positionEl(food);
      setFace(ch, '');
      ch._busy = false;
      save();
    }, 700);
    return;
  }

  setFace(ch, 'open');
  let n = 0;
  const step = () => {
    n++;
    if (n <= 3) {
      setFace(ch, 'chomp');
      SFX.chomp();
      if (fel) fel.firstChild.style.transform = `scale(${1 - n * 0.27})`;
      if (n === 2) fxAt(food.cat === 'drink' ? '💧' : '✨', a.x + 30, a.y + 10);
      setTimeout(() => { setFace(ch, 'open'); setTimeout(step, 180); }, 170);
    } else {
      removeEnt(food);
      setFace(ch, 'happy', 900);
      SFX.yum();
      fxAt(pick(['💖', '😋', '⭐']), a.x, a.y - 50);
      ch._busy = false;
      save();
      render();
    }
  };
  setTimeout(step, 160);
}

function petEat(pet, food) {
  pet._busy = true;
  food._eating = true;
  food.loc = pet.loc;
  food.x = pet.x + 34; food.y = pet.y + 4;
  render();
  const fel = els.get(food.id), pel = els.get(pet.id);
  let n = 0;
  const step = () => {
    n++;
    if (n <= 3) {
      SFX.chomp();
      if (pel) animate(pel.firstChild, 'munch', 200);
      if (fel) fel.firstChild.style.transform = `scale(${1 - n * 0.27})`;
      setTimeout(step, 320);
    } else {
      removeEnt(food);
      fxAt('💖', pet.x, pet.y - 90);
      petSound(pet);
      pet._busy = false;
      save();
    }
  };
  setTimeout(step, 120);
}

function jump(ch) {
  const el = els.get(ch.id);
  if (el) animate(el.firstChild, 'jump', 500);
  if (!ch._busy) setFace(ch, 'happy', 800);
  SFX.giggle();
  if (ch.loc !== 'pocket') fxAt(pick(['✨', '💫', '🎵', '💛']), ch.x + rand(-30, 30), ch.y - (ch.pose === 'sit' ? 210 : 250));
}

/* -------------------------------------------------------- drag and drop */

const drags = new Map(); // pointerId -> drag info
let lastTap = { id: null, t: 0 };

function toStage(ev) {
  const r = stage.getBoundingClientRect();
  return { x: (ev.clientX - r.left) / scale, y: (ev.clientY - r.top) / scale };
}

stage.addEventListener('pointerdown', ev => {
  audio();
  if (ev.button > 0) return;
  const entEl = ev.target.closest('.ent');
  if (entEl) { ev.preventDefault(); startDrag(ev, entEl); return; }
  const propEl = ev.target.closest('.prop');
  if (propEl) {
    ev.preventDefault();
    const p = SCENES[S.loc].props.find(x => x.id === propEl.dataset.pid);
    if (p && p.tap) p.tap(p, propEl);
  }
});

function startDrag(ev, el) {
  const e = byId(el.dataset.id);
  if (!e || e._eating) return;
  for (const d of drags.values()) if (d.id === e.id) return; // already held by another finger
  const p = toStage(ev);
  let ox = e.x - p.x, oy = e.y - p.y;
  const from = e.heldBy ? { heldBy: e.heldBy, slot: e.slot } : null;

  if (e.heldBy) {
    // Pull the item out of a hand / off a head: start it from where it is drawn.
    const h = holderOf(e);
    const a = anchors(h)[e.slot] || { x: h.x, y: h.y - 100 };
    const s = h.loc === 'pocket' ? 0.45 : 1;
    e.x = h.x + (a.x - h.x) * s;
    e.y = h.y + (a.y - h.y) * s + 40 * s;
    e.loc = h.loc;
    e.heldBy = null; e.slot = null;
    ox = e.x - p.x; oy = e.y - p.y;
  }
  if (e.loc === 'pocket') { ox = 0; oy = e.type === 'char' ? 120 : 40; }

  e._drag = true;
  e._fall = false;
  drags.set(ev.pointerId, { id: e.id, ox, oy, sx: p.x, sy: p.y, moved: false, from });
  el.classList.add('dragging');
  render();
}

window.addEventListener('pointermove', ev => {
  const d = drags.get(ev.pointerId);
  if (!d) return;
  const e = byId(d.id);
  if (!e) { drags.delete(ev.pointerId); return; }
  const p = toStage(ev);
  if (!d.moved) {
    if (Math.hypot(p.x - d.sx, p.y - d.sy) < 8) return;
    d.moved = true;
    onLift(e);
  }
  const nx = clamp(p.x + d.ox, 20, W - 20), ny = clamp(p.y + d.oy, 60, H);
  if (e.type === 'char') {
    if (nx - e.x < -3) e.flip = true;
    else if (nx - e.x > 3) e.flip = false;
  }
  e.x = nx; e.y = ny;
  positionEl(e);
  if (isEdible(e)) hintMouths(e);
}, { passive: true });

function onLift(e) {
  const el = els.get(e.id);
  if (e.type === 'char') {
    standUp(e);
    el.classList.add('lifted');
    if (!e._busy) setFace(e, 'lift');
  }
  SFX.lift();
}

const hinted = new Set();
function hintMouths(item) {
  const c = { x: item.x, y: item.y - 40 };
  for (const ch of sceneChars()) {
    if (ch._busy) continue;
    const near = item.y < TRAY_Y && dist(anchors(ch).mouth, c) < 140;
    if (near && !hinted.has(ch.id)) { hinted.add(ch.id); setFace(ch, 'open'); }
    else if (!near && hinted.has(ch.id)) { hinted.delete(ch.id); setFace(ch, ''); }
  }
}
function clearHints() {
  for (const id of hinted) { const ch = byId(id); if (ch && !ch._busy) setFace(ch, ''); }
  hinted.clear();
}

function endDrag(ev) {
  const d = drags.get(ev.pointerId);
  if (!d) return;
  drags.delete(ev.pointerId);
  const e = byId(d.id);
  if (!e) return;
  e._drag = false;
  const el = els.get(e.id);
  if (el) el.classList.remove('dragging', 'lifted');
  clearHints();
  if (e.type === 'char' && !e._busy) setFace(e, '');
  if (!d.moved) {
    // A tap on something being held or worn leaves it where it was.
    if (d.from && byId(d.from.heldBy)) Object.assign(e, d.from);
    render();
    onTap(e);
  } else {
    drop(e, toStage(ev));
    render();
  }
  save();
}
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);

function drop(e, p) {
  // Into the pocket?
  if (p.y > TRAY_Y) {
    const count = S.ents.filter(x => x.loc === 'pocket' && !x.heldBy && x !== e).length;
    if (count < POCKET_MAX || e.loc === 'pocket') {
      e.loc = 'pocket';
      e.po = (p.x - 190) / 105 - 0.5;
      if (e.type === 'char') standUp(e);
      syncHeld(e);
      SFX.pop();
      return;
    }
    toast('Your pocket is full! 🎒');
    e.y = TRAY_Y - 20;
  }

  e.loc = S.loc;
  const sc = SCENES[S.loc];

  if (e.type === 'char') {
    syncHeld(e);
    const seat = freeSeatNear(sc, e);
    if (seat) {
      e.pose = 'sit';
      e.seat = S.loc + ':' + seat.id;
      e.x = seat.x; e.y = seat.y;
      updateCharLook(e);
      SFX.drop();
      if (seat.style) setTimeout(() => openEditor(e), 300);
      return;
    }
    land(e, e.x, e.y);
    setTimeout(SFX.drop, e._fall ? 330 : 0);
    return;
  }

  const c = { x: e.x, y: e.y - 40 };
  const zone = zoneAt(sc, c);
  if (zone && e.cat !== 'pet') { removeEnt(e, zone.kind); return; }

  const chars = sceneChars().filter(ch => !ch._busy);
  if (isEdible(e)) {
    const ch = nearest(chars, ch => anchors(ch).mouth, c, 75);
    if (ch) { eat(ch, e); return; }
    const pet = nearest(scenePets().filter(x => x !== e && !x._busy), pt => ({ x: pt.x, y: pt.y - 45 }), c, 85);
    if (pet) { petEat(pet, e); return; }
  }
  if (e.cat === 'hat' || e.cat === 'face') {
    const slot = e.cat === 'hat' ? 'head' : 'face';
    const ch = nearest(chars, ch => anchors(ch)[slot], c, 85);
    if (ch) { wear(ch, e, slot); return; }
  }
  const holder = nearest(chars, ch => anchors(ch).hand, c, 65) || chars.find(ch => onBody(ch, c));
  if (holder) { wear(holder, e, 'hand'); return; }

  land(e, e.x, e.y);
  setTimeout(SFX.drop, e._fall ? 330 : 0);
}

function onTap(e) {
  const now = performance.now();
  if (e.type === 'char') {
    if (lastTap.id === e.id && now - lastTap.t < 380) {
      lastTap = { id: null, t: 0 };
      openEditor(e);
      return;
    }
    lastTap = { id: e.id, t: now };
    const food = S.ents.find(x => x.heldBy === e.id && x.slot === 'hand' && isEdible(x));
    if (food && e.loc !== 'pocket' && !e._busy) { eat(e, food); return; }
    jump(e);
    return;
  }
  const el = els.get(e.id);
  if (e.cat === 'pet') {
    if (el) animate(el.firstChild, 'hop', 450);
    petSound(e);
    if (e.loc !== 'pocket') fxAt('💕', e.x, e.y - 100);
  } else {
    if (el) animate(el.firstChild, 'bounce', 600);
    SFX.pop();
  }
}

/* --------------------------------------------------------------- travel */

function go(loc) {
  closeOverlays();
  if (loc === S.loc) return;
  // Anything still being dragged lands where it was before we leave.
  for (const d of drags.values()) {
    const e = byId(d.id);
    if (!e) continue;
    e._drag = false;
    if (e.loc !== 'pocket') land(e, e.x, Math.min(e.y, TRAY_Y - 10));
  }
  drags.clear();
  SFX.whoosh();
  stage.classList.add('fade');
  setTimeout(() => {
    S.loc = loc;
    buildScene();
    render();
    stage.classList.remove('fade');
    save();
  }, 250);
}

/* ------------------------------------------------------------- overlays */

const $ = id => document.getElementById(id);
function closeOverlays() {
  for (const id of ['map', 'help', 'editor']) $(id).hidden = true;
  if (editing) { editing = null; save(); }
}
for (const id of ['map', 'help', 'editor']) {
  $(id).addEventListener('pointerdown', ev => { if (ev.target.id === id) closeOverlays(); });
}

function openMap() {
  $('mapCards').innerHTML = SCENE_ORDER.map(k => {
    const sc = SCENES[k];
    return `<button class="card${k === S.loc ? ' here' : ''}" data-loc="${k}" style="background:${sc.color}"><span class="ico">${sc.icon}</span>${sc.name}</button>`;
  }).join('');
  $('map').hidden = false;
  SFX.click();
}
$('mapCards').addEventListener('click', ev => {
  const b = ev.target.closest('[data-loc]');
  if (b) go(b.dataset.loc);
});

let editing = null;
function openEditor(ch) {
  editing = ch.id;
  $('editor').hidden = false;
  SFX.sparkle();
  renderEditor();
}
function renderEditor() {
  const ch = byId(editing);
  if (!ch) { closeOverlays(); return; }
  const L = ch.look;
  $('edPreview').innerHTML = charSVG(L, 'stand', '0 0 100 200', 180, 360);
  $('edPreview').dataset.face = 'happy';
  const swatches = (key, list) => `<div class="swatches">${list.map(c =>
    `<button class="sw${L[key] === c ? ' on' : ''}" data-k="${key}" data-v="${c}" style="background:${c}" aria-label="${key} ${c}"></button>`).join('')}</div>`;
  const hair = `<div class="swatches">${HAIR_STYLES.map(st =>
    `<button class="sw hairbtn${L.hair === st ? ' on' : ''}" data-k="hair" data-v="${st}" aria-label="hair ${st}">${charSVG({ ...L, hair: st }, 'stand', '8 -4 84 84', 50, 50)}</button>`).join('')}</div>`;
  $('edControls').innerHTML = `
    <div class="ctl-label">Skin</div>${swatches('skin', SKINS)}
    <div class="ctl-label">Hair</div>${hair}${swatches('hairColor', HAIR_COLORS)}
    <div class="ctl-label">Eyes</div>${swatches('eyes', EYE_COLORS)}
    <div class="ctl-label">Top</div>${swatches('shirt', CLOTHES)}
    <div class="ctl-label">Bottom</div>${swatches('pants', CLOTHES)}
    <div class="ctl-label">Shoes</div>${swatches('shoes', SHOES)}
    <div class="row" style="margin-top:12px"><button class="pill alt" id="edRandom">🎲 Surprise me</button><button class="pill" id="edDone">✔ Done</button></div>`;
}
$('edControls').addEventListener('click', ev => {
  const ch = byId(editing);
  if (!ch) return;
  const b = ev.target.closest('button');
  if (!b) return;
  if (b.id === 'edDone') { closeOverlays(); setFace(ch, 'happy', 900); SFX.yum(); return; }
  if (b.id === 'edRandom') ch.look = randomLook();
  else if (b.dataset.k) ch.look[b.dataset.k] = b.dataset.v;
  else return;
  SFX.pop();
  updateCharLook(ch);
  renderEditor();
  save();
});

$('btnMap').addEventListener('click', openMap);
$('btnNight').addEventListener('click', () => { S.night = !S.night; SFX.sparkle(); buildScene(); save(); });
$('btnSound').addEventListener('click', () => {
  S.muted = !S.muted;
  $('btnSound').textContent = S.muted ? '🔇' : '🔊';
  SFX.click(); save();
});
$('btnHelp').addEventListener('click', () => { $('help').hidden = false; SFX.click(); });
$('btnHelpClose').addEventListener('click', closeOverlays);
$('btnReset').addEventListener('click', () => {
  if (!confirm('Start a brand new world? Everything will go back to the beginning.')) return;
  for (const el of els.values()) el.remove();
  els.clear();
  newWorld();
  closeOverlays();
  buildScene();
  render();
  saveNow();
});

/* ----------------------------------------------------------------- boot */

window.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => setTimeout(layout, 200));
document.addEventListener('contextmenu', ev => ev.preventDefault());
document.addEventListener('gesturestart', ev => ev.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
window.addEventListener('pagehide', saveNow);

const returning = load();
$('btnSound').textContent = S.muted ? '🔇' : '🔊';
layout();
buildScene();
render();
if (!returning) setTimeout(() => toast('Drag anything! Tap ❓ to learn more.', 3500), 600);
else if (window.innerHeight > window.innerWidth * 1.2) setTimeout(() => toast('Tip: turn your device sideways 🔄', 3000), 600);
