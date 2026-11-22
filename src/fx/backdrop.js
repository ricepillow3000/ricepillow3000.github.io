/* =========================================================================
   Street-art wall — 3-layer parallax background (pure inline SVG + CSS).
   Original artwork in a graffiti / pop-art / high-contrast style:
   a crimson → black spray-paint fade on concrete, stencil stars,
   torn posters, tape and broken-glass shards.
   Palette: crimson #E60012 / #D80000, black #050505, white #FFFFFF
   (spray fades are the only gradients — they read as aerosol overspray).
   Geometry lives in a 1600×900 box; `xMidYMid slice` covers 100vw × 100vh.
   ========================================================================= */

import { mountSubway, hurrySubway, subwayReady } from './subway.js';
import { artSrc } from './art.js';

const C = { black: '#050505', red: '#D80000', red2: '#E60012', white: '#FFFFFF', blood: '#7A0008' };
const VB = '0 0 1600 900';

const pts = (p) => p.map((q) => q.join(',')).join(' ');
const poly = (p, fill, extra = '') => `<polygon points="${pts(p)}" fill="${fill}" ${extra}/>`;
const star = (cx, cy, r, inner = 0.42, n = 5, rot = -90) => {
  const out = [];
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    const rr = i % 2 ? r * inner : r;
    out.push([+(cx + Math.cos(a) * rr).toFixed(1), +(cy + Math.sin(a) * rr).toFixed(1)]);
  }
  return out;
};

/** Torn-edge rectangle (poster paper). */
function torn(x, y, w, h, seed = 3) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const p = [];
  for (let i = 0; i <= 12; i++) p.push([x + (w * i) / 12, y + (rnd() * 10 - 5)]);
  for (let i = 1; i <= 8; i++) p.push([x + w + (rnd() * 10 - 5), y + (h * i) / 8]);
  for (let i = 11; i >= 0; i--) p.push([x + (w * i) / 12, y + h + (rnd() * 12 - 6)]);
  for (let i = 7; i >= 1; i--) p.push([x + (rnd() * 10 - 5), y + (h * i) / 8]);
  return p.map(([a, b]) => [+a.toFixed(1), +b.toFixed(1)]);
}

/* (LAYER 1, the spray-painted wall, was removed Nov 19 in the speed pass: it had been fully
   transparent since the Nano Banana art, yet was still built, laid out and moved with the mouse.) */

/* =========================================================================
   LAYER 2 — GRAFFITI: the stencil star behind the title.
   ========================================================================= */
function graffitiLayer() {
  return `<svg viewBox="${VB}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">

  <!-- giant stencil star with an offset red echo -->
  <g class="spin-slow" style="--spin:120s">
    ${poly(star(330, 560, 250), 'none', `stroke="${C.red2}" stroke-width="16" stroke-linejoin="miter" transform="translate(18 14)"`)}
    ${poly(star(330, 560, 250), 'none', `stroke="${C.white}" stroke-width="16" stroke-linejoin="miter"`)}
  </g>
  ${poly(star(330, 560, 110), C.black)}


  <!-- (the ATL poster and the swoosh arrow pointing at it were removed Nov 21, John: "kind of corny"; the station shows clear) -->

  <!-- (the crown outline under the mute button was removed Nov 19, John: corny) -->
</svg>`;
}

/* =========================================================================
   LAYER 3 — FOREGROUND: broken-glass shards in the corners, big halftone,
   asymmetric and jagged on purpose.
   ========================================================================= */
function shardLayer() {
  const shardTL = [[-20, -20], [380, -20], [120, 130], [-20, 260]];
  const shardBL = [[-20, 920], [-20, 700], [220, 920]];
  return `<svg viewBox="${VB}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs><pattern id="dotsB" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="8" cy="8" r="4.6" fill="${C.black}"/></pattern></defs>
  ${poly(shardTL, C.black)}
  <path d="M-20 260 L 120 130 L 380 -20 M 120 130 L 60 -20 M 120 130 L 250 40" fill="none" stroke="${C.white}" stroke-width="3"/>
  ${poly(shardBL, 'url(#dotsB)')}
  <!-- (the bottom-right glass shard and its connected crack triangles were removed Nov 19, John: keep the star, lose the triangles) -->
</svg>`;
}

/* =========================================================================
   Mount + motion: shared drift (nearer layers move further) + pointer parallax.
   ========================================================================= */
/* =========================================================================
   LAYER 4 — FOREGROUND CUT-PAPER (Nov 19, John: the server racks "don't fit, replace them with
   something that matches the Persona 5 vibe"; they and the circuit board are retired). Jagged
   black card with a white ink edge, a big white star over a red offset star, a black-and-white
   zigzag tape strip, small stars: the same bold flat vocabulary as the rest of the backdrop
   (original shapes). They sit at the edges, in front of the scene, move the most (parallax),
   and never go over the content.
   ========================================================================= */
