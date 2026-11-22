/* Chapter entrances from the heist-movie world (a case file, comic panels, breaking glass, a night
   street, a security monitor). Each chapter plays its own one however the visitor arrives.
   ~0.7-0.85s each, one beat each, sound on the frame of impact. Every one is skippable (it runs
   through track) and is an instant swap with reduced motion. */
import { gsap } from 'gsap';
import { reducedMotion } from '../core/util.js';
import { ransom } from '../ui/ransom.js';
import { sfx } from '../audio/audio.js';
import { track, shake, snapshotScreen, filmReady, filmImg } from './transitions.js';
import { rectToQuad } from './station.js';
import { artSrc } from './art.js';

function scene(cls, html, label) {
  const el = document.createElement('div');
  el.className = `fxw mw ${cls}`;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = html;
  el.querySelectorAll('[data-label]').forEach((s) => ransom(s, label, label.length + 7));
  document.body.appendChild(el);
  return el;
}
const instant = (swap) => {
  swap();
  return Promise.resolve();
};

/** MISSIONS: a black case file is slammed onto the lens, a red stamp hits it, the cover flips
    open like a folder and the page is inside. */
export function caseWipe(swap, label = 'MISSIONS') {
  if (reducedMotion()) return instant(swap);
  const el = scene('casefile', `<div class="cf-cover"><span class="cf-tab">CASE FILE</span><span class="cf-dots"></span>
      <span class="cf-label ransom" data-label></span><span class="cf-code">FILE 01 · EYES ONLY</span><span class="cf-stamp">CASE OPEN</span></div>`, label);
  const cover = el.firstElementChild;
  const stamp = el.querySelector('.cf-stamp');
  const tl = gsap.timeline({ onComplete: () => el.remove() });
  tl.set(el, { visibility: 'visible' })
    .add(() => sfx('whoosh'), 0)
    // tossed onto the table (the lens) from below, spinning a little
    .fromTo(cover, { yPercent: 120, xPercent: 18, rotation: 14, scale: 0.8 }, { yPercent: 0, xPercent: 0, rotation: -2, scale: 1, duration: 0.26, ease: 'power3.in' }, 0)
    .add(() => {
      sfx('thwack');
      shake(cover);
    }, 0.26)
    .add(swap, 0.3)
    // the stamp: a whip-fast slam
    .fromTo(stamp, { scale: 2.6, opacity: 0, rotation: -24 }, { scale: 1, opacity: 1, rotation: -12, duration: 0.12, ease: 'power4.in' }, 0.3)
    .add(() => sfx('stamp'), 0.42)
    // the folder opens: the cover swings away on its spine
    .to(cover, { rotationY: -100, transformPerspective: 1400, duration: 0.34, ease: 'power3.in' }, 0.55)
    .add(() => sfx('flip'), 0.56);
  return track(tl);
}

/** MY EDGE (the comic page): the screen breaks into slanted comic panels that punch in one after
    another, the title in the middle, then they fly apart to show the page. */
