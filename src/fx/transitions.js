import { gsap } from 'gsap';
import { $, reducedMotion } from '../core/util.js';
import { ransom, NAME_SEED } from '../ui/ransom.js';
import { burst } from './impact.js';
import { sfx, hush } from '../audio/audio.js';
import { trainShot, preloadSubway, NOSE_PASS, BURST, SHOT_END, shotSound } from './subway.js';
import { artSrc } from './art.js';
import { isZoomed } from '../core/zoom.js';

/* Every big animation runs through here so ONE click / Esc can skip it. */
let current = null;

export function skipCurrent() {
  if (current && current.isActive()) {
    hush(); // a skipped shot takes its sound with it
    current.progress(1);
    return true;
  }
  return false;
}

export const isAnimating = () => Boolean(current && current.isActive());

/* a visible SKIP cue while a film shot runs (Nov 22, launch prep: the shots were always skippable by a tap, Enter, Space or Esc,
   but nothing said so). Only for shots of a second or more; it leaves the moment the shot ends. */
let skipChip = null;
function showSkip(tl) {
  if (tl.duration() < 1 || tl.progress() === 1) return;
  skipChip?.remove();
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'skip-chip'; b.innerHTML = 'SKIP <span aria-hidden="true">▸</span>';
  b.setAttribute('aria-label', 'Skip the animation');
  b.addEventListener('click', (e) => { e.stopPropagation(); skipCurrent(); });
  document.body.appendChild(b); skipChip = b;
  const done = () => { if (skipChip === b) skipChip = null; b.remove(); };
  tl.eventCallback('onInterrupt', done);
  return done;
}

export function track(tl) {
  current = tl;
  const hideSkip = showSkip(tl);
  return new Promise((resolve) => {
    const own = tl.eventCallback('onComplete');
    tl.eventCallback('onComplete', () => {
      hideSkip?.();
      own?.();
      resolve();
    });
    if (tl.progress() === 1) resolve();
    else if (isZoomed()) Promise.resolve().then(() => { if (tl.progress() < 1) { hush(); tl.progress(1); } }); // (started under a pinch zoom: it goes straight to its end, see src/core/zoom.js; a zoom during a shot does the same from main.js)
  });
}

/** Whip-pan landing: the new screen arrives from the side with skew, overshoots and settles. */
function whipIn(el, dir) {
  if (!el || el.id === 'screen-board') return; // the board has its own slam-in reveal
  gsap.fromTo(el, { x: 90 * dir, skewX: -10 * dir, scale: 1.04, transformOrigin: '50% 50%' },
    { x: 0, skewX: 0, scale: 1, duration: 0.42, ease: 'back.out(1.7)', clearProps: 'transform' });
}

/** Layered depth during a whip: wall, graffiti and shards slide at different speeds
    (separate `translate` property, so pointer parallax transforms are untouched). */
function parallaxWhip(dir) {
  const layers = document.querySelectorAll('#backdrop .bd-layer');
  [40, 110, 220].forEach((px, i) => {
    layers[i]?.animate?.(
      [{ translate: '0 0' }, { translate: `${-px * dir}px 0` }, { translate: `${px * 0.12 * dir}px 0` }, { translate: '0 0' }],
      { duration: 620, easing: 'cubic-bezier(.2,.8,.2,1)', offsets: [0, 0.38, 0.75, 1] }
    );
  });
}

let wipeDir = 1;
/** Three-layer diagonal slash (red lead, black cover, white streak) + a spinning star riding
    the leading edge. The eye follows the star while the screen swaps underneath (misdirection);
    the old screen whips out, the new one whips in, the wall moves in depth layers. (~0.6s) */
