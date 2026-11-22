import { gsap } from 'gsap';
import { $, esc, reducedMotion } from '../core/util.js';
import { store } from '../core/store.js';
import { menuTeasers } from '../data/script.js';
import { sfx } from '../audio/audio.js';
import { scramble } from '../fx/kinetic.js';
import { cutType } from '../ui/cuttype.js';

/* The menu (opened from the MENU button), Nov 19, from John's command-select reference (an
   original design: no character, no hand, our own shapes and words): a red field on the left with
   the items in cut type stepping down a diagonal, a black panel with a black/white zigzag starburst
   on the right, a big red jagged slash between them, a MAIN MENU tag and the picked item's number
   in big cut-out digits top-right, and the picked item's name huge at the bottom with its one-line
   teaser under it. Bottom-left: how many chapters you've read. */
export const MENU_ITEMS = [
  { id: 'stats', label: 'STATS' },
  { id: 'missions', label: 'MISSIONS' },
  { id: 'skills', label: 'SKILLS' },
  { id: 'side-quests', label: 'SIDE QUESTS' },
  { id: 'different', label: 'MY EDGE' },
  { id: 'contact', label: 'CONTACT' },
  { id: 'system', label: 'SETTINGS' }
];

const pt = (cx, cy, r, a) => `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
/** a star outline with n points (inner = how deep the valleys go) */
function starPts(cx, cy, r, inner, n, rotDeg) {
  const out = [];
  for (let i = 0; i < n * 2; i++) out.push(pt(cx, cy, i % 2 ? r * inner : r, ((rotDeg + (i * 180) / n) * Math.PI) / 180));
  return out.join(' ');
}
/* the art behind the menu: the black panel with a zigzag starburst (rings of jagged stars, black and
   white in turn), and the red jagged slash, in one SVG drawn once */
function art() {
  let burst = '';
  for (let i = 0; i < 10; i++) burst += `<polygon points="${starPts(0, 0, 640 - i * 62, 0.78, 18, -90 + i * 7)}" fill="${i % 2 ? '#F5F5F0' : '#0B0B0B'}"/>`;
  return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
    <polygon points="930,-20 1620,-20 1620,920 760,920 812,640 770,652 860,300 826,310" fill="#0B0B0B"/>
    <g clip-path="url(#mnPanel)"><g transform="translate(1290 430)"><g class="mn-burst">${burst}</g></g></g>
    <clipPath id="mnPanel"><polygon points="930,-20 1620,-20 1620,920 760,920 812,640 770,652 860,300 826,310"/></clipPath>
    <polyline points="930,-20 826,310 860,300 770,652 812,640 760,920" fill="none" stroke="#F5F5F0" stroke-width="8" stroke-linejoin="miter"/>
    <polygon class="mn-slash" points="850,-40 975,-40 842,318 948,288 742,940 628,940 772,470 668,500" fill="#E5191C" stroke="#0B0B0B" stroke-width="12" stroke-linejoin="miter"/>
  </svg>`;
}