export function panelsWipe(swap, label = 'MY EDGE') {
  if (reducedMotion()) return instant(swap);
  const el = scene('panels', `<i class="pn-gut"></i><i class="pn p1"></i><i class="pn p2"></i><i class="pn p3"></i><i class="pn p4"></i>
      <span class="pn-title ransom" data-label></span>`, label);
  const gut = el.querySelector('.pn-gut');
  const pans = el.querySelectorAll('.pn');
  const title = el.querySelector('.pn-title');
  const from = [[-60, -40], [60, -40], [-60, 40], [60, 40]];
  const tl = gsap.timeline({ onComplete: () => el.remove() });
  tl.set(el, { visibility: 'visible' })
    .fromTo(gut, { opacity: 0 }, { opacity: 1, duration: 0.08 }, 0.12)
    .fromTo(pans, { x: (i) => `${from[i][0]}vw`, y: (i) => `${from[i][1]}vh`, scale: 1.3, rotation: (i) => (i % 2 ? 8 : -8) },
      { x: 0, y: 0, scale: 1, rotation: 0, duration: 0.18, ease: 'power3.in', stagger: 0.05 }, 0)
    .add(() => sfx('thwack', 0.6), 0.18)
    .add(() => sfx('thwack', 0.8), 0.33)
    .fromTo(title, { scale: 2.4, opacity: 0, rotation: -14 }, { scale: 1, opacity: 1, rotation: -5, duration: 0.14, ease: 'back.out(2)' }, 0.32)
    .add(swap, 0.36)
    .add(() => sfx('whoosh'), 0.56)
    .to(title, { scale: 0.6, opacity: 0, duration: 0.12, ease: 'power2.in' }, 0.56)
    .set(gut, { opacity: 0 }, 0.58)
    .to(pans, { x: (i) => `${from[i][0] * 1.4}vw`, y: (i) => `${from[i][1] * 1.4}vh`, rotation: (i) => (i % 2 ? -10 : 10), duration: 0.26, ease: 'power3.in', stagger: 0.03 }, 0.56);
  return track(tl);
}

/** STATS: the screen takes a hit like a pane of glass. Cracks spider out from the impact, then the
    whole page shatters and its pieces fall away, showing the new page behind it. */
export function glassWipe(swap) {
  if (reducedMotion()) return instant(swap);
  const W = window.innerWidth;
  const H = window.innerHeight;
  const c = { x: W * 0.56, y: H * 0.44 }; // the impact
  const R = Math.hypot(W, H);
  const N = 9;
  const ang = Array.from({ length: N }, (_, i) => (i / N) * Math.PI * 2 + ((i * 37) % 10) / 30);
  const at = (a, r) => [c.x + Math.cos(a) * r, c.y + Math.sin(a) * r];
  const P = ([x, y]) => `${x.toFixed(0)}px ${y.toFixed(0)}px`;
  // cracks: rays out from the impact plus two broken rings, drawn as white glints with a dark edge
  const rays = ang.map((a) => `M${c.x.toFixed(0)} ${c.y.toFixed(0)} L${at(a + 0.05, R * 0.3).map((v) => v.toFixed(0)).join(' ')} L${at(a - 0.03, R).map((v) => v.toFixed(0)).join(' ')}`);
  const ring = (r) => `M${ang.map((a, i) => at(a + (i % 2 ? 0.04 : -0.04), r * (0.85 + (i % 3) * 0.12)).map((v) => v.toFixed(0)).join(' ')).join(' L')} Z`;
  const cracks = [...rays, ring(Math.min(W, H) * 0.12), ring(Math.min(W, H) * 0.3)];
  const el = document.createElement('div');
  el.className = 'fxw mw glass';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `${ang.map(() => '<div class="gl-shard"><i class="gl-shine"></i></div>').join('')}
    <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${cracks.map((d) => `<path class="gl-crack" d="${d}"/>`).join('')}</svg><i class="gl-hit"></i>`;
  const shards = [...el.querySelectorAll('.gl-shard')];
  shards.forEach((sh, i) => {
    sh.style.clipPath = `polygon(${P([c.x, c.y])}, ${P(at(ang[i], R))}, ${P(at(ang[(i + 1) % N], R))})`;
    const snap = snapshotScreen();
    sh.prepend(snap.frag);
    sh.settle = snap.settle;
  });
  const hit = el.querySelector('.gl-hit');
  gsap.set(hit, { left: c.x, top: c.y });
  document.body.appendChild(el);
  shards.forEach((sh) => sh.settle());
  const paths = el.querySelectorAll('.gl-crack');
  paths.forEach((p) => {
    const L = p.getTotalLength();
    gsap.set(p, { strokeDasharray: L, strokeDashoffset: L });
  });
  const tl = gsap.timeline({ onComplete: () => el.remove() });
  tl.set(el, { visibility: 'visible' })
    .add(() => sfx('crack'), 0)
    .fromTo(hit, { scale: 0, opacity: 1 }, { scale: 1, duration: 0.08, ease: 'power3.out' }, 0)
    .to(hit, { opacity: 0, duration: 0.12 }, 0.12)
    .to(paths, { strokeDashoffset: 0, duration: 0.16, ease: 'power3.out', stagger: 0.012 }, 0.02)
    .add(() => shake(el), 0.04)
    // a beat with the cracked screen, then it gives way
    .add(swap, 0.34)
    .add(() => sfx('shatter'), 0.34)
    .set(paths, { opacity: 0 }, 0.36)
    .to(shards, {
      x: (i) => Math.cos(ang[i] + Math.PI / N) * W * 0.18,
      y: (i) => H * (0.9 + (i % 3) * 0.25),
      rotation: (i) => (i % 2 ? 1 : -1) * (12 + (i % 4) * 9),
      scale: (i) => 0.92 - (i % 3) * 0.05,
      transformOrigin: () => `${c.x}px ${c.y}px`,
      duration: 0.5,
      ease: 'power2.in',
      stagger: { each: 0.025, from: 'random' },
    }, 0.34);
  return track(tl);
}

