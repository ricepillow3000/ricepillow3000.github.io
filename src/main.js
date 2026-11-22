import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/scenes.css';
import './styles/print.css';
import './styles/backdrop.css';
import './styles/board.css';
import './styles/pages.css';
import './styles/intro.css';
import './styles/saves.css';

import { gsap } from 'gsap';
import { resume } from './data/resume.js';
import { readCompany } from './data/companies.js';
import { store } from './core/store.js';
import { runLoader, introOpen } from './ui/loader.js';
import { maybeRotateHint } from './ui/rotate.js';
import { initFullscreen } from './ui/fullscreen.js';
import { $, $$, esc, reducedMotion, fontsReady } from './core/util.js';
import { menuTeasers } from './data/script.js';
import { mountBackdrop, sceneReady } from './fx/backdrop.js';
import { holdSign } from './fx/station.js';
import { initZoom, onZoom, isZoomed } from './core/zoom.js';
import { initClickFx, burst } from './fx/impact.js';
import { initMagnetic, initTilt, initScrollMeter, slamOnScroll, scramble, rollIn } from './fx/kinetic.js';
import { initTooltips } from './ui/tooltip.js';
import { initClearing, hydrateStamps } from './ui/clear.js';
import { progress } from './core/progress.js';
import { caseWipe, panelsWipe, glassWipe, cityWipe, crtWipe } from './fx/menuwipes.js';
import { fallWipe, riseWipe, trainWipe, cardWipe, preloadFilm, slashWipe, paperWipe, titlePunch, tunnelWipe, cutIn, enter, skipCurrent, isAnimating, shake } from './fx/transitions.js';
import { ransom, dropIn, NAME_SEED } from './ui/ransom.js';
import { startCalendar } from './ui/hud.js';
import { watchTitleFit } from './ui/titlefit.js';
import { createBoard, CHAPTERS, STATIONS } from './scenes/board.js';
import { openSaves, savesOpen, savesKey } from './scenes/saves.js';
import { toast } from './ui/toast.js';
import { createMenu, MENU_ITEMS } from './scenes/menu.js';
import { SECTION_RENDERERS, SECTION_TITLES, dossierMarkup, animateDossier } from './scenes/sections.js';
import { renderQuickView } from './scenes/quickview.js';
import { sfx, setSound, setMusicVolume, initAudio } from './audio/audio.js';
import { unlock, refreshCounter, listMarkup, count, ACHIEVEMENTS } from './eggs/achievements.js';
import { armBee } from './eggs/bee.js';
import { installConsole } from './eggs/console.js';
import { bindInput, bindGamepad } from './input/input.js';

/* ---------------------------------------------------------------- setup */
const company = readCompany();
const ctx = { company };
mountBackdrop($('#backdrop'));
/* "Off the Record": the GPA star on the person card flips to the fun stats */
function flipGpa() {
  const b = $('.screen.active .gpa-burst') || $('.gpa-burst');
  if (!b) return;
  const on = !b.classList.contains('flipped');
  b.classList.toggle('flipped', on);
  b.setAttribute('aria-pressed', String(on));
  sfx(on ? 'hvPerson' : 'back');
  if (on) unlock('off-record');
}
document.addEventListener('click', (e) => {
  if (e.target.closest?.('.gpa-burst')) flipGpa();
});
const menu = createMenu((id) => navigate(id));
startCalendar();
watchTitleFit();

let screen = null; // title | board | page | quick
const SLAM_PAGE = '.sq, .sys, .stop-card, .crew-row, .wanted-slot, .idcard, .panel'; // page blocks that punch in on scroll
/* ...and each kind is heard as it lands (Nov 19, John: "scrolling down, I don't hear the sound effects
   for each box"; "don't make all the sound effects sound the same") */
const SLAM_VOICE = [['.panel', 'panelSlap'], ['.idcard', 'cardSnap'], ['.wanted-slot', 'staple'], ['.sys, .sq', 'panelOn'], ['.crew-row', 'rowSlide']];
function slamSound(el) {
  const hit = SLAM_VOICE.find(([sel]) => el.matches(sel));
  if (!hit) return;
  const all = [...$$(`#page ${hit[0]}`)];
  sfx(hit[1], Math.max(0, all.indexOf(el)));
}
const MENU_KEY = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘\u00A0K' : 'CTRL\u00A0K'; // shown in the key hints
let pageId = null;
let pendingStart = false;
let lastFocus = null;

document.body.classList.toggle('reduce-motion', store.get().settings.reduceMotion === true);
ransom($('#titleName'), resume.first, NAME_SEED);
$('#titleHook').innerHTML = `<span>${esc(resume.titleHook || resume.hook)}</span>`; // (the span carries the black: it hugs each line of words, see .title-hook)
// who + proof in the first 10 seconds (two clean lines on phones)
$('#titleRole').innerHTML = `<span>${esc(resume.role)}</span><span class="tr-sep"> · </span><span class="tr-proof">2 live apps · 2,000+ tests</span>`;
/* the contact plate at the top of every screen (Nov 19, career advisor at GSU's Codex meetup:
   "make LinkedIn, GitHub and email easy to see, at the very top") */
// and on the title, the same three in the red CONNECT card (the plate steps aside there)
const EMAIL = resume.links.email.toLowerCase();
['#hudLinkedIn', '#ccLinkedIn'].forEach((s) => { $(s).href = resume.links.linkedin; });
['#hudGitHub', '#ccGitHub'].forEach((s) => { $(s).href = resume.links.github; });
const hudEmail = $('#hudEmail');
hudEmail.dataset.tip = EMAIL;
hudEmail.setAttribute('aria-label', `Email ${EMAIL} (the address is also copied)`);
$('#ccEmail').dataset.tip = EMAIL;
[hudEmail, $('#ccEmail')].forEach((a) => {
  a.href = `mailto:${resume.links.email}`;
  // many visitors have no mail app set up, so the address is copied too (mailto still opens)
  a.addEventListener('click', () => {
    try {
      navigator.clipboard?.writeText(EMAIL).then(() => toast(EMAIL, 'EMAIL COPIED'), () => {});
    } catch { /* no clipboard: the mail app still opens */ }
  });
});
$('#quickPdf').href = resume.links.pdf;
renderQuickView($('#paper'));
refreshCounter();
installConsole();
syncSoundButton();