export function slashWipe(swap) {
  if (reducedMotion()) {
    swap();
    return Promise.resolve();
  }
  const dir = (wipeDir *= -1) * -1; // alternate direction each time
  const wipe = $('.wipe');
  const black = $('.wipe-black');
  const red = $('.wipe-red');
  const white = $('.wipe-white');
  const star = $('.wipe-star');
  const old = $('.screen.active');
  wipe.classList.toggle('rev', dir < 0);
  const X = (v) => v * dir;
  const tl = gsap.timeline();
  tl.set(wipe, { visibility: 'visible' })
    .add(() => {
      sfx('swish');
      parallaxWhip(dir);
    }, 0)
    .to(old, { x: X(-120), skewX: X(12), duration: 0.22, ease: 'power3.in' }, 0)
    .fromTo(red, { xPercent: X(-140) }, { xPercent: X(4), duration: 0.2, ease: 'expo.in' }, 0)
    .fromTo(black, { xPercent: X(-120) }, { xPercent: 0, duration: 0.22, ease: 'expo.in' }, 0.04)
    .fromTo(star, { x: X(-0.7) * window.innerWidth, y: window.innerHeight * 0.18, rotation: 0, scale: 0.6 },
      { x: X(0.75) * window.innerWidth, y: -window.innerHeight * 0.12, rotation: X(720), scale: 1.25, duration: 0.5, ease: 'power4.inOut' }, 0.02) // (steep: a whip, not a glide)
    .fromTo(white, { xPercent: X(-150) }, { xPercent: X(150), duration: 0.24, ease: 'power4.inOut' }, 0.12)
    .add(() => {
      if (old) gsap.set(old, { clearProps: 'transform' });
      swap();
      sfx('thwack', 0.6);
      whipIn($('.screen.active'), dir);
    }, 0.27)
    .to(black, { xPercent: X(120), duration: 0.3, ease: 'expo.out' }, 0.31)
    .to(red, { xPercent: X(140), duration: 0.34, ease: 'expo.out' }, 0.34)
    .set(wipe, { visibility: 'hidden' });
  return track(tl);
}

/** Starburst + rays + huge tilted title that slams in, shakes and zooms away. (~0.55s) */
export function titlePunch(text) {
  if (reducedMotion()) return Promise.resolve();
  const punch = $('.punch');
  const star = $('.punch-star');
  const rays = $('.punch-rays');
  $('#punchText').textContent = text;
  const tl = gsap.timeline();
  tl.set(punch, { visibility: 'visible', opacity: 1, scale: 1 })
    .set(rays, { opacity: 1, scaleY: 1 }, 0)
    .fromTo(star, { scale: 0.1, rotation: -40 }, { scale: 1, rotation: 0, duration: 0.14, ease: 'expo.out' }, 0.03)
    .fromTo('#punchText', { scale: 3.2, rotation: -22, x: 0 }, { scale: 1, rotation: -8, duration: 0.14, ease: 'power4.in' }, 0.06)
    .add(() => {
      sfx('thwack');
      shake(punch);
    }, 0.2)
    .to('#punchText', { scale: 1.08, duration: 0.06, ease: 'power2.out' }, 0.2)
    .to('#punchText', { scale: 1, duration: 0.12, ease: 'back.out(3)' }, 0.26)
    // exit: text whips off, star collapses, rays snap shut. No fades.
    .to('#punchText', { x: -window.innerWidth, skewX: 25, duration: 0.16, ease: 'power3.in' }, 0.44)
    .to(star, { scale: 0, rotation: 60, duration: 0.15, ease: 'power3.in' }, 0.46)
    .to(rays, { scaleY: 0, duration: 0.12, ease: 'power3.in' }, 0.5)
    .set(punch, { visibility: 'hidden' })
    .set('#punchText', { x: 0, skewX: 0 });
  return track(tl);
}

/** Name strip (ransom letters) that slashes across for big moments. (~0.5s) */
export function cutIn(text = '') {
  if (reducedMotion()) return Promise.resolve();
  const wrap = $('.cutin');
  const holder = $('#cutinEyes');
  holder.innerHTML = '<div class="ransom cutin-name"></div>';
  ransom(holder.firstChild, 'JOHN', NAME_SEED);
  $('#cutinText').textContent = text;
  const tl = gsap.timeline();
  tl.set(wrap, { visibility: 'visible' })
    .fromTo('.cutin-strip', { xPercent: -120, scaleY: 0.1 }, { xPercent: 0, scaleY: 1, duration: 0.15, ease: 'expo.out' })
    .fromTo('.cutin-flash', { opacity: 0.9 }, { opacity: 0, duration: 0.2, ease: 'power2.out' }, 0.1)
    .fromTo('#cutinText', { x: 160, skewX: -20, opacity: 0 }, { x: 0, skewX: 0, opacity: 1, duration: 0.16, ease: 'expo.out' }, 0.08)
    .fromTo('#cutinEyes', { x: -30 }, { x: 10, duration: 0.45, ease: 'none' }, 0.1)
    .add(() => {
      sfx('thwack', 0.8);
      shake($('.screen.active') || document.body);
    }, 0.12)
    .to('.cutin-strip', { xPercent: 130, scaleY: 0.3, duration: 0.16, ease: 'expo.in' }, '+=0.22')
    .set(wrap, { visibility: 'hidden' });
  return track(tl);
}

/** PRESS START: the opening shot comes alive. Headlights in the dark tunnel and a rumble, the
    horn, then the train bursts out and roars past along the platform, braking: the camera rumbles
    and thumps, its headlights wash the track, brake sparks spray from the wheels, its wind lifts
    the dust, blows the trash and the title away, and a white star-flash cuts to the board. */
