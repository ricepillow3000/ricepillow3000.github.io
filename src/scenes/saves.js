import { gsap } from 'gsap';
import { esc, reducedMotion, timeOfDay } from '../core/util.js';
import { store, SLOTS } from '../core/store.js';
import { progress } from '../core/progress.js';
import { cutType } from '../ui/cuttype.js';
import { sfx } from '../audio/audio.js';
import { SECTION_TITLES } from './sections.js';

/* SAVE DATA (Nov 19, John's save-screen reference: "remove the save line under the button... they press
   continue and get redirected to a section where they can create a new save data or continue, and they
   have multiple sections to save the data"). An original screen in our system (no game screen copied):
   black, a tall red band on the left with a black notched edge like a film strip, SAVE DATA in cut
   type over it, and the files as slanted paper slips fanned down the screen. A slip shows its number on
   a black tab, the day it was last saved (big red date, the weekday on a black chip, the time of day),
   where it was left, and how much is cleared. The picked slip becomes a big red slab, larger, with its
   play time and what it will do (CONTINUE or START NEW GAME); a finished file carries a COMPLETED stamp
   with a burst. An empty file is a NEW GAME. Mouse: point to pick, click to play. Touch: tap to pick,
   tap again to play. Keys: arrows (W/S) to pick, Enter to play, Esc to go back. A file's CLEAR DATA
   tag takes two presses. Picking a file closes the screen and the train comes in, as PRESS START always did. */

const WD = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PLACES = { ...SECTION_TITLES, board: 'THE PLAN', quick: 'QUICK VIEW', '': 'THE STATION' };
const place = (id) => PLACES[id] || 'THE STATION';
const playTime = (ms) => { const m = Math.floor(ms / 60000); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };

let root = null;
let opts = null;
let lastPointer = 'mouse';

/* the stack (Nov 19, John: "stacked... the other cards peeking out... hovering, the rest moves to make
   room"): saves.css lays every card over the lower part of the one above */
const pile = (i) => `--i:${i}`; // (the stack's shape lives in saves.css: overlap, size and offset by --i)
function slip(s, i) {
  const no = `<span class="sv-no" aria-hidden="true"><small>No.</small>${i + 1}</span>`;
  if (!s) {
    return `<li class="sv-li" style="${pile(i)}"><i class="sv-star" aria-hidden="true"></i><button class="sv-slot sv-empty" type="button" data-i="${i}" aria-label="File ${i + 1}: empty. Start a new game.">
      ${no}<span class="sv-new" aria-hidden="true">${cutType('NEW GAME', 61)}</span><span class="sv-hint" aria-hidden="true">EMPTY FILE</span><span class="sv-stamp" aria-hidden="true">NO DATA</span>
      <span class="sv-more" aria-hidden="true"><span class="sv-go">START NEW GAME ▸</span></span></button></li>`;
  }
  const p = progress(s);
  const d = new Date(s.meta.saved || s.meta.created || Date.now());
  const tod = timeOfDay(d).label;
  const where = place(s.meta.last);
  const label = `File ${i + 1}: ${where}, ${p.done} of ${p.total} cleared${p.all ? ', completed' : ''}. Saved ${MONTHS[d.getMonth()]} ${d.getDate()}, ${tod}. Play time ${playTime(s.meta.playMs)}. Continue.`;
  const time = playTime(s.meta.playMs);
  if (p.all) { // a finished file: the whole slip is COMPLETED (Nov 19, John: "the whole saved data will say completed")
    return `<li class="sv-li" style="${pile(i)}"><i class="sv-star" aria-hidden="true"></i><button class="sv-slot sv-complete" type="button" data-i="${i}" aria-label="${esc(label)}">
    ${no}
    <span class="sv-done" aria-hidden="true"><svg class="sv-burst" viewBox="-50 -50 100 100"><polygon points="${burst()}"/></svg>${cutType('COMPLETED', 77)}</span>
    <span class="sv-ctime" aria-hidden="true"><small>PLAY TIME</small><b>${time}</b></span>
    <span class="sv-more" aria-hidden="true"><span class="sv-go">CONTINUE ▸</span></span>
  </button>${chip(i)}</li>`;
  }
  return `<li class="sv-li" style="${pile(i)}"><i class="sv-star" aria-hidden="true"></i><button class="sv-slot" type="button" data-i="${i}" aria-label="${esc(label)}">
    ${no}
    <span class="sv-date" aria-hidden="true"><b>${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')}</b><i>${WD[d.getDay()]}</i><em>${esc(tod)}</em></span>
    <span class="sv-place" aria-hidden="true"><span>${esc(where)}</span><span class="sv-pips">${p.items.map((it) => `<i${it.done ? ' class="on"' : ''}></i>`).join('')}</span></span>
    <span class="sv-lv" aria-hidden="true"><small>CLEARED</small><b>${p.done}</b><i>/${p.total}</i></span>
    <span class="sv-more" aria-hidden="true"><span class="sv-time"><small>PLAY TIME</small><b>${time}</b></span><span class="sv-go">CONTINUE ▸</span></span>
  </button>${chip(i)}</li>`;
}
/* CLEAR DATA (Nov 19, John: "don't make the clear data its own box... every box has a clear data box inside
   that data saving box... bottom right side, pretty small"): a small black tag in the bottom-right corner of
   every file that holds a game, always there; the first press asks (SURE?), the second clears that file */