/* ---------------------------------------------------------------- routing */
const VALID = new Set(['title', 'board', 'quick', ...Object.keys(SECTION_RENDERERS)]);

function route() {
  const raw = window.location.hash.replace(/^#\/?/, '') || 'title';
  const id = raw === 'talk' ? 'board' : raw; // old links still work
  return VALID.has(id) ? id : 'title';
}

/* Closing a case file steps history back, which lands a moment later. A jump made in that
   moment (e.g. Esc then Q) waits for it, or the late Back would undo the jump. */
let backPending = false;
let pendingNav = null;
function flushNav() {
  backPending = false;
  const id = pendingNav;
  pendingNav = null;
  if (id) navigate(id);
}
function navigate(id) {
  if (backPending) {
    pendingNav = id;
    return;
  }
  const hash = id === 'title' ? '#/' : `#/${id}`;
  if (window.location.hash === hash) show(id);
  else window.location.hash = hash;
}

window.addEventListener('hashchange', () => show(route()));

const modeOf = (id) => (id === 'title' || id === 'board' ? id : id === 'quick' ? 'quick' : 'page');

let activated = false;
function activate(id) {
  const mode = modeOf(id);
  document.body.dataset.screen = id;
  document.body.dataset.mode = mode;
  if (mode !== 'title') store.touch(mode === 'page' ? id : mode); // (where this file was left: its save slip shows it)
  $$('.screen').forEach((s) => s.classList.remove('active'));
  const el = mode === 'page' ? $('#screen-page') : $(`#screen-${mode}`);
  el.classList.add('active');
  if (activated) el.scrollTop = 0; // (not on the first screen: nothing is scrolled yet, and it forced a layout while the page loaded)
  activated = true;
  document.body.classList.remove('scrolled');
  renderKeyHints(mode);
  requestAnimationFrame(syncMeter);
}

/* Every chapter has ONE signature entrance, played however the visitor gets there (THE PLAN, NEXT
   EPISODE, the stop dots, the menu, a number key), so the guided ride start to finish shows six
   different moves and never the same one twice (Nov 18, John: "every tab when switching has a
   different transition"). Back to THE PLAN is THE RISE; Quick View is paper. */
const CHAPTER_STYLE = { stats: 'fall', missions: 'casefile', skills: 'train', 'side-quests': 'city', different: 'panels', contact: 'card', system: 'crt', secret: 'glass' };
const WIPES = { fall: fallWipe, rise: riseWipe, train: trainWipe, card: cardWipe, slash: slashWipe, paper: paperWipe, casefile: caseWipe, panels: panelsWipe, glass: glassWipe, city: cityWipe, crt: crtWipe };
/* Focus a target once its entrance animation has made it visible (a hidden element can't take focus).
   Gives up if the visitor has already moved focus somewhere themselves. */
function focusSoon(el, tries = 16, from = document.activeElement) {
  if (!el) return;
  el.focus({ preventScroll: true });
  if (document.activeElement === el || tries <= 0) return;
  setTimeout(() => {
    const now = document.activeElement;
    if (el.isConnected && (now === document.body || now === null || now === from)) focusSoon(el, tries - 1, from);
  }, 100);
}

/* A page's entrance: the slash wipe ends on a big title slam; every page then builds its parts in. */
function pageEnter(id, punch) {
  if (punch) titlePunch(SECTION_TITLES[id] || id.toUpperCase());
  $$('#page [data-ransom]').forEach((h, i) => dropIn(h, i * 0.05));
  enter($('#page')); // back button, subtitle and other [data-in] items
  pageIntro?.($('#page')); // each page's own entrance
  slamOnScroll($('#page'), SLAM_PAGE, slamSound); // blocks further down punch in (and are heard) when you reach them
  stabStop($('#page'), navSeq); // the dagger marks the stop you're at
}

let navSeq = 0; // a newer navigation cancels whatever an older one still had left to do
async function show(id) {
  const prev = screen;
  if ((prev === 'page' && pageId === id) || (prev === id && id !== 'page')) {
    menu.close();
    return;
  }
  const tok = ++navSeq;
  closeModal();
  const mode = modeOf(id);
  let style = null; // which wipe this move uses; decided before the swap runs

  const swap = () => {
    if (tok !== navSeq) return;
    menu.close(false); // the menu stays up until the transition covers it: the old screen never flashes back
    activate(id);
    screen = mode === 'page' ? 'page' : id;
    pageId = mode === 'page' ? id : null;
    if (mode === 'page') {
      renderPage(id);
      pageEnter(id, style === 'slash' || prev === null); // builds in while the wipe lifts: no full page, blank, rebuild
    }
    if (mode !== 'page') { guideObs?.disconnect(); guideScroll = null; clearTimeout(guideTimer); guide.hidden = true; }
    if (mode === 'board') enterBoard();
  };

  if (prev === null) {
    revealBuilt = true; // the first screen of the visit: it sits under the loading screen
    swap();
    revealBuilt = false;
  } else if (prev === 'title' && id === 'board' && pendingStart) {
    pendingStart = false;
    revealDelay = 0.28; // the screen swaps under the star-flash; THE PLAN slams in as it clears and the city fades up
    await tunnelWipe(swap);
  } else {
    style = mode === 'page' && CHAPTER_STYLE[id]
      ? CHAPTER_STYLE[id]
      : mode === 'board' && prev !== 'title'
      ? 'rise'
      : mode === 'quick'
        ? 'paper'
        : 'slash';
    await WIPES[style](swap, SECTION_TITLES[id] || '');
  }
  if (tok !== navSeq) return;

  if (mode === 'title') introTitle();
  if (mode === 'page') {
    const target = $('#page [data-nav]:not(.ss-dot)') || $('#page .back-btn');
    focusSoon(target);
    // entrance animations that finish later can knock focus back to <body>; once they settle, put it back
    setTimeout(() => {
      if (tok === navSeq && target?.isConnected && (document.activeElement === document.body || document.activeElement === null)) focusSoon(target);
    }, 1400);
  }
  if (mode === 'quick') {
    track('quick_view');
    focusSoon($('#screen-quick .btn'));
  }
}

/* ---------------------------------------------------------------- title */
function introTitle() {
  renderStartLabel();
  // the cut-out name and the title's labels wait for their fonts (max ~1.2s) so they never flash
  // in a backup font; the hook below shows right away
  const scr = $('#screen-title');
  scr.classList.add('title-wait');
  fontsReady().then(() => {
    scr.classList.remove('title-wait');
    dropIn($('#titleName'), 0.15);
    if (!reducedMotion()) gsap.from('#screen-title .title-codename, #screen-title .title-role, #pressStart, #screen-title .quick-link', { x: -40, opacity: 0, stagger: 0.08, duration: 0.35, delay: 0.35, ease: 'back.out(2)', clearProps: 'all' });
  });
  if (!reducedMotion()) {
    // the hook is the biggest text on the first screen: it slides in but is visible from the first frame,
    // so phones paint it right away (it used to wait ~0.6s at opacity 0, which slowed the load score)
    gsap.from('#screen-title .title-hook', { x: -40, duration: 0.4, ease: 'power3.out', clearProps: 'all' });
  }
  setTimeout(() => { if (!document.querySelector('.rot')) $('#pressStart').focus({ preventScroll: true }); }, 50); // (not while the turn-your-phone reminder holds focus)
  // the loading star's doorway opens onto it: the title lands with a punch (motion only: it was
  // already drawn under the star, so its first paint, and the load score, never wait on the intro)
  if (!reducedMotion()) introOpen.then(() => gsap.fromTo('#screen-title .title-block', { scale: 1.1, rotation: -2 }, { scale: 1, rotation: 0, duration: 0.5, delay: 0.25, ease: 'back.out(2.2)', clearProps: 'transform' }));
}

/* ---------------------------------------------------------------- saved progress */
let lastDone = null;
function renderProgress(celebrate) {
  const chip = $('#progressChip');
  if (!chip) return;
  const p = progress();
  const left = p.items.filter((i) => !i.done).map((i) => i.label);
  chip.classList.toggle('all', p.all);
  // the spoken name starts with the words on screen (PROGRESS 2/8), then says what's left
  chip.setAttribute('aria-label', p.all ? 'PROGRESS ALL CLEAR!' : `PROGRESS ${p.done}/${p.total} 6 chapters + 2 project visits. Still to do: ${left.join(', ')}`);
  chip.title = p.all ? 'Everything cleared. Thanks for playing.' : `Still to do: ${left.join(' · ')}`;
  chip.innerHTML = p.all
    ? '<span class="pc-label">PROGRESS</span> <span class="pc-all">ALL CLEAR!</span>'
    : `<span class="pc-label">PROGRESS</span> <span class="pc-count"><b>${p.done}</b>/${p.total}</span>
       <span class="pc-bar" aria-hidden="true">${p.items.map((i) => `<i class="${i.done ? 'on' : ''}"></i>`).join('')}</span>
       <span class="pc-hint" aria-hidden="true">6 chapters + 2 project visits</span>`;
  if (celebrate && !reducedMotion()) gsap.fromTo(chip, { scale: 1.6, rotation: -12 }, { scale: 1, rotation: -3, duration: 0.5, ease: 'elastic.out(1.4, .4)' });
  else if (lastDone !== null && p.done > lastDone) rollIn(chip.querySelector('.pc-count b')); // one more case rolls in
  lastDone = p.done;
}
let wasAll = progress().all;
let switchingFile = false; // (loading a finished file from SAVE DATA is not a new ALL CLEAR)
store.onChange(() => {
  const p = progress();
  if (switchingFile) { wasAll = p.all; renderProgress(false); return; }
  renderProgress(p.all && !wasAll);
  if (p.all && !wasAll) {
    setTimeout(() => {
      toast('Every case cleared. Thanks for playing.', 'ALL CLEAR!');
      sfx('treasure');
    }, 1600);
  }
  wasAll = p.all;
});

/* The title's button: PRESS START for a first visit, CONTINUE once any file is saved; either way it opens
   SAVE DATA (src/scenes/saves.js), where the visitor continues a file or starts a new one. The old save
   line under the button ("Save found · Start over") is gone (Nov 19, John): files are erased there. */
function renderStartLabel() {
  $('#pressStart').textContent = store.slots().some(Boolean) ? 'CONTINUE' : 'PRESS START';
  $('#saveLine')?.remove();
}
renderStartLabel();

/* PRESS START / CONTINUE always opens with the train (Nov 19, John: "the train is going to be the
   main title every single time"). If the platform or the train art isn't ready yet (a returning
   visitor taps CONTINUE before the phone has loaded the scene), the button "boards" for a moment
   while they load (up to 20 s), then the shot plays. */
let starting = false;
$('#pressStart').addEventListener('click', () => {
  if (starting || savesOpen()) return;
  sfx('select');
  openSaves({ onPick: startFile, onClose: () => { renderStartLabel(); $('#pressStart').focus({ preventScroll: true }); } });
});
/* a file was picked: load it (or start it new), then the train, as PRESS START always did */
async function startFile(i) {
  if (starting) return;
  starting = true;
  holdSign(true); // (a file is being played: from here to the end of the train shot the departure board does not move or first appear, see station.js)
  switchingFile = true;
  store.useSlot(i);
  switchingFile = false;
  // (THE PLAN refreshes from the active file every time it is shown)
  refreshCounter();
  renderStartLabel();
  const btn = $('#pressStart');
  unlock('first-words');
  if (!reducedMotion() && !isZoomed()) { // (zoomed in, the shot goes straight to its end: there is no train to wait for)
    let late = false;
    const wait = sceneReady();
    const t = setTimeout(() => { late = true; btn.classList.add('boarding'); btn.setAttribute('aria-busy', 'true'); }, 120);
    // (Nov 21: the cap was 4 s, and on a slow phone the shot then played with no train: the button now boards
    // until the train is really here, up to 20 s; past that the shot is skipped, never played empty)
    await Promise.race([wait, new Promise((r) => setTimeout(r, 20000))]);
    clearTimeout(t);
    if (late) { btn.classList.remove('boarding'); btn.removeAttribute('aria-busy'); }
  }
  starting = false;
  pendingStart = true;
  navigate('board');
}

/* play time on the active file: counted while the page is in view and past the title */
{
  let at = performance.now();
  setInterval(() => {
    const now = performance.now();
    if (!document.hidden && screen && screen !== 'title') store.addPlay(now - at);
    at = now;
  }, 15000);
  document.addEventListener('visibilitychange', () => { at = performance.now(); });
}

/* ---------------------------------------------------------------- heist board */
const syncMeter = initScrollMeter();
// load the film-cut art once the visitor first acts (or ~6s in), never during the first paint:
// a phone decoding big images would otherwise hold back the title text
{
  const go = () => {
    ['pointerdown', 'keydown'].forEach((t) => window.removeEventListener(t, go, true));
    preloadFilm();
  };
  ['pointerdown', 'keydown'].forEach((t) => window.addEventListener(t, go, { capture: true, once: true, passive: true }));
  window.addEventListener('load', () => setTimeout(go, 6000), { once: true });
}
initClickFx();
initMagnetic();
initTilt();
initTooltips();
$('#menuBtn').dataset.tip = `MENU · ${MENU_KEY}`;
// the top buttons tick on hover like every other control
// (the top bar's hover chink comes from the shared hover sound in src/fx/impact.js)
/* Once you scroll, the date (top-left) and stat box (bottom-left) slide away so they
   never sit on top of text; they snap back when you return to the top. */
$$('.screen').forEach((sc) =>
  sc.addEventListener('scroll', () => {
    if (sc.classList.contains('active')) document.body.classList.toggle('scrolled', sc.scrollTop > 30);
  }, { passive: true })
);
initClearing();
const board = createBoard($('#board'), ctx);

let boardSeen = false;
let revealDelay = 0;
let revealBuilt = false; // (set by show() for the visit's first screen: see board.reveal)
function enterBoard() {
  renderProgress();
  board.reveal(revealDelay, revealBuilt);
  revealDelay = 0;
  focusSoon($('#board .plan-continue'));
  if (!boardSeen) {
    boardSeen = true;
    soundHint();
    armBee(() => screen === 'board', onBee);
  }
}

function onBee() {
  unlock('bee');
  shake();
  toast('BEE!! Get it away!', 'JOHN');
}

/* ---------------------------------------------------------------- section pages */
let pageIntro = null;
/* Each page gets its own visual system: tag the page root with its id. */
function root0Class(id) {
  $('#page').className = `page-inner pg-${id}`;
}
/* NEXT EPISODE: the end of every story page is a "next time" card, studied from Lusion's
   scroll-to-next-page bar. Keep scrolling (or swiping) past the bottom and the fuse fills;
   when it's full the next chapter rolls in with THE DROP. A click or Enter does it at once. */
const EPISODES = CHAPTERS; // the resume in reading order (src/scenes/board.js)
/* THE GUIDE (Nov 18): the visitor is walked through the resume like a train ride.
   Every chapter opens with a STOP strip (where you are on the line, tap any stop), and a guide
   button at the bottom says what's next until the NEXT STOP card itself comes into view. */
function stopStripMarkup(id) {
  const i = CHAPTERS.indexOf(id);
  if (i < 0) return '';
  const seen = store.get().visited || [];
  const pad = (n) => String(n).padStart(2, '0');
  /* THE LINE MAP (Nov 20, John: "instead of a circle, a very unique Persona 5 design-like placeholder...
     station names above... when the transition plays, a dagger will stab that placeholder"): each stop
     is a jagged ticket tile with its number (white = ahead, black with a red cut = passed, red = here),
     the line runs red as far as you've come, each station's name rises off its tile like a transit
     map's, and a stiletto is driven into the stop you're at (stabStop, after the entrance). */
  return `<nav class="stop-strip" aria-label="You are at stop ${i + 1} of ${CHAPTERS.length}, ${esc(STATIONS[id])}">
    <span class="ss-label">STOP <b>${pad(i + 1)}</b> / ${pad(CHAPTERS.length)}</span>
    <ol class="ss-line" style="--at:${i}">${CHAPTERS.map((c, k) => `<li class="ss-stop${k === i ? ' now' : seen.includes(c) ? ' seen' : ''}"><a class="ss-dot${k === i ? ' now' : seen.includes(c) ? ' seen' : ''}" href="#/${c}" data-nav aria-label="Stop ${k + 1}, ${esc(STATIONS[c])}, ${esc(SECTION_TITLES[c])}${k === i ? ' (you are here)' : ''}"${k === i ? ' aria-current="step"' : ''}><span class="ss-num">${pad(k + 1)}</span></a><span class="ss-name" aria-hidden="true">${esc(STATIONS[c])}</span>${k === i ? DAGGER : ''}</li>`).join('')}</ol>
  </nav>`;
}
/* the stiletto (Nov 20, John: "I don't like the design of the dagger... just make it white, but shade it
   black for shadows... ask Gemini to make a photo of a dagger just like in this reference, 1:1"): an
   original dagger generated by Gemini (Nano Banana Pro, a 1024x1024 square) in that comic style, all
   white with flat black ink shadows and outlines, thick, ring pommel, a twisted grip, scroll quillons;
   keyed off its green screen, cropped with its point at the bottom centre (where it goes into the paper),
   120x330 WebP (10 KB; the hole in its ring pommel filled white, so nothing behind shows through it as a
   dot). Two copies (Nov 20, John: "instead of the knife cutting the box, it's like poking through it"):
   one in front of the ticket down to the point of entry, one behind it whose point comes out under the
   ticket (CSS clips each); and the small slit it pokes in the paper. */
const DAGGER = `<span class="ss-dagger-back" aria-hidden="true"><img src="assets/film/dagger.webp" alt="" width="120" height="330" decoding="async"></span><span class="ss-dagger" aria-hidden="true"><img src="assets/film/dagger.webp" alt="" width="120" height="330" decoding="async"></span><span class="ss-tear" aria-hidden="true"><svg viewBox="0 0 20 10"><path d="M1.5 5 Q10 1.6 18.5 5 Q10 8.4 1.5 5 Z" fill="#0B0B0B"/><path d="M3 6.1 Q10 9.2 17 6.1" fill="none" stroke="#F5F5F0" stroke-width="1.1" stroke-linecap="round"/><path d="M1.5 5 Q-.5 3.6 -2 3.4 M18.5 5 Q20.6 6.4 22 6.6" fill="none" stroke="#0B0B0B" stroke-width=".8" stroke-linecap="round"/></svg></span>`;
/* The dagger is THROWN at the stop once the chapter has landed (the entrance's wipe has lifted): it flies
   in from the camera like a dart, punches in (the ticket rips, chips fly, the line jolts, a white flash),
   then rattles on its point and settles (Nov 20, John: "violently stabs the box... a tear in the box like
   paper... like a throwing dart, when you throw it, it lands, it shakes like a rattle"). */
function stabStop(root, tok) {
  const li = root.querySelector('.ss-stop.now');
  if (!li?.querySelector('.ss-dagger')) return;
  if (reducedMotion()) { li.classList.add('in'); setTimeout(() => { if (tok === navSeq && li.isConnected) sfx('stab'); }, 650); return; } // (still, but still heard)
  setTimeout(() => {
    if (tok !== navSeq || !li.isConnected) return;
    li.classList.add('stab');
    sfx('stab'); // (its point bites in at 0.16 s, the frame it lands)
    /* once it has settled, the throw's animations are dropped for the still pose (.in, the same picture).
       Left on their last frame (fill-mode both), iPhone Safari kept the line on its own GPU layer and, after
       a scroll down and back up, redrew it cut to the line's 40px box: the station names and the dagger's
       handle were sliced off (Nov 21, John's phone held sideways). */
    setTimeout(() => { if (li.isConnected) { li.classList.add('in'); li.classList.remove('stab'); } }, 1200);
  }, 650);
}
const guide = document.createElement('button');
guide.type = 'button';
guide.className = 'guide';
guide.hidden = true;
guide.innerHTML = '<span class="g-arrow" aria-hidden="true">↓</span><span class="g-text"></span>';
document.body.appendChild(guide);
let guideObs = null;
function updateGuide(id) {
  guideObs?.disconnect();
  guide.hidden = true;
  const i = CHAPTERS.indexOf(id);
  const ep = $('#page .next-ep');
  const sc = $('#screen-page');
  const nextId = CHAPTERS[i + 1];
  if (i < 0 || !ep || !nextId) return; // the last stop has no "next": its card says THE END
  guide.querySelector('.g-text').textContent = `NEXT: ${SECTION_TITLES[nextId]}`;
  guide.setAttribute('aria-label', `Scroll on. Next stop: ${SECTION_TITLES[nextId]}`);
  // a small corner chip, only while there is more page below and the visitor has paused (never
  // over content while they scroll); it bows out once the NEXT STOP card is on screen
  let epVisible = false;
  // (Nov 21 evaluation: the chip sat over whatever the visitor had stopped to read, a skill's level meter, a fact's
  // last line. When its label would cover the page's words it shrinks to just its arrow in the corner, and if even
  // that would, it stays away until the next pause.)
  const covers = () => {
    const r = guide.getBoundingClientRect(); const page = $('#page');
    if (!page || !r.width) return false;
    const hit = (q) => q.width && q.height && q.left < r.right - 2 && q.right > r.left + 2 && q.top < r.bottom - 2 && q.bottom > r.top + 2;
    for (const el of page.querySelectorAll('*')) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own && !el.matches('i, img, svg, b')) continue;
      const q = el.getBoundingClientRect();
      if (q.bottom < 0 || q.top > innerHeight) continue;
      if (hit(q)) {
        if (own) { const rg = document.createRange(); rg.selectNodeContents(el); if (![...rg.getClientRects()].some(hit)) continue; } // (the words themselves, not their box's empty end)
        return true;
      }
    }
    return false;
  };
  const show = () => {
    guide.classList.remove('mini');
    if (epVisible || screen !== 'page' || pageId !== id) { guide.hidden = true; return; }
    guide.style.visibility = 'hidden'; guide.hidden = false; // (measured in place before it is seen)
    if (covers()) { guide.classList.add('mini'); if (covers()) guide.hidden = true; }
    guide.style.visibility = '';
  };
  guideObs = new IntersectionObserver(([e]) => { epVisible = e.isIntersecting; show(); }, { root: sc, threshold: 0.35 });
  guideObs.observe(ep);
  guideScroll = () => {
    guide.hidden = true;
    clearTimeout(guideTimer);
    guideTimer = setTimeout(show, 900);
  };
}
let guideScroll = null;
let guideTimer = 0;
$('#screen-page').addEventListener('scroll', () => guideScroll?.(), { passive: true });
guide.addEventListener('click', () => {
  sfx('select');
  $('#page .next-ep')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
});