export function tunnelWipe(swap) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  // tall screens only see the platform's middle: the camera pans left to catch the track
  const shot = trainShot({ panTo: W / H < 1.1 ? 0.3 : null });
  if (!shot) {
    swap();
    return Promise.resolve();
  }
  const el = document.createElement('div');
  el.className = 'fall tunnel';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<div class="fall-flash"></div>${LETTERBOX}`;
  document.body.appendChild(el);
  const bars = el.querySelectorAll('.lb');
  const flash = el.querySelector('.fall-flash');
  const cam = $('#backdrop');
  const screen = $('#screen-title');
  const title = screen.querySelector('.title-block');
  const card = screen.querySelector('.cc'); // the CONNECT card goes with the wind too
  const cal = document.querySelector('#hudDate .hud-cal'); // and the calendar sticker
  const clock = { t: 0 };
  // THE BURST (Nov 22, John: "pop out impactfully... faster... longer... a surprise", see subway.js): half a second of a
  // still station, the nose breaks out of the tunnel at BURST and is at the camera at NOSE_PASS, then seven cars storm past,
  // braking, until the cut at SHOT_END
  const SWAP = SHOT_END;
  // the blast of air out of the tunnel takes the title: it leaves as the train breaks out, so the nose never has to come
  // through it (timed to the nose's pass, as before, it was still on screen when the train reached the camera: 0.43 s is too short)
  const B = BURST + 0.06;
  const wall = [...document.querySelectorAll('#backdrop .bd-graffiti, #backdrop .bd-shards')]; // the poster, the arrow, the glass
  const posters = wall.map((l) => l.firstElementChild);
  const blown = [];

  // the shot runs on the real clock: on a slow device it drops frames but stays on time, instead of
  // GSAP's lag smoothing turning every slow frame into slow motion (a 1.8 s pass took 10 s at 10x CPU)
  gsap.ticker.lagSmoothing(0);
  const tl = gsap.timeline({
    onComplete: () => {
      gsap.ticker.lagSmoothing(500, 33);
      shot.end();
      cam.style.translate = '';
      cam.style.scale = '';
      screen.style.translate = '';
      gsap.set([title, card, cal].filter(Boolean), { clearProps: 'transform,opacity,visibility' });
      el.remove();
    },
  });
  tl.set(el, { visibility: 'visible' });
  barsIn(tl, bars);
  tl.add(() => sfx('tunnel', shotSound()), 0)
    .to(clock, {
      t: SWAP,
      duration: SWAP,
      ease: 'none',
      onUpdate: () => {
        const t = clock.t;
        shot.tick(t, { rumble: Math.min(1, t / 0.5), panP: gsap.parseEase('power3.out')(Math.min(1, t / 0.5)) }); // (a whip pan that settles: off at once, decisive stop; the floaty in-out curve is not our motion)
        // a heavy train: a deep rumble that swells as it comes, a thump per wheel set, the air
        // wall's shove as the nose passes (never a random buzz: that read as weightless)
        const m = shot.motion(t);
        cam.style.translate = `${m.x.toFixed(1)}px ${m.y.toFixed(1)}px`;
        cam.style.scale = m.s.toFixed(4);
        screen.style.translate = `${(m.x * 0.6).toFixed(1)}px ${(m.y * 0.6).toFixed(1)}px`;
      },
    }, 0)
    // the still beat before the burst: the title steps back and dims at once, so the eye is on the dark tunnel when the
    // train breaks out of it (it used to dim as the headlights appeared: at this speed that is too late to be seen)
    .to([title, card].filter(Boolean), { opacity: 0.38, scale: 0.97, duration: 0.3, ease: 'power2.out' }, 0.08)
    .to(wall, { opacity: 0.4, duration: 0.3, ease: 'power2.out' }, 0.08)
    // its wind takes the title with it, and rips the posters off the wall
    .to(title, { x: -W * 0.75, y: H * 0.15, rotation: -26, skewX: 16, autoAlpha: 0, duration: 0.3, ease: 'power2.in' }, B)
    .to(card, { x: -W * 0.9, y: -H * 0.05, rotation: -40, skewX: 12, autoAlpha: 0, duration: 0.32, ease: 'power2.in' }, B + 0.04)
    .to([cal].filter(Boolean), { x: -W * 0.4, y: -H * 0.2, rotation: -30, autoAlpha: 0, duration: 0.3, ease: 'power2.in' }, B + 0.06)
    .add(() => posters.forEach((p, i) => blown.push(p.animate(
      [{ translate: '0 0', rotate: '0deg', opacity: 1 }, { translate: `${-W * (0.9 + i * 0.3)}px ${H * (0.1 - i * 0.12)}px`, rotate: `${-34 + i * 50}deg`, opacity: 0 }],
      { duration: 380, delay: i * 50, easing: 'cubic-bezier(.55,0,.9,.5)', fill: 'forwards' }
    ))), B + 0.06)
    // the cut: white star-flash, swap, clear
    .fromTo(flash, { scale: 0, rotation: -40, opacity: 1 }, { scale: 3.2, rotation: 0, duration: 0.2, ease: 'power3.in' }, SWAP - 0.2)
    .add(() => {
      shot.end(); // the platform is gone the instant the flash covers it
      blown.forEach((a) => a.cancel()); // posters back on the wall, unseen behind the flash
      gsap.set(wall, { clearProps: 'opacity' }); // (the board's own rules hide the wall art)
      swap();
      sfx('thwack');
    }, SWAP)
    .to(bars, { scaleY: 0, duration: 0.2, ease: 'power2.in' }, SWAP)
    .to(flash, { opacity: 0, duration: 0.22, ease: 'power2.out' }, SWAP + 0.02);
  return track(tl);
}

/** Stagger children marked [data-in] into view. */
export function enter(root) {
  const items = root.querySelectorAll('[data-in]');
  if (reducedMotion() || !items.length) return gsap.timeline();
  return gsap.from(items, { y: 80, x: -60, scale: 0.85, rotation: -5, autoAlpha: 0, duration: 0.3, ease: 'back.out(2.6)', stagger: 0.05, clearProps: 'transform,opacity,visibility' });
}

/** Small screen shake. */
export function shake(el = document.body) {
  if (reducedMotion()) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}



/* ---------------------------------------------------------------------------------
   Variety: not every move uses the slash. Each kind of destination has its own wipe.
   --------------------------------------------------------------------------------- */
function layer(cls, html) {
  let el = document.querySelector(`.${cls}`);
  if (!el) {
    el = document.createElement('div');
    el.className = `fxw ${cls}`;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = html;
    document.body.appendChild(el);
  }
  return el;
}

/** PAPER (Quick View): a white sheet with a torn top edge slides up over the screen and off. (~0.65s) */
export function paperWipe(swap) {
  if (reducedMotion()) {
    swap();
    return Promise.resolve();
  }
  const el = layer('paperw', '<div class="paperw-sheet"><span class="paperw-lines"></span></div>');
  const sheet = el.firstElementChild;
  const tl = gsap.timeline();
  tl.set(el, { visibility: 'visible' })
    .add(() => sfx('paper'), 0)
    .fromTo(sheet, { yPercent: 115, rotation: 4 }, { yPercent: 0, rotation: 0, duration: 0.26, ease: 'power3.in' }, 0)
    .add(() => {
      swap();
      sfx('thunk');
    }, 0.27)
    .to(sheet, { yPercent: -120, rotation: -3, duration: 0.32, ease: 'expo.in' }, 0.34)
    .set(el, { visibility: 'hidden' });
  return track(tl);
}

/* ---------------------------------------------------------------------------------
   THE DROP (board -> page, and "next episode"): a short film cut, studied from how
   Lusion stages its scroll story (frame flies at the camera, the world opens up, the
   camera travels through a scene, a title passes, a hard landing).
   1. the screen you are on rushes at you and splits in two along a jagged seam
   2. behind it: a grayed-out city at dusk, you are on a rooftop
   3. you drop: a dark tower of windows streams past, speed lines, the next
      chapter's name rides the fall like a building sign
   4. a white star-flash lands you on the next page, which builds in as it clears
   (~1.3s, skippable with any click or Esc; instant with reduced motion)
   --------------------------------------------------------------------------------- */

/** Copy of whatever is on screen right now (backdrop + active screen + HUD), for splitting. */
export function snapshotScreen() {
  const src = document.querySelector('.screen.active');
  const frag = document.createElement('div');
  frag.className = 'rip-page';
  let screenCopy = null;
  [$('#backdrop'), src, $('.hud-tl'), $('.hud-tr')].filter(Boolean).forEach((el) => {
    const copy = el.cloneNode(true);
    if (copy.classList.contains('screen')) {
      copy.classList.replace('screen', 'rip-screen'); // stay out of screen switching
      screenCopy = copy;
    }
    copy.querySelectorAll('button, a').forEach((b) => b.setAttribute('tabindex', '-1'));
    frag.appendChild(copy);
  });
  // a clone starts scrolled to the top: put it where the visitor actually was
  return { frag, settle: () => screenCopy && src && (screenCopy.scrollTop = src.scrollTop) };
}

/* ---- the city set pieces (public/assets/film): original art generated with Google's Nano Banana
   (gemini-2.5-flash-image) to John's brief and approved by him: a low-angle look up at the towers
   against a red sky, the tower's crown, its glass facade, and the subway car. WebP, loaded while idle. */
const FILM = { upshot: artSrc('city'), facade: 'assets/film/facade.webp', crown: 'assets/film/crown.webp', train: 'assets/film/train.webp', interior: 'assets/film/interior.webp', square: 'assets/film/square.webp' };
const filmCache = {};
const decoded = {};
export function preloadFilm() {
  if (Object.keys(filmCache).length) return;
  preloadSubway();
  Object.entries(FILM).forEach(([key, src]) => {
    const img = new Image();
    img.decoding = 'async';
    img.alt = '';
    img.src = src;
    filmCache[key] = img; // keep a reference so the browser keeps it decoded
    decoded[key] = (img.decode ? img.decode() : Promise.reject(new Error('no decode'))).catch(() => new Promise((r) => {
      if (img.complete) r(); else { img.onload = r; img.onerror = r; }
    }));
  });
}
/* A film cut never plays with a missing picture (Nov 19, John: NEXT STOP played "but the train car
   didn't even go through"): it waits for its art to be decoded, at most `ms`, before it starts. */
export function filmReady(keys, ms = 1500) {
  preloadFilm();
  return Promise.race([Promise.all(keys.map((k) => decoded[k])), new Promise((r) => setTimeout(r, ms))]);
}
/* the cached, already-decoded picture (a fresh <img> would decode again and show up late) */
export function filmImg(key, cls) {
  const img = filmCache[key];
  img.className = cls;
  return img;
}

/* Film letterbox: two black bars close in at the start of every film cut and open as it lands,
   so each cut reads as a movie shot, not a page effect. */
const LETTERBOX = '<i class="lb lb-t"></i><i class="lb lb-b"></i>';
const barsIn = (tl, bars) => tl.fromTo(bars, { scaleY: 0 }, { scaleY: 1, duration: 0.16, ease: 'power3.out' }, 0);

/** The city set for THE DROP and THE RISE: the low-angle red-sky city, the tower (crown + facade),
    speed lines, a chapter sign and the white star-flash used to cut to the next screen. */
function citySet(label, extra = '') {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const TW = Math.round(Math.min(W * 0.92, 1100));
  const TH = Math.round(TW * 1.75 + H * 2.4); // the crown art (900x1575) on top, then ~2.4 screens of facade
  const el = document.createElement('div');
  el.className = 'fall';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<div class="fall-city">
      <div class="fall-sky"></div>
      <div class="fall-tower" style="width:${TW}px;height:${TH}px"><div class="ft-face" style="background-image:url(${FILM.facade})"></div></div>
      <div class="fall-lines">${'<i></i>'.repeat(14)}</div>
      <div class="fall-sign"><span class="ransom"></span></div>
    </div>${extra}
    <div class="fall-flash"></div>${LETTERBOX}`;
  ransom(el.querySelector('.fall-sign span'), label, label.length);
  const q = (sel) => el.querySelector(sel);
  q('.fall-sky').appendChild(filmImg('upshot', 'fs-art'));
  q('.fall-tower').prepend(filmImg('crown', 'ft-crown'));
  const lines = el.querySelectorAll('.fall-lines i');
  lines.forEach((l, i) => gsap.set(l, { left: `${6 + ((i * 41) % 88)}%`, height: 60 + ((i * 53) % 140) }));
  return { el, W, H, TW, TH, bars: el.querySelectorAll('.lb'), city: q('.fall-city'), sky: q('.fall-sky'), tower: q('.fall-tower'), lines, sign: q('.fall-sign'), flash: q('.fall-flash') };
}

