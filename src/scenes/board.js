import { gsap } from 'gsap';
import { MENU_ITEMS } from './menu.js';
import { resume } from '../data/resume.js';
import { menuTeasers, chapterLoot } from '../data/script.js';
import { esc, reducedMotion } from '../core/util.js';
import { ransom, NAME_SEED } from '../ui/ransom.js';
import { cutType } from '../ui/cuttype.js';
import { sfx } from '../audio/audio.js';
import { store } from '../core/store.js';

/* =========================================================================
   THE PLAN — the hub after PRESS START, drawn as a COMMAND SELECT screen (Nov 18, John's P5
   command-menu reference, shapes and type original): the six chapters stacked in a zigzag of
   cut-out letters, a red blade behind the picked one, a giant chapter number on the starburst, and
   the picked chapter's name huge at the bottom: that word is the button.
   Guided without saying so: the next unread chapter is already picked when you arrive (one tap
   continues), it is the biggest and brightest line, the blade points at it, and the giant word
   sits where the eye ends up (bottom of the reading path). Read chapters shrink and get a star, so
   the unfinished ones keep pulling.
   ========================================================================= */

/** The resume, start to finish: who he is, what he built, what he can do, where he worked,
    why he's different, how to reach him. Each chapter ends with NEXT EPISODE to the next one. */
export const CHAPTERS = ['stats', 'missions', 'skills', 'side-quests', 'different', 'contact'];
/** The JN line's stations, one per chapter (Nov 20, John: "use these stops instead"). John's call, a
    deliberate homage like TAKE YOUR TIME: Yongen-Jaya (the game's home neighborhood, invented for it)
    and five real Tokyo stations its story rides through. Only the names, in our own design. */
export const STATIONS = { stats: 'YONGEN-JAYA', missions: 'SHIBUYA', skills: 'AOYAMA-ITCHOME', 'side-quests': 'SHINJUKU', different: 'AKIHABARA', contact: 'KICHIJOJI' };
const label = (id) => MENU_ITEMS.find((m) => m.id === id)?.label || id.toUpperCase();
const no = (i) => String(i + 1).padStart(2, '0');

/** The first chapter the visitor hasn't opened yet (or null when all six are done). */
export function nextChapter() {
  const seen = store.get().visited || [];
  return CHAPTERS.find((id) => !seen.includes(id)) || null;
}

const ZIG = [0.35, 1.6, 0.6, 2.2, 1.1, 2.7]; // the stack zigzags down (em of indent), never a straight column

function planMarkup(ctx) {
  const e = resume.education;
  const note = ctx.company
    ? `<p class="plan-note"><b>Wait, someone from ${esc(ctx.company.name)}?</b> I've been expecting you.</p>`
    : '';
  return `<div class="plan">
    <header class="plan-head" data-board-item>
      <div class="plan-id">
      <div class="plan-name">
        <h1 class="ransom" id="boardName"></h1>
        <div class="slab board-slab"><span>${esc(resume.name.split(' ').slice(1).join(' ').toUpperCase())}</span></div>
      </div>
      <p class="plan-role">${esc(resume.role)}<span class="plan-status"> · GSU ${esc(e.grad.replace('Class of ', "'").replace(/^'20/, "'"))} · ${esc(resume.status)}</span></p>
      </div>
      <div class="plan-side">
      <ul class="plan-proof" aria-label="At a glance">
        <li class="pp pp0"><b>2</b> live apps</li>
        <li class="pp pp1"><b>2,000+</b> tests</li>
        <li class="pp pp2"><b>${esc(e.gpa)}</b> GPA</li>
      </ul>
      </div>
      ${note}
    </header>

    <div class="cmd">
      <nav class="plan-line" aria-label="The resume, six chapters" data-board-item>
        <ol>${CHAPTERS.map((id, i) => `<li style="--i:${i};--zig:${ZIG[i]}">
          <a class="pl-item" href="#/${id}" data-nav data-ch="${id}" aria-label="${no(i)} ${esc(label(id))}">
            <span class="pl-blade" aria-hidden="true"><i></i></span>
            <span class="pl-star" aria-hidden="true"></span>
            <span class="pl-no" aria-hidden="true">${no(i)} </span>
            <span class="pl-word">${cutType(label(id), i + 3)}</span>
          </a></li>`).join('')}</ol>
      </nav>

      <div class="cmd-inside" data-board-item>
        <span class="ci-kick" aria-hidden="true">INSIDE</span>
        <ul class="cmd-loot" aria-label="Inside this chapter"></ul>
      </div>

      <div class="cmd-right" data-board-item>
        <div class="cmd-num" aria-hidden="true">
          <span class="cn-kick">THE PLAN</span>
          <span class="cn-box"><b class="ransom cn-no"></b></span>
          <span class="cn-of">OF 06</span>
        </div>
        <button type="button" class="progress-chip" id="progressChip"></button>
      </div>

      <a class="plan-continue" href="#/stats" data-nav data-board-item>
        <small class="pcn-kicker"></small>
        <span class="pcn-btn"><b class="pcn-title ransom"></b><i class="pcn-arrow" aria-hidden="true"></i></span>
        <span class="pcn-tease"></span>
      </a>
    </div>
  </div>`;
}