function nextEpisodeMarkup(id) {
  const i = EPISODES.indexOf(id);
  if (i < 0) return '';
  const next = EPISODES[i + 1] || 'board';
  const title = next === 'board' ? 'BACK TO THE PLAN' : SECTION_TITLES[next];
  const tease = next === 'board' ? 'All six chapters on one screen' : menuTeasers[next] || '';
  return `<section class="next-ep" aria-label="Next episode">
    <p class="ne-kicker">${i === EPISODES.length - 1 ? 'THE END · FOR NOW' : `NEXT EPISODE · ${String(i + 2).padStart(2, '0')}`}</p>
    <button class="ne-go" type="button" data-episode="${next}"><span class="ne-title">${esc(title)} ▸</span><span class="ne-tease">${esc(tease)}</span></button>
    <div class="ne-fuse" aria-hidden="true"><i></i></div>
    <p class="ne-hint" aria-hidden="true"><span class="hint-desk">Keep scrolling to roll it</span><span class="hint-phone">Keep swiping up to roll it</span></p>
  </section>`;
}
let epFuse = 0;
let epBottomSince = 0;
let epLastPush = 0;
let epRaf = 0;
function epReset() {
  epFuse = 0;
  epBottomSince = 0;
  epDraw();
}
function epDraw() {
  const bar = $('#page .ne-fuse i');
  if (bar) bar.style.transform = `scaleX(${epFuse.toFixed(3)})`;
  $('#page .next-ep')?.classList.toggle('lit', epFuse > 0);
}
function epDecay(now) {
  epRaf = 0;
  if (now - epLastPush > 300) epFuse = Math.max(0, epFuse - 0.035); // let go and the fuse burns back down
  epDraw();
  if (epFuse > 0) epRaf = requestAnimationFrame(epDecay);
}
function pushEpisode(amount) {
  const sc = $('#screen-page');
  if (screen !== 'page' || !$('#page .next-ep') || isAnimating() || !$('#modal').hidden || menu.isOpen()) return;
  const now = performance.now();
  if (sc.scrollTop + sc.clientHeight < sc.scrollHeight - 4) {
    epBottomSince = 0;
    return;
  }
  // a scroll that is still coasting when it hits the bottom doesn't count: arrive, then push
  if (!epBottomSince) epBottomSince = now;
  if (now - epBottomSince < 350) return;
  epLastPush = now;
  epFuse = Math.min(1, epFuse + amount);
  epDraw();
  if (epFuse >= 1) rollEpisode();
  else if (!epRaf) epRaf = requestAnimationFrame(epDecay);
}
function rollEpisode() {
  const b = $('#page [data-episode]');
  if (!b) return;
  epReset();
  sfx('select');
  navigate(b.dataset.episode);
}
{
  const sc = $('#screen-page');
  sc.addEventListener('wheel', (e) => e.deltaY > 0 && pushEpisode(Math.min(e.deltaY, 120) / 520), { passive: true });
  let ty = null;
  sc.addEventListener('touchstart', (e) => (ty = e.touches[0].clientY), { passive: true });
  sc.addEventListener('touchmove', (e) => {
    const y = e.touches[0].clientY;
    if (ty !== null && ty - y > 0) pushEpisode((ty - y) / 420);
    ty = y;
  }, { passive: true });
  sc.addEventListener('click', (e) => e.target.closest('[data-episode]') && rollEpisode());
}