/* THE SQUARE (Nov 20, John: "make it look like an actual billboard instead of a poster in front of a
   building... the middle of a Tokyo square with other mini advertisements, our star design, our name, our
   philosophy, filler billboards... the biggest one in the middle is SIDE QUESTS... digital, attached to the
   building with the same textures"). An original scramble-crossing square at night (Gemini, Nano Banana
   Pro, in the station's toon style), its nine video screens painted INTO the buildings (bezels, frames,
   brackets) and keyed out (square.webp, 2752 x 1536, the screen faces clear). Live LED content sits BEHIND
   the picture, each screen's content mapped onto its measured four corners (rectToQuad) with a little
   overscan, so the painted bezels frame it like real hardware; a soft glow of each screen's own colour is
   added on top (screen blend), so its light spills onto the frame and the wall. The stage is the picture's
   own 1376 x 768 space, scaled to cover the screen and kept on the big screen; the camera pushes into
   SIDE QUESTS until it fills the frame, a flash, the page. */
const SQ_W = 1376;
const SQ_H = 768;
const SQ_SCREENS = [ // [id, TL, TR, BR, BL] in the picture's own px, and the ad each screen plays
  ['main', [598, 260], [828, 241], [831, 395], [594, 404]],
  ['time', [1143, 246], [1223, 228], [1246, 473], [1160, 479]],
  ['name', [204, 213], [332, 228], [327, 287], [197, 276]],
  ['star', [206, 312], [319, 293], [307, 369], [200, 382]],
  ['proof', [1176, 524], [1279, 518], [1286, 587], [1180, 587]],
  ['motto', [371, 382], [478, 390], [476, 445], [366, 441]],
  ['stripes', [1322, 245], [1400, 233], [1400, 357], [1334, 357]],
  ['checks', [411, 480], [462, 485], [459, 559], [408, 558]],
  ['jn', [480, 328], [537, 332], [535, 388], [480, 388]],
];
const SQ_ADS = {
  main: '<div class="sq-bar"><div class="sq-bar-run"><span>NOW SHOWING</span></div></div><span class="sq-label ransom" data-label></span><i class="sq-slash"></i>',
  time: '<b class="sq-look">LOOK</b><b class="sq-big">CLOSER</b><i class="sq-eye"></i>',
  name: '<b class="sq-wanted">WANTED</b><b class="sq-john">JOHN</b><b class="sq-ng">NGUYEN</b>',
  star: '<i class="sq-starmark"></i>',
  proof: '<div class="sq-tick"><b>STEAL</b><b><em>THE SHOW</em> ★</b></div>',
  motto: '<b>BREAK THE</b><b class="sq-red" data-t="ROUTINE">ROUTINE</b>',
  stripes: '<i class="sq-run"></i>',
  checks: '<b class="sq-sm">NEW</b><b class="sq-big">?</b><b class="sq-sm">LEAD</b>',
  jn: '<b class="sq-big">JN</b><i class="sq-sweep"></i>',
};
const SQ_FS = { main: 1, time: 1.45, name: 0.9, star: 1, proof: 1.15, motto: 1.25, stripes: 1, checks: 1.75, jn: 1 }; // (text size per screen)
const sqGrow = (q, k) => { // the quad grown about its centre (overscan, hidden under the bezel)
  const cx = q.reduce((t, p) => t + p[0], 0) / 4;
  const cy = q.reduce((t, p) => t + p[1], 0) / 4;
  return q.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
};
const sqSize = (q) => [(Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]) + Math.hypot(q[2][0] - q[3][0], q[2][1] - q[3][1])) / 2,
  (Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]) + Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1])) / 2];