function techLayer() {
  const K = C.black;
  const bigStar = (cx, cy, r, rot) => poly(star(cx + r * 0.16, cy + r * 0.12, r, 0.42, 5, rot), C.red2)
    + poly(star(cx, cy, r, 0.42, 5, rot), C.white, `stroke="${K}" stroke-width="7" stroke-linejoin="miter"`);
  const card = [[-40, 700], [250, 652], [270, 708], [352, 688], [410, 940], [-40, 940]];
  const shardR = [[1430, 940], [1640, 940], [1640, 630], [1574, 690], [1528, 650], [1496, 760]];
  const shardT = [[1290, -20], [1640, -20], [1640, 230], [1560, 190], [1500, 250], [1452, 120]];
  return `<svg viewBox="${VB}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <g class="cut-left">
    ${poly(card, K)}
    <path d="M-40 700 L250 652 L270 708 L352 688 L410 940" fill="none" stroke="${C.white}" stroke-width="5" stroke-linejoin="miter"/>
    ${bigStar(232, 812, 84, -98)}
    ${poly(star(360, 660, 22, 0.42, 5, -80), C.white, `stroke="${K}" stroke-width="5"`)}
    ${poly(star(96, 716, 13, 0.42, 5, -100), C.red2)}
  </g>
  <g class="cut-right">
    ${poly(shardR, K)}
    <path d="M1430 940 L1496 760 L1528 650 L1574 690 L1640 630" fill="none" stroke="${C.white}" stroke-width="5" stroke-linejoin="miter"/>
    ${bigStar(1568, 820, 56, -84)}
  </g>
  <g class="cut-top">
    ${poly(shardT, K)}
    <path d="M1290 -20 L1452 120 L1500 250 L1560 190 L1640 230" fill="none" stroke="${C.white}" stroke-width="5" stroke-linejoin="miter"/>
    ${poly(star(1556, 92, 34, 0.42, 5, -110), C.white, `stroke="${K}" stroke-width="5"`)}
  </g>
</svg>`;
}

/* =========================================================================
   LAYER — P5-STYLE GRAPHICS (John: "make it feel like the P5 menus"): bold flat shapes in
   pure black / white / red sitting in front of the scene, never over the content:
   a nested zigzag starburst (rings of jagged stars alternating black and white, turning
   slowly), a tilted block of solid halftone dots, white star cutouts and one red jagged
   slash. Original geometry; no logos, hands or characters.
   ========================================================================= */
function p5Layer() {
  const ring = (cx, cy, r, n, rot, inner) => star(cx, cy, r, inner, n, rot);
  let burst = '';
  for (let i = 0; i < 9; i++) {
    const r = 420 - i * 46;
    burst += poly(ring(0, 0, r, 16, -90 + i * 6, 0.8), i % 2 ? C.white : C.black, i === 0 ? `stroke="${C.black}" stroke-width="6"` : '');
  }
  const dots = torn(0, 0, 360, 250, 41);
  return `<svg viewBox="${VB}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs><pattern id="p5dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="8" cy="8" r="5.2" fill="${C.black}"/></pattern></defs>
  <!-- the big split: a flat red plane slicing the right side, and a jagged white band with an ink edge
       cutting across, in the bold P5 way (original shapes) -->
  ${poly([[1010, -20], [1620, -20], [1620, 920], [760, 920]], C.red2)}
  ${poly([[1010, -20], [1040, -20], [790, 920], [760, 920]], C.black)}
  ${poly([[-20, 700], [300, 636], [282, 668], [622, 588], [604, 616], [1000, 516], [1012, 594], [626, 690], [646, 664], [304, 746], [322, 714], [-20, 800]], C.white, `stroke="${C.black}" stroke-width="7"`)}
  <g class="p5-burst" transform="translate(1540 300)"><g class="spin-slow" style="--spin:140s">${burst}</g></g>
  <g transform="translate(-60 640) rotate(-9)">
    ${poly(dots, C.white, `stroke="${C.black}" stroke-width="7"`)}${poly(dots, 'url(#p5dots)')}
  </g>
  ${poly([[1180, 900], [1290, 690], [1250, 700], [1380, 470], [1335, 640], [1385, 625], [1300, 900]], C.red2, `stroke="${C.black}" stroke-width="6"`)}
  ${poly(star(1460, 760, 70, 0.42), C.white, `stroke="${C.black}" stroke-width="7"`)}
  ${poly(star(90, 90, 46, 0.42, 5, -72), C.white, `stroke="${C.black}" stroke-width="6"`)}
</svg>`;
}

/* The round tower's red LED screens are moving billboards: JOHN NGUYEN ★ crawls across the middle
   ring (Nov 19, John: "my name or star moving from screen to screen"), and the ring above it reads
   TAKE YOUR TIME, the site's motto (Nov 19, John: "traverses from one side of the red screen to
   the other and loops"). LED dots, narrowing toward the edges as the screen curves away. The outlines and paths
   were measured on the art (1600x679 space; every art size has the same shape), and the layer is
   fitted with the art's own object-fit math so it stays glued to the screen. The bottom ring stays
   a plain red screen (it sits behind THE PLAN's big button on most screens). */