function renderPage(id) {
  const r = SECTION_RENDERERS[id](ctx);
  pageIntro = r.intro || null;
  root0Class(id);
  const root = $('#page');
  root.innerHTML = r.html + nextEpisodeMarkup(id);
  const backBtn = root.querySelector('.back-btn');
  if (backBtn && CHAPTERS.includes(id)) {
    // the back button and the stop strip share one row, so the content starts sooner
    backBtn.insertAdjacentHTML('beforebegin', '<div class="page-top"></div>');
    const top = root.querySelector('.page-top');
    top.appendChild(backBtn);
    top.insertAdjacentHTML('beforeend', stopStripMarkup(id));
  }
  epReset();
  root.querySelectorAll('[data-ransom]').forEach((h, i) => ransom(h, h.dataset.ransom, i + id.length));
  root.querySelectorAll('[data-mission]').forEach((b) => b.addEventListener('click', () => openDossier(b.dataset.mission, b)));
  root.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => toggleSetting(b)));
  root.querySelector('#musicVol')?.addEventListener('input', (e) => setMusicVolume(Number(e.target.value)));
  r.after?.(root);
  hydrateStamps(root);
  if (id === 'contact') sfx('sparkle');
  store.addTo('visited', id);
  if (CHAPTERS.every((c) => store.has('visited', c))) unlock('full-recon'); // every chapter opened
  updateGuide(id);
}