export async function cityWipe(swap, label = 'SIDE QUESTS') {
  if (reducedMotion()) return instant(swap);
  await filmReady(['square']);
  const screens = SQ_SCREENS.map(([id, ...q]) => {
    const g = sqGrow(q, 1.05);
    const [w, h] = sqSize(g);
    return { id, q, g, w, h, tf: rectToQuad(w, h, g) };
  });
  const scr = screens.map((s) => `<div class="sq-scr sq-${s.id}" style="width:${s.w.toFixed(1)}px;height:${s.h.toFixed(1)}px;font-size:${((Math.min(s.w, s.h * 1.6) / 10) * SQ_FS[s.id]).toFixed(2)}px;transform:${s.tf}">${SQ_ADS[s.id]}</div>`).join('');
  const glow = screens.map((s) => `<i class="sq-glow sq-g-${s.id}" style="width:${s.w.toFixed(1)}px;height:${s.h.toFixed(1)}px;transform:${s.tf}"></i>`).join('');
  const el = scene('citylife sqr', `<div class="sq-stage">${scr}<span class="sq-art"></span>${glow}<div class="cl-trails">${'<i></i>'.repeat(8)}</div></div><i class="cl-flash"></i>`, label);
  const stage = el.querySelector('.sq-stage');
  el.querySelector('.sq-art').replaceWith(filmImg('square', 'sq-img'));
  const flash = el.querySelector('.cl-flash');
  const trails = el.querySelectorAll('.cl-trails i');
  trails.forEach((t, i) => {
    gsap.set(t, { top: 624 + ((i * 11) % 60), width: 180 + ((i * 53) % 260) });
    if (i % 3 === 0) t.classList.add('red'); // taillights; the rest are headlights
    if (i % 2 === 0) t.classList.add('rev'); // (these run leftward: their lamp end is on the left)
  });
  // where the camera starts (the picture covering the screen, the big screen centred as far as it can be)
  // and where it ends (inside the big screen, filling the frame)
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const main = screens[0];
  const mx = main.q.reduce((t, p) => t + p[0], 0) / 4;
  const my = main.q.reduce((t, p) => t + p[1], 0) / 4;
  const s0 = Math.max(vw / SQ_W, vh / SQ_H);
  const narrow = vw / vh < 1;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const x0 = clamp(vw / 2 - mx * s0, vw - SQ_W * s0, 0);
  const y0 = clamp(vh / 2 - my * s0, vh - SQ_H * s0, 0);
  const [mw, mh] = sqSize(main.q);
  const s1 = Math.max(vw / mw, vh / mh) * 1.12;
  const x1 = vw / 2 - mx * s1;
  const y1 = vh / 2 - my * s1;
  const scrs = el.querySelectorAll('.sq-scr');
  const glows = el.querySelectorAll('.sq-glow');
  const tl = gsap.timeline({ onComplete: () => el.remove() });
  tl.set(el, { visibility: 'visible' })
    .set(stage, { transformOrigin: '0 0', x: x0, y: y0, scale: s0 }, 0)
    // a phone held upright sees one building at a time: the camera pans across the ads on the left first
    .fromTo(stage, { x: narrow ? clamp(vw / 2 - 330 * s0, vw - SQ_W * s0, 0) : x0 }, { x: x0, duration: narrow ? 0.4 : 0.01, ease: 'power3.out' }, 0.02)
    .add(() => { sfx('city'); sfx('street'); }, 0) // (a car passing, and the square's busy street life)
    .fromTo(stage, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: 'power2.out' }, 0)
    // headlights and taillights streaking along the street, both ways
    .fromTo(trails, { x: (i) => (i % 2 ? -400 : SQ_W + 100) }, { x: (i) => (i % 2 ? SQ_W + 100 : -400), duration: 0.6, ease: 'none', stagger: 0.04, repeat: 2 }, 0)
    // the screens switch on, one after another, the big one last (a stepped flicker, like LED panels)
    // (the small ads first, quickly, so a phone's pan finds them lit; the big screen last, the beat before the push)
    .fromTo([...scrs].slice(1), { opacity: 0 }, { opacity: 1, duration: 0.08, ease: 'steps(3)', stagger: 0.018 }, 0.02)
    .fromTo([...glows].slice(1), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.08, ease: 'steps(3)', stagger: 0.018 }, 0.02)
    .fromTo([scrs[0], glows[0]], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.12, ease: 'steps(4)' }, 0.22)
    .add(() => sfx('buzz'), 0.2)
    // a beat to read the square, then the camera drifts in, slowly at first, so SIDE QUESTS can be read the
    // whole way (Nov 21, John: "make the zoom in to the big ad slower so users can read it"), and only
    // speeds up at the very end, into the flash
    .to(stage, { x: x1, y: y1, scale: s1, duration: 1.05, ease: 'power2.in' }, 0.8)
    .fromTo(flash, { opacity: 0 }, { opacity: 1, duration: 0.07 }, 1.8)
    .add(() => {
      swap();
      sfx('thwack', 0.7);
    }, 1.85)
    .set(stage, { opacity: 0 }, 1.85)
    .to(flash, { opacity: 0, duration: 0.22, ease: 'power2.out' }, 1.87);
  return track(tl);
}