const BB_RINGS = [
  ['top', 'M700.3 225.0 L701.0 221.1 L702.3 217.1 L704.0 213.3 L706.2 209.5 L708.9 205.8 L712.1 202.2 L715.7 198.8 L719.7 195.5 L724.1 192.4 L728.9 189.4 L734.1 186.6 L739.6 184.1 L745.4 181.7 L751.5 179.6 L757.8 177.8 L764.4 176.2 L771.2 174.8 L778.1 173.7 L785.1 172.9 L792.2 172.3 L799.4 172.0 L806.6 172.0 L813.8 172.3 L820.9 172.9 L827.9 173.7 L834.8 174.8 L841.6 176.2 L848.2 177.8 L854.5 179.6 L860.6 181.7 L866.4 184.1 L871.9 186.6 L877.1 189.4 L881.9 192.4 L886.3 195.5 L890.3 198.8 L893.9 202.2 L897.1 205.8 L899.8 209.5 L902.0 213.3 L903.7 217.1 L905.0 221.1 L905.7 225.0 L905.7 260.6 L905.0 257.2 L903.7 253.8 L902.0 250.5 L899.8 247.2 L897.1 244.1 L893.9 241.0 L890.3 238.0 L886.3 235.2 L881.9 232.5 L877.1 230.0 L871.9 227.6 L866.4 225.4 L860.6 223.4 L854.5 221.6 L848.2 220.0 L841.6 218.6 L834.8 217.4 L827.9 216.5 L820.9 215.7 L813.8 215.3 L806.6 215.0 L799.4 215.0 L792.2 215.3 L785.1 215.7 L778.1 216.5 L771.2 217.4 L764.4 218.6 L757.8 220.0 L751.5 221.6 L745.4 223.4 L739.6 225.4 L734.1 227.6 L728.9 230.0 L724.1 232.5 L719.7 235.2 L715.7 238.0 L712.1 241.0 L708.9 244.1 L706.2 247.2 L704.0 250.5 L702.3 253.8 L701.0 257.2 L700.3 260.6 Z'],
  ['middle', 'M692.3 327.9 L693.1 324.7 L694.4 321.6 L696.3 318.6 L698.7 315.6 L701.6 312.7 L705.0 309.9 L708.9 307.2 L713.2 304.5 L718.0 302.1 L723.2 299.7 L728.7 297.6 L734.7 295.5 L740.9 293.7 L747.5 292.0 L754.3 290.6 L761.4 289.3 L768.7 288.2 L776.1 287.3 L783.7 286.7 L791.4 286.2 L799.1 286.0 L806.9 286.0 L814.6 286.2 L822.3 286.7 L829.9 287.3 L837.3 288.2 L844.6 289.3 L851.7 290.6 L858.5 292.0 L865.1 293.7 L871.3 295.5 L877.3 297.6 L882.8 299.7 L888.0 302.1 L892.8 304.5 L897.1 307.2 L901.0 309.9 L904.4 312.7 L907.3 315.6 L909.7 318.6 L911.6 321.6 L912.9 324.7 L913.7 327.9 L913.7 371.4 L912.9 368.9 L911.6 366.3 L909.7 363.8 L907.3 361.3 L904.4 359.0 L901.0 356.6 L897.1 354.4 L892.8 352.3 L888.0 350.2 L882.8 348.3 L877.3 346.5 L871.3 344.8 L865.1 343.3 L858.5 342.0 L851.7 340.7 L844.6 339.7 L837.3 338.8 L829.9 338.1 L822.3 337.6 L814.6 337.2 L806.9 337.0 L799.1 337.0 L791.4 337.2 L783.7 337.6 L776.1 338.1 L768.7 338.8 L761.4 339.7 L754.3 340.7 L747.5 342.0 L740.9 343.3 L734.7 344.8 L728.7 346.5 L723.2 348.3 L718.0 350.2 L713.2 352.3 L708.9 354.4 L705.0 356.6 L701.6 359.0 L698.7 361.3 L696.3 363.8 L694.4 366.3 L693.1 368.9 L692.3 371.4 Z'],
  ['bottom', 'M681.3 483.1 L682.2 481.6 L683.7 480.1 L685.7 478.6 L688.4 477.2 L691.6 475.8 L695.3 474.5 L699.6 473.2 L704.4 471.9 L709.7 470.7 L715.4 469.6 L721.5 468.5 L728.1 467.6 L735.0 466.7 L742.2 465.9 L749.8 465.2 L757.6 464.6 L765.6 464.1 L773.9 463.6 L782.2 463.3 L790.7 463.1 L799.2 463.0 L807.8 463.0 L816.3 463.1 L824.8 463.3 L833.1 463.6 L841.4 464.1 L849.4 464.6 L857.2 465.2 L864.8 465.9 L872.0 466.7 L878.9 467.6 L885.5 468.5 L891.6 469.6 L897.3 470.7 L902.6 471.9 L907.4 473.2 L911.7 474.5 L915.4 475.8 L918.6 477.2 L921.3 478.6 L923.3 480.1 L924.8 481.6 L925.7 483.1 L925.7 538.0 L924.8 537.3 L923.3 536.6 L921.3 535.8 L918.6 535.1 L915.4 534.4 L911.7 533.7 L907.4 533.1 L902.6 532.5 L897.3 531.9 L891.6 531.3 L885.5 530.8 L878.9 530.3 L872.0 529.8 L864.8 529.4 L857.2 529.1 L849.4 528.8 L841.4 528.5 L833.1 528.3 L824.8 528.2 L816.3 528.1 L807.8 528.0 L799.2 528.0 L790.7 528.1 L782.2 528.2 L773.9 528.3 L765.6 528.5 L757.6 528.8 L749.8 529.1 L742.2 529.4 L735.0 529.8 L728.1 530.3 L721.5 530.8 L715.4 531.3 L709.7 531.9 L704.4 532.5 L699.6 533.1 L695.3 533.7 L691.6 534.4 L688.4 535.1 L685.7 535.8 L683.7 536.6 L682.2 537.3 L681.3 538.0 Z'],
];
/* each ring, measured on the art: centre x, radius, top edge (y at the front, curve), bottom edge */
const BB_GEO = {
  top: { cx: 803, R: 103, t0: 172, ta: 57, b0: 215, ba: 49 },
  middle: { cx: 803, R: 111, t0: 286, ta: 45, b0: 337, ba: 37 },
  bottom: { cx: 803.5, R: 122.5, t0: 463, ta: 21.6, b0: 528, ba: 10.8 },
};
/* what each ring says (the star is drawn as a shape, the rest is LED type), and how much of the
   ring's height the type fills: the longer line is a little smaller so it fits the screen's face */