let cutinShown = false;
async function openDossier(id, row) {
  const m = resume.missions.find((x) => x.id === id);
  sfx('select');
  if (m.bestStat && !cutinShown) {
    cutinShown = true;
    const at = navSeq;
    await cutIn(`${m.bestStat} CAUGHT`);
    if (at !== navSeq || !$('#modal').hidden || menu.isOpen()) return; // the visitor moved on during the cut-in
  }
  openModal(dossierMarkup(m));
  scramble($('#modalPanel .dossier-code')); // the file code "decrypts" as it opens
  animateDossier($('#modalPanel'), () => {
    sfx('thwack');
    shake($('#modalPanel'));
    const st = $('#modalPanel .loot li:last-child');
    if (st) {
      const r = st.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, 1.2);
    }
  });
  if (reducedMotion()) sfx('thwack');
  store.addTo('opened', id);
  hydrateStamps($('#modalPanel'));
  unlock('case-file');
}

function toggleSetting(b) {
  const on = b.getAttribute('aria-pressed') !== 'true';
  b.setAttribute('aria-pressed', String(on));
  b.textContent = on ? 'ON' : 'OFF';
  if (b.dataset.toggle === 'sound') {
    setSound(on);
    syncSoundButton();
  } else {
    store.setSetting('reduceMotion', on);
    document.body.classList.toggle('reduce-motion', on);
  }
  sfx('toggle');
}