/** Mounts THE PLAN into #board. reveal() plays its entrance; refresh() updates the stars and the
    picked chapter after the visitor comes back from a chapter. */
export function createBoard(root, ctx) {
  root.innerHTML = planMarkup(ctx);
  ransom(root.querySelector('#boardName'), resume.first, NAME_SEED);
  const items = [...root.querySelectorAll('.pl-item')];
  const cont = root.querySelector('.plan-continue');
  const title = cont.querySelector('.pcn-title');
  const num = root.querySelector('.cn-no');
  const loot = root.querySelector('.cmd-loot');
  let next = 'stats';

  /* the chapter you point at becomes the picked one; let go and it returns to the next unread one */
  let shown = null;
  function preview(id, { silent = false, animate = true } = {}) {
    if (!id || id === shown) return;
    shown = id;
    const i = CHAPTERS.indexOf(id);
    const seen = store.get().visited || [];
    items.forEach((a) => a.classList.toggle('on', a.dataset.ch === id));
    ransom(num, no(i), i + 21);
    ransom(title, label(id), i + 5);
    title.removeAttribute('translate');
    cont.querySelector('.pcn-tease').textContent = menuTeasers[id] || '';
    loot.innerHTML = (chapterLoot[id] || []).map((t, k) => `<li class="lt lt${k}">${esc(t)}</li>`).join('');
    cont.setAttribute('href', `#/${id}`);
    cont.querySelector('.pcn-kicker').textContent = id !== next
      ? (seen.includes(id) ? 'READ AGAIN' : 'JUMP AHEAD')
      : nextChapter() ? '' : 'ALL CHAPTERS READ'; // the next chapter needs no words: it is already picked, biggest, and the blade points at it
    if (!silent) sfx('hover');
    if (!animate || reducedMotion()) return; // the first entrance animates these itself (two from-tweens on one letter end invisible)
    // the picked word drops in letter by letter, the number spins onto the starburst
    gsap.from(title.querySelectorAll('.rl'), { y: -40, rotation: () => gsap.utils.random(-30, 30), opacity: 0, duration: 0.24, ease: 'back.out(2.4)', stagger: 0.022 });
    gsap.from(loot.children, { x: -50, scale: 1.4, rotation: () => gsap.utils.random(-16, 16), opacity: 0, duration: 0.22, ease: 'back.out(2.4)', stagger: 0.05 });
    gsap.from(num.querySelectorAll('.rl'), { scale: 1.8, rotation: () => gsap.utils.random(-45, 45), opacity: 0, duration: 0.26, ease: 'back.out(2.2)', stagger: 0.05 });
  }
  /* Only a mouse that really moves picks a chapter. After PRESS START the pointer is still resting
     where the button was, and the lines slide in under it: that must not steal the pick from the
     next unread chapter (Nov 18: the hub opened on CONTACT). */
  let armed = true;
  let restXY = null;
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const xy = `${e.clientX},${e.clientY}`;
    if (!armed && restXY !== null && xy !== restXY) armed = true;
    restXY = xy;
  }, { passive: true, capture: true }); // capture: unlock before the chapter line under the mouse hears this move
  items.forEach((a) => {
    a.addEventListener('pointermove', (e) => e.pointerType === 'mouse' && armed && preview(a.dataset.ch));
    a.addEventListener('focus', () => preview(a.dataset.ch));
  });
  root.querySelector('.plan-line').addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && armed && preview(next, { silent: true }));

  function refresh(animate = true) {
    const seen = store.get().visited || [];
    items.forEach((a) => a.classList.toggle('seen', seen.includes(a.dataset.ch)));
    next = nextChapter() || 'contact';
    items.forEach((a) => a.classList.toggle('here', a.dataset.ch === next && Boolean(nextChapter())));
    shown = null;
    preview(next, { silent: true, animate });
  }
  refresh(false);

  let revealedOnce = false;
  function reveal(delay = 0) {
    armed = restXY === null; // wait for the resting mouse to move before it can pick anything
    refresh(revealedOnce);
    if (reducedMotion()) return;
    const parts = root.querySelectorAll('[data-board-item]');
    if (revealedOnce) {
      return gsap.from(parts, { x: -30, opacity: 0, duration: 0.22, ease: 'power3.out', stagger: 0.03, delay, clearProps: 'transform,opacity' });
    }
    revealedOnce = true;
    const tl = gsap.timeline({ paused: true, defaults: { immediateRender: true } });
    // slammed together like a command screen: the chapter lines punch in from the left one after
    // another, the blade slices out behind the picked one, the number spins onto the starburst,
    // and the picked chapter's name lands last, big, where the eye ends up
    // the picked chapter, its number and its big word land first (that's where the eye should go), then
    // the rest of the stack, the preview stickers and the header fill in around them
    tl.from(root.querySelector('.pl-item.on'), { x: -260, rotation: -14, opacity: 0, duration: 0.28, ease: 'back.out(1.8)', clearProps: 'transform,opacity' }, 0)
      .from(root.querySelector('.pl-item.on .pl-blade'), { scaleX: 0, duration: 0.22, ease: 'power4.out', clearProps: 'transform' }, 0.12)
      .from(cont, { y: 90, rotation: 5, opacity: 0, duration: 0.3, ease: 'back.out(1.8)', clearProps: 'transform,opacity' }, 0.08)
      .from(title.querySelectorAll('.rl'), { y: -60, rotation: () => gsap.utils.random(-40, 40), opacity: 0, duration: 0.26, ease: 'back.out(2.2)', stagger: 0.025 }, 0.12)
      .from(root.querySelectorAll('.pl-item:not(.on)'), { x: -220, rotation: -12, opacity: 0, duration: 0.26, ease: 'back.out(1.8)', stagger: 0.045, clearProps: 'transform,opacity' }, 0.22)
      // the picked chapter's number spins onto the starburst WITH its chapter, on the first beat (Nov 21,
      // the speed pass: at 0.3 s, its first frame at 2.2x was the screen's "largest paint" and landed after
      // the fonts, so a phone's load score charged it their whole download: LCP ~3.7 s on /#/board)
      .from(root.querySelector('.cmd-right'), { scale: 2.2, rotation: 25, opacity: 0, duration: 0.3, ease: 'back.out(1.7)', clearProps: 'transform,opacity' }, 0)
      .from(loot.children, { x: -60, scale: 1.5, rotation: () => gsap.utils.random(-18, 18), opacity: 0, duration: 0.24, ease: 'back.out(2.4)', stagger: 0.06, clearProps: 'transform,opacity' }, 0.4)
      .from(root.querySelector('.plan-head'), { y: -40, opacity: 0, duration: 0.26, ease: 'power3.out', clearProps: 'transform,opacity' }, 0.34)
      .from(root.querySelectorAll('.pp'), { scale: 1.8, rotation: () => gsap.utils.random(-20, 20), opacity: 0, duration: 0.24, ease: 'back.out(2.6)', stagger: 0.06, clearProps: 'transform,opacity' }, 0.46)
      .from(root.querySelector('#progressChip'), { opacity: 0, duration: 0.2, clearProps: 'opacity' }, 0.6);
    // every piece takes its starting pose the moment the timeline is built (immediateRender), so
    // the finished screen never shows for a moment before it blanks and builds (DESIGN.md forbids it)
    gsap.delayedCall(delay, () => tl.play());
    return tl;
  }

  return { reveal, refresh, demo() {} };
}