const BB_TEXT = {
  top: { text: [...'TAKE YOUR TIME'], fill: 0.45, offset: 0.45 }, // offset: its loop runs out of step with the name's
  middle: { text: [...'JOHN NGUYEN', '★'], fill: 0.66, offset: 0 },
};
const BB_ORDER = Object.keys(BB_TEXT);
const bbSize = (n) => (BB_GEO[n].b0 - BB_GEO[n].t0) * BB_TEXT[n].fill;
const RINGS_USED = BB_RINGS.filter(([n]) => BB_TEXT[n]);
/* a ring's screen, as a box round its outline (with a little air), in the art's 1600x679 space */
function ringBox(n) {
  const v = BB_RINGS.find(([k]) => k === n)[1].match(/[\d.]+/g).map(Number);
  const xs = v.filter((_, i) => i % 2 === 0);
  const ys = v.filter((_, i) => i % 2 === 1);
  const x = Math.floor(Math.min(...xs)) - 4;
  const y = Math.floor(Math.min(...ys)) - 4;
  return { x, y, w: Math.ceil(Math.max(...xs)) + 4 - x, h: Math.ceil(Math.max(...ys)) + 4 - y };
}
/* the rooftop aviation lights painted in the city art (x, y, radius in the 1600x679 art), found by
   their red glow on the art (the red reflections on walls and the wet street are left out) */
const AV_LIGHTS = [[842.3, 49.2, 5], [755.4, 51.9, 5], [1191.3, 71.7, 2], [390.6, 85.8, 3.5], [620.5, 101.8, 4.5], [924.5, 114.5, 4.5],
  [1190.3, 131.4, 4], [950.2, 144.4, 4.5], [513.4, 174.9, 2.5], [551.8, 187.0, 3.5], [476.8, 204.3, 3], [997.3, 205.2, 3], [534.2, 223.7, 4.5],
  [374.9, 244.6, 3], [349.6, 247.0, 5], [1014.7, 272.2, 3], [1214.7, 275.0, 3.5], [1053.8, 281.0, 2.5], [1077.7, 308.9, 2.5],
  [1112.0, 356.4, 2.5], [1105.3, 369.4, 3], [1159.6, 382.0, 2.5], [1206.7, 387.9, 2.5]];