/* ---------------------------------------------------------------- modal */
let closing = null;
let modalEntry = false; // this visit added a history entry for the open file
function openModal(html) {
  if (closing) {
    closing.kill();
    closing = null;
    $('#modal').classList.remove('closing');
    gsap.set('#modalPanel', { clearProps: 'all' });
  }
  lastFocus = document.activeElement;
  $('#modalPanel').innerHTML = html;
  $$('#modalPanel [data-ransom]').forEach((t) => ransom(t, t.dataset.ransom, 5)); // titles in cut-out letters
  $('#modal').hidden = false;
  setBehindModal(true);
  $('#modalPanel [data-close]')?.focus({ preventScroll: true });
  // the phone's back gesture / browser Back closes the file instead of leaving the page
  try {
    if (!modalEntry) {
      window.history.pushState({ modal: true }, '');
      modalEntry = true;
    }
  } catch {
    /* history unavailable (sandboxed frame): Back simply navigates */
  }
}

/* While a file is open, the page behind it can't be tabbed into or clicked (a real modal). */
function setBehindModal(on) {
  $$('#app, .hud-tl, .hud-tr, #menu, .skip-link').forEach((el) => (el.inert = on));
}

function closeModal(fromBack = false) {
  if ($('#modal').hidden || closing) return false;
  setBehindModal(false); // before focus goes back: inert elements can't take focus
  if (modalEntry) {
    modalEntry = false;
    try {
      // drop the entry the file added (only if it is still the current one)
      if (!fromBack && window.history.state?.modal) {
        backPending = true;
        setTimeout(() => backPending && flushNav(), 500); // in case Back never reports in
        window.history.back();
      }
    } catch {
      /* ignore */
    }
  }
  const done = () => {
    closing = null;
    $('#modal').hidden = true;
    $('#modal').classList.remove('closing');
    $('#modalPanel').innerHTML = '';
    gsap.set('#modalPanel', { clearProps: 'all' });
  };
  lastFocus?.focus?.({ preventScroll: true });
  if (reducedMotion()) {
    done();
    return true;
  }
  $('#modal').classList.add('closing');
  closing = gsap.to('#modalPanel', { scale: 0.82, rotation: 4, y: 40, opacity: 0, duration: 0.16, ease: 'power3.in', onComplete: done });
  return true;
}