/** Shared landing: the white star-flash covers everything, the screen swaps, the flash clears. */
function landing(tl, set, swap, at, hit = 'thwack') {
  tl.to(set.city, { y: 10, duration: 0.05, yoyo: true, repeat: 1, ease: 'power1.inOut' }, at - 0.1) // impact jolt
    .to(set.bars, { scaleY: 0, duration: 0.2, ease: 'power2.in' }, at + 0.2)
    .fromTo(set.flash, { scale: 0, rotation: -40, opacity: 1 }, { scale: 3.2, rotation: 0, duration: 0.2, ease: 'power3.in' }, at)
    .add(() => {
      swap();
      sfx(hit);
      gsap.set(set.city, { visibility: 'hidden' });
    }, at + 0.2)
    .to(set.flash, { opacity: 0, duration: 0.22, ease: 'power2.out' }, at + 0.22);
}

export async function fallWipe(swap, label = '') {
  if (reducedMotion()) {
    swap();
    return;
  }
  await filmReady(['upshot', 'crown', 'facade']);
  const set = citySet(label, '<div class="fall-half left"></div><div class="fall-half right"></div>');
  const { el, W, H, TH, city, sky, tower, lines, sign } = set;
  const left = el.querySelector('.fall-half.left');
  const right = el.querySelector('.fall-half.right');

  // the jagged seam the screen tears along (top to bottom, near the middle)
  const seam = [];
  for (let i = 0; i <= 8; i++) seam.push([W / 2 + (i % 2 ? 1 : -1) * (14 + ((i * 37) % 26)), (H * i) / 8]);
  const s = seam.map(([x, y]) => `${x.toFixed(0)}px ${y.toFixed(0)}px`).join(', ');
  const shots = [[left, `polygon(0 0, ${s}, 0 ${H}px)`], [right, `polygon(${W}px 0, ${s}, ${W}px ${H}px)`]].map(([half, clip]) => {
    const snap = snapshotScreen();
    half.style.clipPath = clip;
    half.appendChild(snap.frag);
    return snap;
  });
  document.body.appendChild(el);
  shots.forEach((shot) => shot.settle());
  gsap.set(tower, { xPercent: -50, y: H * 1.05 }); // starts just below the frame: the tower only rises into view once we're falling

  const tl = gsap.timeline({ onComplete: () => el.remove() });
  tl.set(el, { visibility: 'visible' });
  barsIn(tl, set.bars);
  tl
    // 1. the screen rushes at the camera...
    .add(() => sfx('whoosh'), 0)
    .to([left, right], { scale: 1.07, duration: 0.18, ease: 'power2.in', transformOrigin: '50% 50%' }, 0)
    // ...and splits open on a rooftop over the city
    .add(() => sfx('tear', 0.2), 0.16)
    .to(left, { xPercent: -118, rotation: -9, scale: 1.25, duration: 0.42, ease: 'power3.in' }, 0.18)
    .to(right, { xPercent: 118, rotation: 9, scale: 1.25, duration: 0.42, ease: 'power3.in' }, 0.18)
    .set([left, right], { autoAlpha: 0 }, 0.6) // fully gone before the fall starts
    .fromTo(city, { scale: 1.12 }, { scale: 1, duration: 0.4, ease: 'power2.out' }, 0.18)
    // 2. the jump: the tower face streams up past the camera, faster and faster
    .add(() => sfx('fall'), 0.2) // the jump: from here to the landing (~1.05s)
    .to(tower, { y: -(TH - H), duration: 0.78, ease: 'power2.in' }, 0.38)
    .fromTo(tower, { '--blur': 0 }, { '--blur': 1, duration: 0.55, ease: 'power2.in' }, 0.5) // the faster we fall, the more the windows smear
    .to(sky, { yPercent: -120, duration: 0.5, ease: 'power2.in' }, 0.42)
    .fromTo(city, { rotation: 0 }, { rotation: -1.6, duration: 0.3, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0.5)
    .fromTo(lines, { y: H + 40 }, { y: -260, duration: 0.32, ease: 'none', stagger: { each: 0.05, repeat: 1 } }, 0.62)
    // 3. the next chapter's name rides the fall like a building sign
    .fromTo(sign, { y: H * 0.55, opacity: 0, scale: 0.8 }, { y: 0, opacity: 1, scale: 1, duration: 0.34, ease: 'back.out(1.6)' }, 0.6)
    .to(sign, { y: -H * 0.12, duration: 0.24, ease: 'power1.in' }, 0.94);
  // 4. hard landing: white star-flash, swap, the page builds in as it clears
  landing(tl, set, swap, 1.0, 'land'); // you hit the street: a deep boom
  return track(tl);
}

/* THE RISE (any page -> back to the board): the reverse shot. The page drops away below
   you, you rocket up the tower face, burst over the roof into the red sky, and the board
   lands with the star-flash. (~0.95s, kept short because Back is used a lot) */
export async function riseWipe(swap, label = 'THE PLAN') {
  if (reducedMotion()) {
    swap();
    return;
  }
  await filmReady(['upshot', 'crown', 'facade'], 900);
  const set = citySet(label || 'THE PLAN', '<div class="fall-half whole"></div>');
  const { el, H, TH, city, sky, tower, lines, sign } = set;
  el.classList.add('rising'); // (the title leans the way this shot looks: up)
  const whole = el.querySelector('.fall-half.whole');
  const snap = snapshotScreen();
  whole.appendChild(snap.frag);
  document.body.appendChild(el);
  snap.settle();
  gsap.set(tower, { xPercent: -50, y: -(TH - H) });
  gsap.set(sky, { yPercent: 60 });

  const tl = gsap.timeline({ onComplete: () => el.remove() });
  tl.set(el, { visibility: 'visible' });
  barsIn(tl, set.bars);
  tl
    // 1. lift-off: the page falls away beneath the camera
    .add(() => sfx('rise'), 0)
    .to(whole, { yPercent: 105, scale: 0.86, rotation: 2, duration: 0.32, ease: 'power3.in' }, 0)
    // 2. up the tower, fastest at the start, braking as the roof comes into view
    .to(tower, { y: H * 0.72, duration: 0.62, ease: 'power3.out' }, 0.12)
    .fromTo(tower, { '--blur': 1 }, { '--blur': 0, duration: 0.5, ease: 'power2.out' }, 0.12) // smeared at launch, sharp as we brake
    .to(sky, { yPercent: 0, duration: 0.5, ease: 'power3.out' }, 0.3)
    .fromTo(lines, { y: -260 }, { y: H + 40, duration: 0.26, ease: 'none', stagger: { each: 0.04, repeat: 1 } }, 0.12)
    .fromTo(city, { rotation: 1.4 }, { rotation: 0, duration: 0.5, ease: 'power2.out' }, 0.12)
    // 3. over the roof: the board's name hangs in the sky for a beat
    .fromTo(sign, { y: -H * 0.4, opacity: 0, scale: 0.85 }, { y: -H * 0.08, opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(1.8)' }, 0.42);
  landing(tl, set, swap, 0.74);
  tl.timeScale(1.35); // Back is the most-used control: the same shot, ~0.85s instead of ~1.15s
  return track(tl);
}

/* NEXT STOP (the NEXT EPISODE card): you ride the train. From inside the car (Nano Banana
   interior: ring hoops, plain light strip, bench, see-through windows) you watch tunnel lights
   streak past the windows, the car rocks, the brakes squeal, and the next station slides into the
   windows and stops: its sign reads the next chapter. Ding-dong, star-flash, you're there. (~1.4s) */
export async function trainWipe(swap, label = '') {
  if (reducedMotion()) {
    swap();
    return;
  }
  await filmReady(['interior']);
  const el = document.createElement('div');
  el.className = 'fall nextstop';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<div class="ns-cam">
      <div class="ns-out"><div class="ns-lights">${'<i></i>'.repeat(9)}</div>
        <div class="ns-station"><i class="ns-tiles"></i><i class="ns-stripe"></i><div class="ns-sign"><small>NEXT STOP</small><span class="ransom"></span></div><i class="ns-pillar"></i><i class="ns-pillar p2"></i></div></div><i class="ns-glass"></i>
    </div><div class="fall-flash"></div>${LETTERBOX}`;
  ransom(el.querySelector('.ns-sign span'), label, label.length + 3);
  const q = (sel) => el.querySelector(sel);
  const cam = q('.ns-cam');
  cam.appendChild(filmImg('interior', 'ns-car'));
  const lights = el.querySelectorAll('.ns-lights i');
  const station = q('.ns-station');
  const sign = q('.ns-sign');
  const flash = q('.fall-flash');
  const bars = el.querySelectorAll('.lb');
  lights.forEach((l, i) => gsap.set(l, { top: `${18 + ((i * 23) % 60)}%`, width: `${10 + ((i * 17) % 22)}vw` }));
  document.body.appendChild(el);
  // put the station sign inside the big window's lower-left pane (art: 1408x768, pane 449-690 x 360-467),
  // and on narrow screens aim the camera at that pane
  const car = q('.ns-car');
  const bw = cam.offsetWidth;
  const bh = cam.offsetHeight;
  const AW = 1408;
  const AH = 768;
  const PX = 570; // pane center
  const PY = 414;
  const k = Math.max(bw / AW, bh / AH);
  const free = bw - AW * k;
  const fx = free < 0 ? Math.min(1, Math.max(0, (bw / 2 - PX * k) / free)) : 0.49;
  car.style.objectPosition = `${(fx * 100).toFixed(1)}% 46%`;
  const ox = free * fx;
  const oy = (bh - AH * k) * 0.46;
  gsap.set(sign, { left: ox + PX * k, top: oy + PY * k, scale: Math.min(1, (241 * k * 0.9) / sign.offsetWidth, (107 * k * 0.86) / sign.offsetHeight) });
  /* The platform's pillars stop behind the car's wall, by the car's own measure (Nov 22). Placed by the screen's width, the
     first one came to rest half inside the door's window, which read as a window in two tones; they still pass every window
     as the station glides in. (Art x 225: the wall between the door and the big window; 1000: the wall right of it.) */
  gsap.set(q('.ns-pillar:not(.p2)'), { left: ox + 225 * k, right: 'auto' });
  gsap.set(q('.ns-pillar.p2'), { left: ox + 1000 * k, right: 'auto' });

  const tl = gsap.timeline({ onComplete: () => el.remove() });
  tl.set(el, { visibility: 'visible' });
  barsIn(tl, bars);
  tl.add(() => sfx('train'), 0)
    .fromTo(cam, { scale: 1.08 }, { scale: 1, duration: 0.2, ease: 'power3.out' }, 0)
    // the car rocks on the rails, settling as it brakes
    .fromTo(cam, { rotation: -0.7, y: 3 }, { rotation: 0.7, y: -3, duration: 0.09, ease: 'sine.inOut', yoyo: true, repeat: 7 }, 0)
    .to(cam, { rotation: 0, y: 0, duration: 0.2, ease: 'power2.out' }, 0.72)
    // tunnel lights streaking past the windows, then slowing
    .fromTo(lights, { x: '110vw' }, { x: '-40vw', duration: 0.24, ease: 'none', stagger: { each: 0.04, repeat: 2 } }, 0)
    // the station glides in and stops in the windows
    .fromTo(station, { xPercent: 100 }, { xPercent: 0, duration: 0.62, ease: 'power3.out' }, 0.3)
    .from(sign, { scale: '+=0.25', duration: 0.2, ease: 'back.out(3)' }, 0.86)
    // the cut
    .fromTo(flash, { scale: 0, rotation: -40, opacity: 1 }, { scale: 3.2, rotation: 0, duration: 0.2, ease: 'power3.in' }, 1.08)
    .add(() => {
      swap();
      sfx('thwack');
      gsap.set(cam, { visibility: 'hidden' });
    }, 1.28)
    .to(bars, { scaleY: 0, duration: 0.2, ease: 'power2.in' }, 1.28)
    .to(flash, { opacity: 0, duration: 0.22, ease: 'power2.out' }, 1.3);
  await track(tl);
}

/* CALLING CARD (into CONTACT): a calling card is thrown at the camera, spinning in from far
   away; it smacks into the lens and fills the screen, then flips away to reveal the page.
   The site's own ending motif, so the finale gets the signature shot. (~1.1s) */
export function cardWipe(swap, label = 'CONTACT') {
  if (reducedMotion()) {
    swap();
    return Promise.resolve();
  }
  const W = window.innerWidth;
  const H = window.innerHeight;
  const el = document.createElement('div');
  el.className = 'fall cardshot';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<div class="cs-dim"></div><div class="cs-card"><span class="cs-seal"></span><small>A calling card for you</small><b></b><em>Consider it stolen.</em></div>${LETTERBOX}`;
  el.querySelector('.cs-card b').textContent = label;
  const [dim, card] = el.children;
  const bars = el.querySelectorAll('.lb');
  document.body.appendChild(el);
  const r = card.getBoundingClientRect();
  const cover = Math.max(W / r.width, H / r.height) * 1.25;

  const tl = gsap.timeline({ onComplete: () => el.remove() });
  tl.set(el, { visibility: 'visible' })
    .fromTo(dim, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0)
    .fromTo(bars, { scaleY: 0 }, { scaleY: 1, duration: 0.16, ease: 'power3.out' }, 0)
    .to(bars, { scaleY: 0, duration: 0.2, ease: 'power2.in' }, 0.88)
    // 1. flung from deep in the frame, spinning
    .add(() => sfx('whip'), 0.05)
    .fromTo(card, { scale: 0.04, rotation: -540, rotationY: 0, x: W * 0.32, y: -H * 0.3 },
      { scale: 1, rotation: -6, x: 0, y: 0, transformPerspective: 900, duration: 0.5, ease: 'power3.out' }, 0)
    // 2. a beat to read it, then it smacks into the lens
    .to(card, { scale: cover, rotation: 0, duration: 0.24, ease: 'power3.in' }, 0.62)
    .add(() => {
      swap();
      sfx('thwack');
      shake(document.body);
    }, 0.86)
    .set(dim, { opacity: 0 }, 0.86)
    // 3. flips away to reveal the page
    .to(card, { rotationX: 88, y: -H * 0.2, opacity: 0, duration: 0.26, ease: 'power2.in' }, 0.88);
  return track(tl);
}