function billboardLayer() {
  const letters = (n) => {
    const size = bbSize(n);
    return BB_TEXT[n].text.map((ch) => (ch === '★'
      ? `<g class="bb-ch" data-w="1.05">${poly(star(0, 0, size * 0.48, 0.42, 5, -90), '#FFFFFF')}</g>`
      : `<g class="bb-ch" data-w="${ch === ' ' ? 0.42 : /[IJ]/.test(ch) ? 0.5 : /[MW]/.test(ch) ? 0.92 : 0.66}"><text font-size="${size.toFixed(1)}" text-anchor="middle" dominant-baseline="central">${ch === ' ' ? '' : ch}</text></g>`)).join('');
  };
  /* The letters are the MASK and the LED dots are what shows through it (Nov 21, the deep-link speed
     pass). It used to be the other way round (letters masked by the dots): the same white dots
     either way, but live <text> was the biggest thing a browser saw "paint" on THE PLAN, and it only
     appears once the 430 KB city picture has loaded, so a phone's Lighthouse timed the board's
     largest paint at ~7 s. Inside a mask the letters are a stencil, not page text, and the board's
     own words count instead. (The words stay in the DOM for the tests and the ticker.) */
  return `<svg class="bd-billboard" viewBox="0 0 1600 679" preserveAspectRatio="none" aria-hidden="true">
  <defs>
    <pattern id="bbLed" width="3.2" height="3.2" patternUnits="userSpaceOnUse"><circle cx="1.6" cy="1.6" r="1.4" fill="#fff"/></pattern>
    ${RINGS_USED.map(([n]) => { const b = ringBox(n); return `<mask id="bbText-${n}" maskUnits="userSpaceOnUse" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"><g class="bb-ring bb-${n}" data-ring="${n}">${letters(n)}</g></mask>`; }).join('')}
    <!-- real LED light (Nov 19, John: "amplify it, make it actually look like billboard lights"): a
         tight white glow round every lit dot, a wide red-pink light spilling onto the screen around
         the letters, and the dots themselves a little warm, like LEDs behind a red face -->
    <filter id="bbGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 .93 0 0 0  0 0 .9 0 0  0 0 0 1 0" result="led"/>
      <feGaussianBlur in="led" stdDeviation="2.4" result="b"/>
      <feGaussianBlur in="led" stdDeviation="9" result="wide"/>
      <feColorMatrix in="wide" type="matrix" values="0 0 0 0 1  0 0 0 0 .32  0 0 0 0 .4  0 0 0 2.2 0" result="spill"/>
      <feMerge><feMergeNode in="spill"/><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="led"/></feMerge>
    </filter>
    <linearGradient id="bbSheen" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    ${RINGS_USED.map(([n, d]) => `<clipPath id="bbRing-${n}"><path d="${d}"/></clipPath>`).join('')}
    ${BB_RINGS.map(([n, d]) => `<clipPath id="bbFace-${n}"><path d="${d}"/></clipPath>`).join('')}
    <pattern id="bbGrid" width="2.6" height="2.6" patternUnits="userSpaceOnUse"><path d="M.3 0V2.6" stroke="#4A000C" stroke-width=".6" opacity=".55"/><path d="M0 .3H2.6" stroke="#4A000C" stroke-width=".4" opacity=".25"/></pattern>
    ${BB_RINGS.map(([n]) => { const g = BB_GEO[n]; return `<linearGradient id="bbCurve-${n}" gradientUnits="userSpaceOnUse" x1="${g.cx - g.R}" x2="${g.cx + g.R}" y1="0" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset=".2" stop-color="#000" stop-opacity=".14"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity=".14"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient>`; }).join('')}
  </defs>
  <!-- each screen's face, one solid LED red (Nov 19, John: the art's screens had light red blotches,
       "make it all a solid color, following the texture pattern"): the base red (matched to the art
       shown at 72%), the fine LED grid, and a little shade toward the edges so it still reads as a drum -->
  ${BB_RINGS.map(([n, d]) => `<path d="${d}" fill="#A3112A"/><path d="${d}" fill="url(#bbGrid)"/><path d="${d}" fill="url(#bbCurve-${n})"/>`).join('')}
  ${RINGS_USED.map(([n]) => { const b = ringBox(n); return `<g clip-path="url(#bbRing-${n})"><g class="bb-flicker" filter="url(#bbGlow)"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="url(#bbLed)" mask="url(#bbText-${n})"/></g></g>`; }).join('')}
  <!-- a faint light sweep gliding across each screen's glass, out of step, now and then -->
  ${BB_RINGS.map(([n], i) => { const g = BB_GEO[n]; return `<g clip-path="url(#bbFace-${n})"><rect class="bb-sheen" style="--sd:${(i * 2.3).toFixed(1)}s" x="${g.cx - g.R - 60}" y="${g.t0 - g.ta - 10}" width="60" height="${g.b0 - g.t0 + g.ta + 30}" fill="url(#bbSheen)" transform="skewX(-12)"/></g>`; }).join('')}