/* Tab and Shift+Tab cycle inside the open file instead of escaping to the browser bar. */
$('#modal').addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const items = [...$('#modalPanel').querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});

window.addEventListener('popstate', () => {
  if (backPending) return flushNav(); // our own step back from closing a file
  if (!$('#modal').hidden) closeModal(true);
});

/* Swipe down on an open file (from its top) to dismiss it, like a phone sheet. */
{
  const panel = $('#modalPanel');
  let y0 = null;
  let dy = 0;
  panel.addEventListener('touchstart', (e) => {
    y0 = panel.scrollTop <= 0 && e.touches.length === 1 ? e.touches[0].clientY : null;
    dy = 0;
  }, { passive: true });
  panel.addEventListener('touchmove', (e) => {
    if (y0 === null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    panel.style.translate = `0 ${dy}px`;
    panel.style.opacity = String(1 - Math.min(dy / 500, 0.4));
  }, { passive: true });
  panel.addEventListener('touchend', () => {
    if (y0 === null) return;
    y0 = null;
    if (dy > 110) {
      sfx('back');
      closeModal();
      return;
    }
    if (dy > 0 && panel.animate) panel.animate([{ translate: `0 ${dy}px` }, { translate: '0 0' }], { duration: 220, easing: 'cubic-bezier(.2,.9,.3,1)' });
    panel.style.translate = '';
    panel.style.opacity = '';
  }, { passive: true });
}

$('#modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal' || e.target.closest('[data-close]')) {
    sfx('back');
    closeModal();
  }
});

$('#achBtn').addEventListener('click', () => {
  sfx('select');
  openModal(`<div class="dossier"><button class="modal-x" type="button" data-close aria-label="Close">✕</button>
    <header class="dossier-head"><p class="dossier-code">SECRETS · ${count()}/${ACHIEVEMENTS.length} FOUND</p>
    <h2 class="dossier-title ransom" id="modalTitle" data-ransom="ACHIEVEMENTS">ACHIEVEMENTS</h2></header>
    ${listMarkup()}
    <p class="dossier-hint">All 7 unlock the director's cut, how my AI crew built this.</p></div>`);
});

/* PROGRESS chip: a real button that shows what is left and how each item counts. */
document.addEventListener('click', (e) => {
  if (!e.target.closest?.('#progressChip')) return;
  sfx('select');
  const p = progress();
  openModal(`<div class="dossier"><button class="modal-x" type="button" data-close aria-label="Close">✕</button>
    <header class="dossier-head"><p class="dossier-code">PROGRESS · ${p.done}/${p.total} DONE</p>
    <h2 class="dossier-title ransom" id="modalTitle" data-ransom="PROGRESS">PROGRESS</h2></header>
    <ul class="ach-list log-list">${p.items.map((i) => `<li class="${i.done ? 'got' : ''}"><span class="ach-ico" aria-hidden="true">${i.done ? '★' : '☆'}</span><strong>${esc(i.label)}</strong><span class="sr-only">${i.done ? 'cleared' : 'not yet'}</span></li>`).join('')}</ul>
    <p class="dossier-hint">A project counts once you open its live app or its code. A page counts once you open it from the MENU.</p></div>`);
});

/* ---------------------------------------------------------------- HUD + sound */
/* the sound button calls out (a red shadow, its X snapping into sound waves) until sound has been
   on once, then it calms down for good */
function soundSeen() { // (a declaration: syncSoundButton runs at boot, before this line)
  try { return store.get().settings.sound || localStorage.getItem('jn-sound-seen') === '1'; } catch { return true; }
}
function syncSoundCall() {
  const seen = soundSeen();
  $('#soundBtn').classList.toggle('sound-call', !seen);
  if (seen) try { localStorage.setItem('jn-sound-seen', '1'); } catch { /* private mode: it just calls out again next visit */ }
}
function syncSoundButton() {
  const on = store.get().settings.sound;
  $('#soundBtn').setAttribute('aria-pressed', String(on));
  syncSoundCall();
  const t = $('#page [data-toggle="sound"]'); // the SYSTEM page toggle, when it is open
  if (t) {
    t.setAttribute('aria-pressed', String(on));
    t.textContent = on ? 'ON' : 'OFF';
  }
}

/* sound is on by default: the visitor's first tap, click or key starts it (browsers allow audio only
   after one), leaving the page pauses it and coming back resumes it (audio.js initAudio) */
initAudio();
initZoom(); // (a pinch zoom puts the page in its still state: src/core/zoom.js)
onZoom((z) => { if (z) skipCurrent(); }); // (a film shot is a full-screen layer moving every frame: under a zoom it goes straight to its end)
initFullscreen();

$('#soundBtn').addEventListener('click', () => toggleSound());
window.addEventListener('jn-sound', () => syncSoundButton()); // the lock screen's SOUND switch
function toggleSound() {
  const on = !store.get().settings.sound;
  setSound(on);
  syncSoundButton();
  if (on) sfx('toggle');
}


let hinted = false;
function soundHint() {
  if (hinted || store.get().settings.sound) return;
  hinted = true;
  $('#soundBtn').classList.add('wiggle');
  $('#soundTip').classList.add('show');
  setTimeout(() => $('#soundBtn').classList.remove('wiggle'), 1400);
}