/** SETTINGS (the control room): the screen snaps off like an old security monitor (collapse to
    a line, a dot), then switches back on to the new page with a burst of static. */
export function crtWipe(swap, label = 'SETTINGS') {
  if (reducedMotion()) return instant(swap);
  const el = scene('crt', `<i class="crt-t"></i><i class="crt-b"></i><i class="crt-line"></i><i class="crt-static"></i>
      <span class="crt-rec">REC · CAM 07</span><span class="crt-label ransom" data-label></span>`, label);
  const [top, bot, beam, stat, rec, lab] = el.children;
  const tl = gsap.timeline({ onComplete: () => el.remove() });
  tl.set(el, { visibility: 'visible' })
    .add(() => sfx('crtOff'), 0)
    // off: black closes from top and bottom to a bright line, the line to a dot, the dot is gone
    .fromTo([top, bot], { scaleY: 0 }, { scaleY: 1, duration: 0.16, ease: 'power4.in' }, 0)
    .fromTo(beam, { scaleY: 0.2, scaleX: 1, opacity: 1 }, { scaleY: 1, duration: 0.06 }, 0.14)
    .to(beam, { scaleX: 0.004, duration: 0.14, ease: 'power3.in' }, 0.2)
    .to(beam, { opacity: 0, duration: 0.06 }, 0.34)
    .add(swap, 0.36)
    // on: a burst of static and the camera overlay, then the picture opens from the middle
    .add(() => sfx('crtOn'), 0.42)
    .fromTo(stat, { opacity: 0 }, { opacity: 0.85, duration: 0.04, yoyo: true, repeat: 3 }, 0.42)
    .fromTo([rec, lab], { opacity: 0 }, { opacity: 1, duration: 0.02 }, 0.42)
    .to([rec, lab], { opacity: 0, duration: 0.05 }, 0.66)
    .to([top, bot], { scaleY: 0, duration: 0.2, ease: 'power3.out' }, 0.6);
  return track(tl);
}