</svg>`;
}


/* The aviation obstruction lights on the rooftops (Nov 19, John: "have them blink... when it turns off
   it's a black ball that looks like a bulb", then: "blink at random times", "look like it's part of
   the building, not a pin you stick on a board"). Three thin layers over the art, fitted like the
   billboard: (1) MULTIPLIED over the art, a soft dark spot that puts out the glow painted round each
   light while the roof's own lines and greys still show through (fading out to nothing at the edge,
   never toward white: the art is shown at 72%, so white would leak through as a grey ring); (2) the fixture itself ON the roof, a squat housing in the
   building's grey with an ink edge and a small lens on top (dull red glass when off, a hot lens when
   lit), no shiny ball, no glint; (3) ADDED onto the scene (screen blend), the light: a halo in the air
   and a pool of red falling onto the roof under it. (Blend modes only reach the art from separate
   layers: inside one SVG they only mix with that SVG.) Blink timing: startTicker's lightsStep. */
function towerLights() {
  const f = (n) => n.toFixed(1);
  const size = (r) => Math.max(1.6, r * 0.62); // the fixture: about the painted dot's core
  const lens = (x, y, s, fill) => `<path d="M${f(x - s * 0.82)} ${f(y + s * 0.5)}A${f(s * 0.82)} ${f(s * 0.95)} 0 0 1 ${f(x + s * 0.82)} ${f(y + s * 0.5)}Z" fill="${fill}"${fill.startsWith('#') ? ' stroke="#0B0B0B" stroke-width=".4"' : ''}/>`;
  const layer = (cls, defs, body) => `<svg class="bd-billboard bd-av ${cls}" viewBox="0 0 1600 679" preserveAspectRatio="none" aria-hidden="true"><defs>${defs}</defs>${body}</svg>`;
  return layer('bd-avdim', '<radialGradient id="avDim"><stop offset=".2" stop-color="#2A2426" stop-opacity=".92"/><stop offset=".6" stop-color="#2A2426" stop-opacity=".45"/><stop offset="1" stop-color="#2A2426" stop-opacity="0"/></radialGradient>',
    AV_LIGHTS.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${f(r * 3.8)}" fill="url(#avDim)"/>`).join(''))
  + layer('bd-avfix', '<radialGradient id="avLit" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#FFF0EC"/><stop offset=".45" stop-color="#FF4A3A"/><stop offset="1" stop-color="#C0101A"/></radialGradient>',
    AV_LIGHTS.map(([x, y, r], i) => { const s = size(r); return `<g class="av" data-av="${i}">
    <path d="M${f(x - s * 1.25)} ${f(y + s * 1.55)}L${f(x - s * 0.8)} ${f(y + s * 0.45)}H${f(x + s * 0.8)}L${f(x + s * 1.25)} ${f(y + s * 1.55)}Z" fill="#34343A" stroke="#0B0B0B" stroke-width=".45"/><path d="M${f(x - s * 0.8)} ${f(y + s * 0.45)}H${f(x + s * 0.8)}" stroke="#6E6E76" stroke-width=".35"/>
    ${lens(x, y, s, '#3A0B10')}<g class="av-on">${lens(x, y, s, 'url(#avLit)')}</g></g>`; }).join(''))
  + layer('bd-avglow', '<radialGradient id="avHalo"><stop offset="0" stop-color="#FF2A1E" stop-opacity=".95"/><stop offset=".3" stop-color="#E0141A" stop-opacity=".4"/><stop offset="1" stop-color="#A00000" stop-opacity="0"/></radialGradient><radialGradient id="avSpill"><stop offset="0" stop-color="#FF2A1E" stop-opacity=".55"/><stop offset="1" stop-color="#FF2A1E" stop-opacity="0"/></radialGradient>',
    AV_LIGHTS.map(([x, y, r], i) => `<g class="av" data-av="${i}"><g class="av-on"><ellipse cx="${x}" cy="${f(y + size(r) * 2.4)}" rx="${f(r * 3.2)}" ry="${f(r * 1.5)}" fill="url(#avSpill)"/><circle cx="${x}" cy="${y}" r="${f(r * 4.8)}" fill="url(#avHalo)"/></g></g>`).join(''));
}

/* The tickers: each ring's line scrolls right to left across its screen, wrapping round the drum
   (each letter sits at its own angle: x = cx + R sin θ, squashed by cos θ, riding the ring's curved
   middle), leaves at the left edge and comes back in from the right, on a loop. Both rings run at
   the same calm speed, out of step. Runs only while the city is on screen; with reduced motion
   each line rests in the middle of its ring. */