/* the MENU button shouts until the visitor has opened the menu once (then it calms down for good) */
const MENU_SEEN = 'jn-menu-seen';
const menuSeen = () => {
  try {
    return window.localStorage.getItem(MENU_SEEN) === '1';
  } catch {
    return false;
  }
};
if (!menuSeen()) $('#menuBtn').classList.add('menu-hot');
$('#menuBtn').addEventListener('click', () => {
  $('#menuBtn').classList.remove('menu-hot');
  try {
    window.localStorage.setItem(MENU_SEEN, '1');
  } catch {
    /* private mode: it just shouts again next visit */
  }
  menu.isOpen() ? menu.close() : menu.open();
});

// key hints mean nothing to mouse/touch visitors: they appear once the keyboard is used
window.addEventListener('keydown', (e) => { if (!e.metaKey && !e.ctrlKey && e.key !== 'Shift') document.body.classList.add('kbd'); }, true);
window.addEventListener('pointerdown', () => document.body.classList.remove('kbd'), true);

function renderKeyHints(mode) {
  const sets = {
    board: [['↑↓', 'MOVE'], ['⏎', 'OPEN'], ['1-6', 'CHAPTERS'], [MENU_KEY, 'MENU'], ['Q', 'QUICK VIEW']],
    page: [['↑↓', 'MOVE'], ['⏎', 'OPEN'], ['ESC', 'BACK'], [MENU_KEY, 'MENU'], ['Q', 'QUICK VIEW']]
  };
  $('#keyhints').innerHTML = (sets[mode] || [])
    .map(([k, v]) => `<span><b>${esc(k)}</b>${esc(v)}</span>`)
    .join('');
}

/* ---------------------------------------------------------------- input */
function back() {
  if (closeModal()) return true;
  if (menu.isOpen()) {
    menu.close();
    return true;
  }
  if (screen === 'page' || screen === 'quick') {
    sfx('back');
    navigate('board');
    return true;
  }
  return false;
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-back]')) {
    e.preventDefault();
    back();
  }
  const t = e.target.closest('[data-track]');
  if (t) track(t.dataset.track);
});

/* Any click skips a running animation. */
document.addEventListener('pointerdown', () => {
  if (isAnimating()) skipCurrent();
}, true);

function navItems() {
  const scope = !$('#modal').hidden ? $('#modal') : menu.isOpen() ? $('#menu') : screen === 'board' ? $('#screen-board') : screen === 'quick' ? $('#screen-quick') : $('#page');
  return [...scope.querySelectorAll('[data-nav], .btn, a[href]')].filter((el, i, arr) => el.offsetParent !== null && arr.indexOf(el) === i);
}

function moveFocus(dir) {
  const items = navItems();
  if (!items.length) return false;
  const i = items.indexOf(document.activeElement);
  const next = items[(i + dir + items.length) % items.length] || items[0];
  next.focus();
  if (!menu.isOpen()) next.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  return true;
}

function handle(action, e) {
  if (savesOpen()) return savesKey(action, e); // SAVE DATA takes the keys while it is open
  if (isAnimating() && (action === 'confirm' || action === 'back')) return skipCurrent();
  switch (action) {
    case 'up':
    case 'left':
      return screen === 'title' ? false : moveFocus(-1);
    case 'down':
    case 'right':
      return screen === 'title' ? false : moveFocus(1);
    case 'confirm':
      if (screen === 'title' && [document.body, null, $('#pressStart')].includes(document.activeElement)) {
        $('#pressStart').click();
        return true;
      }
      if (!e) {
        document.activeElement?.click();
        return true;
      }
      return false;
    case 'back':
      return back();
    case 'quick':
      if (screen === 'quick') return false;
      navigate('quick');
      return true;
    case 'flip':
      flipGpa();
      return true;
    case 'mute':
      toggleSound();
      return true;
    default:
      if (action.startsWith('hotkey:') && $('#modal').hidden) {
        const n = Number(action.split(':')[1]);
        if (screen === 'board' && !menu.isOpen() && CHAPTERS[n - 1]) {
          navigate(CHAPTERS[n - 1]); // THE PLAN: 1-6 open the chapters in reading order
          return true;
        }
        if (screen !== 'title' && MENU_ITEMS[n - 1]) {
          navigate(MENU_ITEMS[n - 1].id);
          return true;
        }
      }
      return false;
  }
}

bindInput(handle);

/* Command-menu shortcut: Ctrl+K (⌘K on a Mac) opens or closes the MENU from anywhere past the title. */
window.addEventListener('keydown', (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k' || screen === 'title' || screen === null) return;
  e.preventDefault();
  if (!$('#modal').hidden) closeModal();
  menu.isOpen() ? menu.close() : menu.open();
});
bindGamepad(handle, () => unlock('player-2'));

/* copy the email on any email link (Nov 22, launch prep): a visitor with no mail app set up still gets the address */
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('a[href^="mailto:"]');
  if (!a) return;
  const addr = a.getAttribute('href').slice(7).split('?')[0];
  navigator.clipboard?.writeText(addr).then(() => toast(addr, 'EMAIL COPIED!'), () => {});
});

/* ---------------------------------------------------------------- analytics (cookie-free, optional) */
function track(name) {
  try {
    window.goatcounter?.count?.({ path: name, title: name, event: true });
  } catch {
    /* analytics must never break the page */
  }
}

if (resume.analytics.goatcounter) {
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.crossOrigin = 'anonymous';
  s.dataset.goatcounter = `https://${resume.analytics.goatcounter}.goatcounter.com/count`;
  document.head.appendChild(s);
  if (company) s.addEventListener('load', () => track(`company:${company.key}`));
}

/* (the black motto screen that covered a slow load was removed Nov 19: on a phone it hid the station
   until the page finished loading, and John saw a black screen until he tapped. The title and the
   station's blurred stand-in now paint at once instead.) */

/* ---------------------------------------------------------------- boot */
show(route());
// the loading star opens into the station, then (phones held upright, once a visit) the turn-your-phone reminder
runLoader().then(() => maybeRotateHint());