const chip = (i) => `<button class="sv-erase" type="button" data-erase="${i}" aria-label="Clear data of file ${i + 1}. Press twice.">CLEAR DATA</button>`;
function burst() {
  const pts = [];
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2 - Math.PI / 2; const r = k % 2 ? 20 : 48; pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`); }
  return pts.join(' ');
}

function markup() {
  const files = store.slots();
  const full = files.every(Boolean);
  return `<div class="sv-stripes" aria-hidden="true"><i></i><i></i><i></i></div>
    <h2 class="sv-title" id="svTitle"><span class="sr-only">Save data</span><span aria-hidden="true">${cutType('SAVE DATA', 41, { mixCase: true })}</span></h2>
    <p class="sv-sub${full ? ' sv-full' : ''}">${full ? `All ${SLOTS} files are in use. CLEAR DATA on one to start a new game.` : 'Pick a file: your progress saves itself to it. An empty file starts a new game.'}</p>
    <i class="sv-dots" aria-hidden="true"></i>
    <ol class="sv-list">${files.map(slip).join('')}</ol>
    <div class="sv-keys"><button class="sv-key" type="button" data-sv-back><kbd>Esc</kbd><span>BACK</span></button><span class="sv-key sv-key-ok" aria-hidden="true"><kbd>Enter</kbd><span>CONFIRM</span></span></div>`;
}

/** a picked slip plays its file */
const activate = (btn) => play(btn);

const slots = () => [...root.querySelectorAll('.sv-slot')];
function pick(btn, quiet) {
  if (!btn || btn.classList.contains('on')) return;
  slots().forEach((b) => b.classList.toggle('on', b === btn));
  disarm();
  root.querySelector('.sv-list').classList.add('has-on');
  if (!quiet) sfx('hover');
  if (!reducedMotion() && !quiet) gsap.fromTo(btn, { x: -14 }, { x: 0, duration: 0.22, ease: 'back.out(3)', clearProps: 'transform' });
}

function play(btn) {
  const i = Number(btn.dataset.i);
  const fresh = btn.classList.contains('sv-empty');
  root.classList.add('sv-going');
  sfx('select');
  if (fresh) sfx('stamp');
  const done = () => { close(true); opts.onPick(i, fresh); };
  if (reducedMotion()) { done(); return; }
  gsap.timeline({ onComplete: done })
    .fromTo(btn, { scale: 1.12 }, { scale: 1, duration: 0.2, ease: 'back.out(3)' }, 0)
    .to(root, { xPercent: -110, skewX: 12, duration: 0.32, ease: 'power3.in' }, 0.24);
}

function disarm(keep) {
  root.querySelectorAll('.sv-erase.armed').forEach((e) => { if (e === keep) return; e.classList.remove('armed'); e.textContent = 'CLEAR DATA'; e.setAttribute('aria-label', `Clear data of file ${Number(e.dataset.erase) + 1}. Press twice.`); });
}
function erase(b) {
  if (!b.classList.contains('armed')) {
    disarm(b);
    b.classList.add('armed');
    b.textContent = 'SURE?';
    b.setAttribute('aria-label', `Sure? Press again to clear file ${Number(b.dataset.erase) + 1}.`);
    sfx('toggle');
    if (!reducedMotion()) gsap.fromTo(b, { x: -6 }, { keyframes: [{ x: 5 }, { x: -3 }, { x: 0 }], duration: 0.2, ease: 'steps(4)', clearProps: 'transform' });
    return;
  }
  const i = Number(b.dataset.erase);
  store.eraseSlot(i);
  sfx('shatter');
  sfx('stamp');
  render(i);
}

function render(focusI) {
  root.innerHTML = markup();
  const list = slots();
  const want = list[focusI ?? store.active() ?? 0] || list[0];
  pick(want, true);
  want.focus({ preventScroll: true });
}

/** the file to play, then onPick(i, isNew) */
export function openSaves(o) {
  opts = o;
  if (!root) {
    root = document.createElement('div');
    root.className = 'sv';
    root.id = 'saves';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'svTitle');
    document.body.appendChild(root);
    root.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType; }, true);
    // the mouse picks a file only once it moves (opening the screen under a resting pointer must not
    // pick whatever slip lands under it: the last file played stays picked)
    root.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') pick(e.target.closest?.('.sv-slot')); });
    root.addEventListener('focusin', (e) => { if (e.target.classList?.contains('sv-slot')) pick(e.target); });
    root.addEventListener('click', (e) => {
      if (root.classList.contains('sv-going')) return;
      const er = e.target.closest('.sv-erase');
      if (er) { erase(er); return; }
      if (e.target.closest('[data-sv-back]')) { close(); return; }
      const btn = e.target.closest('.sv-slot');
      if (!btn) return;
      if (lastPointer !== 'mouse' && e.detail !== 0 && !btn.classList.contains('on')) { pick(btn); return; } // a finger: first tap picks
      activate(btn);
    });
    root.addEventListener('keydown', (e) => { // keep Tab inside
      if (e.key !== 'Tab') return;
      const f = [...root.querySelectorAll('button:not([hidden])')].filter((b) => b.offsetParent !== null);
      const k = f.indexOf(document.activeElement);
      if (e.shiftKey && k <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && k === f.length - 1) { e.preventDefault(); f[0].focus(); }
    });
  }
  root.hidden = false;
  root.classList.remove('sv-going');
  gsap.set(root, { clearProps: 'all' });
  render();
  document.body.classList.add('sv-open');
  sfx('paper');
  if (reducedMotion()) return;
  gsap.timeline()
    .fromTo(root, { clipPath: 'polygon(0 0, 0 0, 0 100%, 0 100%)' }, { clipPath: 'polygon(0 0, 130% 0, 100% 100%, 0 100%)', duration: 0.32, ease: 'power3.out', clearProps: 'clipPath' }, 0)
    .fromTo(root.querySelectorAll('.sv-title .ct'), { y: -60, rotation: () => gsap.utils.random(-40, 40), opacity: 0 }, { y: 0, rotation: 0, opacity: 1, duration: 0.3, ease: 'back.out(2.2)', stagger: 0.03, clearProps: 'all' }, 0.1)
    .fromTo(root.querySelectorAll('.sv-li'), { x: () => window.innerWidth, rotation: 8, opacity: 0 }, { x: 0, rotation: 0, opacity: 1, duration: 0.34, ease: 'back.out(1.8)', stagger: 0.06, clearProps: 'transform,opacity' }, 0.12)
    .fromTo(root.querySelector('.sv-keys'), { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.25, ease: 'back.out(2)', clearProps: 'transform,opacity' }, 0.3);
}

export function closeSaves() { close(); }
function close(picked) {
  if (!root || root.hidden) return;
  const end = () => { root.hidden = true; document.body.classList.remove('sv-open'); gsap.set(root, { clearProps: 'all' }); if (!picked) opts?.onClose?.(); };
  if (picked || reducedMotion()) { end(); return; }
  sfx('back');
  gsap.timeline({ onComplete: end })
    .to(root.querySelectorAll('.sv-li'), { x: () => window.innerWidth, rotation: 8, duration: 0.24, ease: 'power3.in', stagger: 0.03 }, 0)
    .to(root, { clipPath: 'polygon(0 0, 0 0, 0 100%, 0 100%)', duration: 0.26, ease: 'power3.in' }, 0.12);
}
export const savesOpen = () => Boolean(root && !root.hidden);

/** the site's keys while it is open: arrows/W/S pick, Enter plays, Esc goes back */
export function savesKey(action, e) {
  if (root.classList.contains('sv-going')) return true;
  const list = slots();
  const k = list.findIndex((b) => b.classList.contains('on'));
  if (action === 'up' || action === 'down') {
    const n = list[(k + (action === 'up' ? -1 : 1) + list.length) % list.length];
    n.focus({ preventScroll: true });
    pick(n);
    return true;
  }
  if (action === 'back') { close(); return true; }
  if (action === 'confirm') {
    if (e && document.activeElement && root.contains(document.activeElement) && document.activeElement.tagName === 'BUTTON') return false; // (the button's own Enter)
    activate(list[k] || list[0]);
    return true;
  }
  return true; // nothing else while it is open (no number keys, no Quick View)
}