export function createMenu(go) {
  const overlay = $('#menu');
  const stair = $('#stair');
  const teaser = $('#menuTeaser');
  const btn = $('#menuBtn');
  const num = $('#menuNum');
  const big = $('#menuBig');
  const count = $('#menuCount');

  function render() {
    stair.innerHTML = MENU_ITEMS.map(
      (m, i) => `<li role="none" style="--i:${i}"><button class="stair-item" role="menuitem" type="button" data-nav data-go="${m.id}" aria-label="${esc(m.label)}">
        <span class="cursor-star" aria-hidden="true"></span><span class="si-text" aria-hidden="true">${cutType(m.label, i + 21, { mixCase: true, tight: true })}</span>
        ${store.has('visited', m.id) ? '<span class="si-seen" role="img" aria-label="seen"></span>' : ''}</button></li>`
    ).join('');
    const read = MENU_ITEMS.filter((m) => m.id !== 'system' && store.has('visited', m.id)).length;
    count.innerHTML = `<span>READ</span><b>${read}</b><i>/</i><b>6</b>`;
    stair.querySelectorAll('.stair-item').forEach((b) => {
      const on = () => select(b);
      b.addEventListener('pointerenter', on);
      b.addEventListener('focus', on);
      b.addEventListener('click', () => {
        sfx('select');
        go(b.dataset.go); // the page transition closes the menu once it covers the screen
      });
    });
  }

  function select(b, quiet) {
    if (b.classList.contains('on')) return; // already selected (mouse then focus): no second sound
    stair.querySelectorAll('.stair-item').forEach((x) => x.classList.toggle('on', x === b));
    stair.classList.add('has-on');
    const i = MENU_ITEMS.findIndex((m) => m.id === b.dataset.go);
    // the picked item's number in big cut-out digits, and its name huge at the bottom
    num.innerHTML = [...String(i + 1).padStart(2, '0')].map((d, k) => `<span class="mn-d mn-d${k}">${d}</span>`).join('');
    // two copies, stacked: the back one draws only the letters' black boxes, the front one only the letters, so a
    // boxed letter's backing can never cover part of its neighbour (it used to leave stray ticks beside the T's)
    const word = cutType(MENU_ITEMS[i].label, i + 61, { tight: true }); // all capitals: a small t among them read as a stray tick
    big.innerHTML = `<span class="mn-under">${word}</span><span class="mn-over">${word}</span>`;
    scramble(teaser, menuTeasers[b.dataset.go] || '', { duration: 0.3 });
    if (!reducedMotion()) {
      gsap.fromTo(big, { x: 40, scale: 1.12, opacity: 0.4 }, { x: 0, scale: 1, opacity: 1, duration: 0.22, ease: 'back.out(2.4)', overwrite: true });
      gsap.fromTo(num, { rotation: -16, scale: 1.25 }, { rotation: 0, scale: 1, duration: 0.24, ease: 'back.out(3)', overwrite: true });
    }
    if (!quiet) sfx('hover');
  }

  let openState = false;
  let settle = 0;

  /* Menu has its own move: the panel unfolds diagonally from the top-left corner, items fly in one by one on a rising
     chime; closing folds it back. The moves are CSS animations (.mn-in / .mn-out in components.css): transform and
     opacity, played by the browser, so they stay smooth even while the menu is being built. */
  function open() {
    const artBox = overlay.querySelector('.mn-art');
    if (!artBox.firstChild) artBox.innerHTML = art(); // drawn on the first open, not while the title loads
    render();
    openState = true;
    clearTimeout(settle);
    overlay.classList.remove('mn-out');
    overlay.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    const first = stair.querySelector('.stair-item');
    select(first, true);
    first.focus();
    if (reducedMotion()) return;
    sfx('menuOpen');
    overlay.classList.add('mn-in');
    // once it has landed the animations are dropped (the final pose is the plain one), so nothing stays on its own layer
    settle = setTimeout(() => overlay.classList.remove('mn-in'), 700);
  }

  /** animated = false when we are leaving for a page (the page wipe covers it) */
  function close(animated = true) {
    if (!openState) return;
    openState = false;
    clearTimeout(settle);
    btn.setAttribute('aria-expanded', 'false');
    // closed in place (not leaving for a page): focus goes back to the MENU button
    if (animated && overlay.contains(document.activeElement)) btn.focus({ preventScroll: true });
    const done = () => {
      if (openState) return; // (reopened while folding)
      overlay.hidden = true;
      overlay.classList.remove('mn-in', 'mn-out');
      stair.classList.remove('has-on');
      gsap.set([big, num], { clearProps: 'all' });
    };
    if (!animated || reducedMotion()) return done();
    sfx('menuClose');
    overlay.classList.remove('mn-in');
    overlay.classList.add('mn-out');
    settle = setTimeout(done, 340); // (60 ms delay + 220 ms fold, and a margin)
  }

  overlay.querySelector('[data-close-menu]').addEventListener('click', () => close());

  return { open, close, isOpen: () => openState };
}
