import { gsap } from 'gsap';
import { seeded, reducedMotion } from '../core/util.js';

const COLORS = ['c-black', 'c-white', 'c-red', 'c-paper', 'c-black', 'c-white'];

/** Seed for John's name so it looks identical everywhere (title, board, cut-ins). */
export const NAME_SEED = 11;

/** Builds cut-out "ransom note" letters into el. Medium chaos: ±12° tilt, small hops, 5 fonts. */
export function ransom(el, text, seed = 7) {
  const rnd = seeded(seed * 9973 + text.length * 31);
  el.removeAttribute('aria-label');
  el.setAttribute('translate', 'no'); // auto-translate would scramble cut-out names letter by letter
  el.innerHTML = '';
  // screen readers read this plain text; the cut-out letters are hidden from them
  const plain = document.createElement('span');
  plain.className = 'sr-only';
  plain.textContent = text;
  el.appendChild(plain);
  text.split(' ').forEach((word) => {
    const w = document.createElement('span');
    w.className = 'rw';
    w.setAttribute('aria-hidden', 'true');
    [...word].forEach((ch) => {
      const l = document.createElement('span');
      let f = Math.floor(rnd() * 5);
      if (f === 2 && /[A4N]/i.test(ch)) f = 0; // the marker font's A reads as a 4 ("ST4TS") its N as a blot (JOHN's last letter)
      if ((f === 2 || f === 3) && /[0-9]/.test(ch)) f = 0; // numerals stay in one clean face (a marker or typewriter 0 was a rough ring beside a clean 1)
      l.className = `rl f${f} ${COLORS[Math.floor(rnd() * COLORS.length)]}`;
      l.style.setProperty('--r', `${(rnd() * 24 - 12).toFixed(1)}deg`);
      l.style.setProperty('--y', `${(rnd() * 0.16 - 0.08).toFixed(2)}em`);
      l.textContent = ch;
      w.appendChild(l);
    });
    el.appendChild(w);
  });
  el.onpointerenter = () => shiver(el);
  return el;
}

/** Letters drop in from above at random tilts. Returns a timeline. */
export function dropIn(el, delay = 0) {
  const letters = el.querySelectorAll('.rl');
  if (reducedMotion() || !letters.length) return gsap.timeline();
  return gsap.timeline({ delay }).from(letters, {
    y: -70,
    rotation: () => gsap.utils.random(-40, 40),
    opacity: 0,
    duration: 0.38,
    ease: 'back.out(2.2)',
    stagger: 0.035
  });
}

/** Hover: letters jitter, tilt and flip colors for a few frames, then snap back (hover only, never idle). */
function shiver(el) {
  if (reducedMotion() || el.dataset.shivering) return;
  el.dataset.shivering = '1';
  const letters = [...el.querySelectorAll('.rl')];
  const flip = letters.filter(() => Math.random() < 0.45);
  flip.forEach((l) => l.classList.add('rl-inv'));
  const r = () => gsap.utils.random(-4, 4);
  const t = () => gsap.utils.random(-14, 14);
  gsap.to(letters, {
    keyframes: [{ x: r, y: r, rotation: t }, { x: r, y: r, rotation: t }, { x: 0, y: 0, rotation: 0 }],
    duration: 0.24,
    ease: 'steps(3)',
    stagger: 0.012,
    onComplete: () => {
      flip.forEach((l) => l.classList.remove('rl-inv'));
      gsap.set(letters, { clearProps: 'transform' });
      delete el.dataset.shivering;
    }
  });
}