function startTicker(svg) {
  const SPEED = 0.95; // radians a second: a calm billboard crawl
  const EDGE = 1.75; // starts/ends just past the visible edge (~100 degrees)
  const rings = BB_ORDER.map((n) => {
    const g = BB_GEO[n];
    const size = bbSize(n);
    const chars = [...svg.querySelectorAll(`.bb-${n} .bb-ch`)];
    const widths = chars.map((c) => (Number(c.dataset.w) * size) / g.R); // each letter's width, as an angle
    const total = widths.reduce((a, w) => a + w, 0);
    const pass = (2 * EDGE + total) / SPEED; // one crossing, edge to edge
    return { g, chars, widths, total, pass, offset: BB_TEXT[n].offset * pass };
  });
  const place = (ring, lead) => {
    let th = lead;
    ring.chars.forEach((c, i) => {
      const t = th + ring.widths[i] / 2;
      th += ring.widths[i];
      const cos = Math.cos(t);
      // (Nov 21: only what changed is written: a letter round the back was set hidden again every frame)
      // (a letter seen nearly edge-on is a sliver of dots that reads as a broken glyph: it dims out as it turns away, and is gone before it is a sliver)
      if (cos <= 0.3) { if (c._v !== 0) { c.style.visibility = 'hidden'; c._v = 0; } return; }
      const op = cos >= 0.56 ? 1 : Math.ceil(((cos - 0.3) / 0.26) * 6) / 6;
      if (c._o !== op) { c.setAttribute('opacity', op.toFixed(2)); c._o = op; }
      const { cx, R, t0, ta, b0, ba } = ring.g;
      const x = cx + R * Math.sin(t);
      const y = (t0 + b0) / 2 + ((ta + ba) / 2) * (1 - cos);
      if (c._v !== 1) { c.style.visibility = 'visible'; c._v = 1; }
      const tf = `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${cos.toFixed(3)} 1)`;
      if (c._tf !== tf) { c.setAttribute('transform', tf); c._tf = tf; }
    });
  };
  const reduce = () => document.body.classList.contains('reduce-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* The aviation lights blink at random (Nov 19, John: "not all blink and unblink at the same time...
     blink at random times"): every light rolls a fresh on-time (0.35-1.4 s) and off-time (0.3-2.1 s)
     each time it switches, so no two ever share a rhythm and no light repeats its own. Now and then
     (1 in 8) a light stutters off for a beat, like a tired lamp. They start in a random state. With
     reduced motion they all rest on. */
  const lights = AV_LIGHTS.map((_, i) => {
    const els = [...svg.parentNode.querySelectorAll(`.av[data-av="${i}"]`)]; // its lens and its light
    const on = Math.random() < 0.5;
    els.forEach((e) => e.classList.toggle('lit', on));
    return { els, on, next: performance.now() + Math.random() * 1400 };
  });
  const roll = (on) => (on ? (Math.random() < 0.125 ? 0.09 : 0.35 + Math.random() * 1.05) : 0.3 + Math.random() * 1.8) * 1000;
  const lightsStep = (now, still) => {
    lights.forEach((l) => {
      if (still) { if (!l.on) { l.on = true; l.els.forEach((e) => e.classList.add('lit')); } return; }
      if (now < l.next) return;
      l.on = !l.on;
      l.els.forEach((e) => e.classList.toggle('lit', l.on));
      l.next = now + roll(l.on);
    });
  };
  const t0 = performance.now();
  const art = svg.parentNode.querySelector('img');
  /* The LED rings step 30 times a second, like a real LED sign (Nov 21: every letter sits under a glow filter, a dot
     mask and a clip, so each step is an SVG re-layout and a filtered repaint in the page's one lane; at 60 a second that
     ran behind every chapter all the time. Under the dot mask 30 steps look the same, at half the work.) */
  let lastLed = 0;
  const frame = (now) => {
    requestAnimationFrame(frame);
    if (document.body.dataset.mode === 'title') return; // the city isn't shown on the title
    /* nor before its picture has arrived: the billboard fades in with it (.bd-city img.in ~), and
       moving invisible letters cost a layout every frame while THE PLAN's entrance was playing */
    if (!art.classList.contains('in')) return;
    const still = reduce();
    lightsStep(now, still);
    if (now - lastLed < 1000 / 30 - 2) return;
    lastLed = now;
    rings.forEach((r) => {
      if (still) place(r, -r.total / 2);
      else place(r, EDGE - ((((now - t0) / 1000 + r.offset) % r.pass) * SPEED)); // enters at the right, travels left
    });
  };
  requestAnimationFrame(frame);
}
/** Fit the billboard layer to where object-fit: cover (position 50% 40%) puts the city art. */
function fitBillboard(frame) {
  const W = frame.offsetWidth;
  const H = frame.offsetHeight;
  if (!W || !H) return;
  const k = Math.max(W / 1600, H / 679);
  frame.querySelectorAll('.bd-billboard').forEach((svg) => Object.assign(svg.style, { width: `${1600 * k}px`, height: `${679 * k}px`, left: `${(W - 1600 * k) * 0.5}px`, top: `${(H - 679 * k) * 0.4}px` }));
}

/** The far city: Nano Banana night-city art (cartoon ink style: black sky, gray towers, white
    windows, red only on screens and billboards), tilted to a Dutch angle and pushed back so it
    never fights the content in front. On the title it is printed faintly into the red wall. */
/** The title's opening shot: an empty night subway platform (Nano Banana, clean toon-shaded 3D like
    a P5 cutscene: dark, glossy floor, red safety lines, fluorescent strips, no people), slow camera push. */

let cityLoading = false;
let loadSceneNow = () => {};
let loadStationNow = () => {};
let stationIn;
const stationShown = new Promise((r) => { stationIn = r; });
/** The loading star (src/ui/loader.js): start the platform's sharp picture now, and resolve once it
    is on screen (or has failed: the blurred stand-in stays, nothing waits forever). */
export function stationReady() {
  loadStationNow();
  return stationShown;
}
/** PRESS START / CONTINUE: load the platform and the train right now (if they aren't yet) and
    resolve once the train can play. */
export function sceneReady() {
  loadSceneNow();
  hurrySubway();
  return subwayReady();
}

export function mountBackdrop(el) {
  el.classList.add('backdrop');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="bd-layer bd-subway"><div class="bd-drift"><div class="bd-cam"><img alt="" decoding="async"></div></div></div>
    <div class="bd-layer bd-city"><div class="bd-drift"><div class="bd-cityframe"><img alt="" decoding="async">${billboardLayer()}${towerLights()}</div></div></div>
    <div class="bd-layer bd-p5"><div class="bd-drift" data-later="p5"></div></div>
    <div class="bd-layer bd-graffiti"><div class="bd-drift">${graffitiLayer()}</div></div>
    <div class="bd-layer bd-shards"><div class="bd-drift">${shardLayer()}</div></div>
    <div class="bd-layer bd-tech"><div class="bd-drift" data-later="tech"></div></div>`;

  /* The board's and pages' layers (the P5 shapes, the cut-paper corners) are hidden on the title, so
     they are drawn after it has loaded, in idle time (Nov 19, the speed pass: building every layer up
     front made the title's first task longer), or at once when the visitor leaves the title or
     arrives straight on a page. */
  const fillLater = () => el.querySelectorAll('[data-later]').forEach((d) => {
    d.innerHTML = d.dataset.later === 'p5' ? p5Layer() : techLayer();
    d.removeAttribute('data-later');
  });
  const away = () => ['board', 'page', 'quick'].includes(document.body.dataset.mode);
  if (away()) fillLater();
  else {
    (window.requestIdleCallback || setTimeout)(fillLater, { timeout: 4000 });
    const mo = new MutationObserver(() => { if (away()) { fillLater(); mo.disconnect(); } });
    mo.observe(document.body, { attributes: true, attributeFilter: ['data-mode'] });
  }

  // the city art loads only after the page has painted, sized for the screen, so it never
  // competes with the title text on a phone's first load
  const show = (img, src, tries = 1) => {
    img.onload = () => {
      img.classList.add('in'); // fades in once it's ready, never a half-drawn image
      if (img.parentNode.classList.contains('bd-cam')) stationIn();
      if (img.parentNode.classList.contains('bd-cam')) mountSubway(img.parentNode, img); // trash on the floor + the PRESS START train
    };
    img.onerror = () => { // a dropped connection gets one more try
      if (tries > 0) setTimeout(() => show(img, `${src}?r=1`, tries - 1), 1500);
      else if (img.parentNode.classList.contains('bd-cam')) stationIn();
    };
    img.src = src;
  };
  /* The sharp platform loads when the page has loaded, or 2.5 s after it started, whichever comes
     first, so a slow load event can never keep it away (Nov 19, John: on his phone the title stayed
     black until he tapped; the real culprit was the black loading cover, now gone). Its blurred
     stand-in shows from the very first paint (backdrop.css), so starting the download right away
     isn't needed and would only compete with the page's own code. The city art (not on the title)
     waits for the load event. */
  let subwayLoading = false;
  const loadSubway = () => {
    if (subwayLoading) return;
    subwayLoading = true;
    show(el.querySelector('.bd-subway img'), artSrc('subway'));
  };
  const loadCity = () => {
    loadSubway();
    if (cityLoading) return;
    cityLoading = true;
    show(el.querySelector('.bd-city img'), artSrc('city'));
  };
  loadSceneNow = loadCity;
  loadStationNow = loadSubway;
  setTimeout(loadSubway, 2500);
  const later = () => setTimeout(loadCity, 0);
  if (document.readyState === 'complete') later();
  else window.addEventListener('load', later, { once: true });

  const frame = el.querySelector('.bd-cityframe');
  new ResizeObserver(() => fitBillboard(frame)).observe(frame);
  fitBillboard(frame);
  startTicker(frame.querySelector('.bd-billboard'));

  // tall screens only see a narrow slice of the wall: show its left side (the star)
  // instead of the empty middle
  const tall = window.matchMedia('(max-aspect-ratio: 1/1)');
  const graffiti = el.querySelector('.bd-graffiti svg');
  const fit = () => graffiti.setAttribute('preserveAspectRatio', tall.matches ? 'xMinYMid slice' : 'xMidYMid slice');
  fit();
  tall.addEventListener?.('change', fit);

  if (window.matchMedia('(pointer: fine)').matches) {
    let raf = 0;
    let tx = 0;
    let ty = 0;
    let layers = null;
    window.addEventListener('pointermove', (e) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        // (Nov 21: was --px/--py on the whole backdrop, which re-checked the style of every element in it each move;
        // now each layer's own transform is set: the graphics side just slides the painted layer)
        layers ||= [...el.querySelectorAll('.bd-layer')].map((l) => [l, parseFloat(getComputedStyle(l).getPropertyValue('--amp')) || 0]);
        for (const [l, amp] of layers) l.style.transform = `translate3d(${(-tx * amp).toFixed(2)}px, ${(-ty * amp * 0.5).toFixed(2)}px, 0)`;
      });
    }, { passive: true });
  }
}
