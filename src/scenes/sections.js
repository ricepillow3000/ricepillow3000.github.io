import { SOUND_CREDITS } from '../data/credits.js';
/* an outbound-link arrow drawn as a shape (Nov 21, John: the north-east arrow character showed as a blue emoji tile on his iPhone; no emojis anywhere) */
const EXT = '<svg class="ext" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 9.5 9 3M4 2.5h5.5V8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"/></svg>';
import { gsap } from 'gsap';
import { resume } from '../data/resume.js';
import { reorder } from '../data/companies.js';
import { store } from '../core/store.js';
import { esc, reducedMotion } from '../core/util.js';
import { listMarkup, allFound } from '../eggs/achievements.js';
import { clearStampMarkup, isCleared } from '../ui/clear.js';
import { sfx } from '../audio/audio.js';

/* Each section returns { title, html, after(root) }. Content comes from resume.js only. */

const back = '<button class="btn back-btn" type="button" data-back>◂ THE PLAN <kbd>ESC</kbd></button>';
const head = (title, sub = '') => `
  <div class="page-head"><h2 class="ransom ransom-lg" data-ransom="${esc(title)}"></h2></div>
  ${sub ? `<p class="page-sub" data-in>${sub}</p>` : ''}`;
const cleared = (on) => (on ? clearStampMarkup() : '');
let crewResize = null;
let crewResizeBound = false;

/* Highlight numbers in a sentence with the yellow marker. */
const mark = (text) =>
  String(text)
    .split(/(\d[\d,.]*\+?(?:%|\s(?:of \d[\d,]*|lines|tests|years|checks|errors|bugs|workflows))?|−\d+%)/g)
    .map((part, i) => (i % 2 ? `<span class="hl">${esc(part)}</span>` : esc(part)))
    .join('');

/* Big outlined word drifting behind each page (background depth layer). */
const watermark = (word) => `<div class="pg-mark" aria-hidden="true"><span>${word}</span><span>${word}</span></div>`;

/* Shared slam for page-specific intros: offset by ~3 frames, overshoot, settle. */
const slamIn = (els, from, extra = {}) =>
  gsap.from(els, { ...from, duration: 0.34, ease: 'back.out(2.4)', stagger: 0.05, clearProps: 'transform,opacity,visibility', ...extra });

function missions(ctx) {
  const list = reorder(resume.missions, ctx.company?.order?.missions);
  return {
    title: 'MISSIONS',
    html: `${watermark('TARGETS')}${back}${head('MISSIONS', 'Two problems I set out to solve. Open a file for the whole story.')}
      <ul class="wanted">${list
        .map(
          (m, i) => `<li class="wanted-slot" style="--tilt:${i % 2 ? 2.4 : -2.8}deg;--d:${i * -1.3}s">
          <button class="poster" type="button" data-nav data-mission="${m.id}">
            <span class="poster-tape" aria-hidden="true"></span>
            <span class="poster-top"><span>TARGET 0${i + 1}</span><span class="poster-live">${esc(m.status)}</span></span>
            <span class="poster-grade" aria-label="Difficulty ${esc(m.grade)}">${esc(m.grade)}</span>
            <span class="poster-name">${esc(m.target)}</span>
            <span class="poster-target">${esc(m.name)}</span>
            <span class="poster-stack">${esc((m.stack || []).join(' · '))}</span>
            <span class="poster-brief">${esc(m.brief)}</span>
            <span class="poster-open">OPEN FILE ▸</span>
            ${cleared(isCleared(m.id))}
          </button></li>`
        )
        .join('')}</ul>`,
    intro(root) {
      slamIn(root.querySelectorAll('.poster'), { y: -140, rotation: (i) => (i % 2 ? 24 : -24), scale: 1.25, autoAlpha: 0 }, { stagger: 0.09 });
    }
  };
}

/* a work story in four beats (setup, tension, pivot, lesson): a hiring manager wants the bets, where it broke and what was learned */
const storyList = (beats) => `<ol class="story-beats">${beats.map(([k, t]) => `<li><b>${esc(k)}</b><span>${esc(t)}</span></li>`).join('')}</ol>`;

export function dossierMarkup(m) {
  return `<div class="dossier" data-id="${m.id}">
    <button class="modal-x" type="button" data-close aria-label="Close">✕</button>
    <header class="dossier-head">
      <p class="dossier-code">MISSION FILE · ${esc(m.dates)}</p>
      <h2 class="dossier-title ransom" id="modalTitle" data-ransom="${esc(m.target.toUpperCase())}">${esc(m.target)}</h2>
      <p class="dossier-sub">${esc(m.name)} · <span class="dossier-live">${esc(m.status)}</span></p>
      <ul class="dossier-stack">${m.stack.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
    </header>
    <div class="dossier-links">
      <a class="btn" href="${esc(m.live)}" target="_blank" rel="noopener noreferrer" data-track="live_${m.id}" data-clear="${m.id}">Try it live ${EXT}</a>
      <a class="btn" href="${esc(m.repo)}" target="_blank" rel="noopener noreferrer" data-track="repo_${m.id}" data-clear="${m.id}">Code on GitHub ${EXT}</a>
    </div>
    <p class="dossier-hint">${isCleared(m.id) ? 'Case cleared. Thanks for checking it out.' : 'Visit the live app or the code to clear this case.'}</p>
    ${m.story ? `<section class="story" aria-label="The story"><h3>THE STORY</h3>${storyList(m.story)}</section>` : ''}
    <div class="dossier-cols">
      <div><h3>OBJECTIVES</h3><ul class="obj">${m.objectives.map((o) => `<li>${esc(o)}</li>`).join('')}</ul></div>
      <div><h3>LOOT</h3><ul class="loot">${m.loot.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>
    </div>
    ${isCleared(m.id) ? clearStampMarkup() : ''}
  </div>`;
}

/** Dossier choreography: objectives type in, loot pops, stamp slams. Returns timeline. */
export function animateDossier(root, onLand) {
  if (reducedMotion()) return gsap.timeline();
  const tl = gsap.timeline();
  tl.fromTo(root, { scale: 1.25, rotation: -5, y: -50, opacity: 0 }, { scale: 1, rotation: 0, y: 0, opacity: 1, duration: 0.2, ease: 'power4.in', clearProps: 'transform,opacity' })
    .from(root.querySelector('.dossier'), { clipPath: 'polygon(0 0, 0 0, 0 100%, 0 100%)', duration: 0.3, ease: 'expo.out' }, 0.14)
    .from(root.querySelectorAll('.obj li'), { x: -50, skewX: -18, opacity: 0, duration: 0.24, ease: 'expo.out', stagger: 0.08 }, '-=0.12')
    .from(root.querySelectorAll('.loot li'), { scale: 0.2, rotation: -20, opacity: 0, duration: 0.3, ease: 'back.out(3)', stagger: 0.06 }, '-=0.18')
    .add(() => onLand?.());
  return tl;
}

let skillSoundAt = 0;
function skills(ctx) {
  const list = reorder(resume.skills, ctx.company?.order?.skills);
  const lv = (r) => (r === 'MAX' ? 10 : Number(r) || 0);
  const total = resume.missions.length;
  return {
    title: 'SKILLS',
    html: `${watermark('LEVELS')}${back}${head('SKILLS', 'Level out of 10. Point at a skill to see where I proved it.')}
      <div class="crew">
        <div class="crew-star" aria-hidden="true"></div>
                <div class="crew-board">
        <span class="crew-cursor" aria-hidden="true"><i></i></span>
        <ol class="crew-list">
          ${list
            .map((s, i) => {
              const n = lv(s.rank);
              const tag = i === 0 ? '<span class="crew-tag" aria-hidden="true"><b>CORE</b></span>' : i === 3 ? '<span class="crew-tag" aria-hidden="true"><b>KIT</b></span>' : '';
              return `<li class="crew-row" data-nav tabindex="0" data-proof="${esc(s.proof)} · used in ${s.uses.length} of ${total} live apps" data-name="${esc(s.name)}"
                aria-label="${esc(s.name)}: level ${esc(s.rank)}, used in ${s.uses.length} of ${total} projects. ${esc(s.proof)}">
                ${tag}
                <span class="crew-name" aria-hidden="true">${esc(s.name)}</span>
                <span class="crew-dot" aria-hidden="true">${n >= 8 ? '<i class="crew-spark"></i>' : '•'}</span>
                <span class="crew-lv" aria-hidden="true"><small>LV</small>${n >= 10 ? 'MAX' : n}</span>
                <span class="crew-m${n >= 10 ? ' crew-max' : ''}" aria-hidden="true">${Array.from({ length: 10 }, (_, k) => `<b style="--k:${k}"${k < n ? ` class="f${k === n - 1 ? ' t' : ''}"` : ''}></b>`).join('')}</span>
              </li>`;
            })
            .join('')}
        </ol>
        <div class="crew-detail" aria-hidden="true">
          <b class="cd-name"></b>
          <span class="cd-rank"><small>LV</small><b class="cd-lv"></b></span>
          <span class="cd-stars">${'<i></i>'.repeat(5)}</span>
          <p class="cd-proof"></p>
        </div>
        </div>
        <div class="crew-side" aria-hidden="true">
          <div class="ransom crew-word" data-ransom="RECEIPTS"></div>
          <p class="crew-ask">Which skill do you want proof of?</p>
        </div>
      </div>`,
    after(root) {
      const rows = [...root.querySelectorAll('.crew-row')];
      const cursor = root.querySelector('.crew-cursor');
      const say = root.querySelector('.crew-detail');
      let current = null;
      // the highlight follows its row's real size: fonts arriving or a resize change the row heights
      // the highlight starts just left of the longest name, so a long name is never cut off
      const fitLeft = () => {
        const left = Math.min(...rows.map((r) => r.offsetLeft + r.querySelector('.crew-name').offsetLeft));
        if (Number.isFinite(left)) cursor.style.setProperty('--cl', `${Math.max(0, left - 26)}px`);
      };
      const resync = () => { fitLeft(); if (current) gsap.set(cursor, { y: current.offsetTop, height: current.offsetHeight }); };
      if (window.ResizeObserver) new ResizeObserver(resync).observe(root.querySelector('.crew-list'));
      document.fonts?.ready.then(resync);
      const select = (row, instant) => {
        if (!row || row === current) return;
        current = row;
        rows.forEach((r) => r.classList.toggle('on', r === row));
        // the detail strip under the list: name, level, five stars (a star per two levels), the receipt
        const lvTxt = row.querySelector('.crew-lv').lastChild.textContent;
        const lvNum = lvTxt === 'MAX' ? 10 : Number(lvTxt);
        say.querySelector('.cd-name').textContent = row.dataset.name;
        say.querySelector('.cd-lv').textContent = lvTxt;
        say.querySelectorAll('.cd-stars i').forEach((st, k) => st.classList.toggle('on', k < Math.round(lvNum / 2)));
        say.querySelector('.cd-proof').textContent = row.dataset.proof;
        // heard on every pick, mouse, finger or keyboard: the meter's level-up climbs as high as the skill
        // ranks (a fast sweep down the list gets the short tick instead, so it never smears)
        if (!instant) {
          const now = performance.now();
          sfx(now - skillSoundAt > 140 ? 'skillUp' : 'hvRow', lvNum);
          skillSoundAt = now;
        }
        const to = { y: row.offsetTop, height: row.offsetHeight };
        if (instant || reducedMotion()) {
          gsap.set(cursor, to);
          return;
        }
        gsap.to(cursor, { ...to, duration: 0.2, ease: 'back.out(2.2)', overwrite: true });
        gsap.fromTo(cursor.firstElementChild, { scaleX: 0.6 }, { scaleX: 1, duration: 0.22, ease: 'back.out(2.6)' });
        gsap.fromTo(say.children, { x: 24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.2, ease: 'back.out(2.4)', stagger: 0.03, clearProps: 'transform,opacity' });
        // the meter levels up: its blocks pop in one by one, the tip star spins on, the LV counts up
        gsap.fromTo(row.querySelectorAll('.crew-m b.f'), { scaleY: 0.2, y: 6 }, { scaleY: 1, y: 0, duration: 0.22, ease: 'back.out(3)', stagger: 0.03, clearProps: 'transform' });
        const lvEl = say.querySelector('.cd-lv');
        if (lvTxt !== 'MAX') {
          const c = { v: 0 };
          gsap.to(c, { v: lvNum, duration: 0.3, ease: 'power2.out', onUpdate: () => { lvEl.textContent = String(Math.round(c.v)); } });
        }
      };
      rows.forEach((r) => {
        r.addEventListener('pointerenter', () => select(r));
        r.addEventListener('focus', () => select(r));
        // tapping the skill that is already picked still answers (the first one starts picked)
        r.addEventListener('click', () => {
          if (r !== current || performance.now() - skillSoundAt < 300) return;
          const t = r.querySelector('.crew-lv').lastChild.textContent;
          sfx('skillUp', t === 'MAX' ? 10 : Number(t));
          skillSoundAt = performance.now();
        });
      });
      requestAnimationFrame(() => { fitLeft(); select(rows[0], true); });
      // one shared listener for every visit (the old page is gone, so only the live cursor is moved)
      crewResize = () => cursor.isConnected && resync();
      if (!crewResizeBound) {
        crewResizeBound = true;
        window.addEventListener('resize', () => crewResize?.(), { passive: true });
      }
    },
    intro(root) {
      if (reducedMotion()) return;
      slamIn(root.querySelectorAll('.crew-row'), { x: 160, skewX: -22, autoAlpha: 0 }, { stagger: 0.04, duration: 0.26 });
      gsap.from(root.querySelector('.crew-star'), { scale: 0, rotation: -180, duration: 0.5, ease: 'back.out(1.8)', clearProps: 'transform' });
      gsap.from(root.querySelector('.crew-cursor i'), { scaleX: 0, duration: 0.3, ease: 'back.out(2.4)', delay: 0.25 });
    }
  };
}

function different() {
  return {
    title: 'MY EDGE',
    html: `${watermark('FACTS')}${back}${head('MY EDGE', 'Where it all adds up. Four facts, no pitch.')}
      <div class="comic">${resume.different
        .map((d, i) => `<article class="panel panel-${i}" data-nav tabindex="0"><span class="panel-num" aria-hidden="true">${i + 1}</span><h3>${esc(d.title)}</h3><p>${mark(d.fact)}</p></article>`)
        .join('')}</div>`,
    intro(root) {
      if (reducedMotion()) return;
      const panels = [...root.querySelectorAll('.panel')];
      const page = root; // shake the content only (it is clipped), never the scrolling screen
      const from = [{ x: -260, y: -80 }, { x: 260, y: -80 }, { x: -260, y: 80 }, { x: 260, y: 80 }];
      const tl = gsap.timeline();
      panels.forEach((p, i) => {
        tl.from(p, { ...from[i % 4], scale: 1.35, rotation: i % 2 ? 9 : -9, autoAlpha: 0, duration: 0.2, ease: 'power4.in', clearProps: 'transform,opacity,visibility' }, i * 0.11)
          .add(() => {
            page.classList.remove('shake');
            void page.offsetWidth;
            page.classList.add('shake');
          }, i * 0.11 + 0.2)
          .from(p.querySelector('.panel-num'), { scale: 2.6, rotation: -30, duration: 0.3, ease: 'back.out(2.5)', clearProps: 'transform' }, i * 0.11 + 0.18);
      });
    }
  };
}

function stats() {
  const e = resume.education;
  const gpa = Number(e.gpa) || 0;
  return {
    title: 'STATS',
    html: `${watermark('PROFILE')}${back}${head('STATS', 'Who I am, and why this site exists.')}
      <section class="idcard" data-in>
        <button class="gpa-burst" type="button" aria-label="Off the record. Press to flip for a secret stat." aria-pressed="false"><span class="gb-front"><b>???</b><small>OFF RECORD</small></span><span class="gb-back"><b>MAX</b><small>BEE FEAR</small></span></button>
        <div class="id-band"><span>ID · ${esc(resume.name.toUpperCase())}</span><span>${esc(resume.location)}</span></div>
        <div class="id-body">
          <figure class="gpa-card" aria-label="GPA ${esc(e.gpa)} out of 4.00">
            <span class="gpa-tag" aria-hidden="true">GPA</span>
            <div class="gpa-num" aria-hidden="true"><b data-to="${esc(e.gpa)}">${esc(e.gpa)}</b><span>/ 4.00</span></div>
            <div class="gpa-bar" aria-hidden="true" style="--v:${(Math.min(1, gpa / 4) * 100).toFixed(1)}%"><i></i></div>
          </figure>
          <div class="id-info">
            <h3>${esc(e.school)}</h3>
            <p>${esc(e.degree)}<br>Concentration: <b>${esc(e.concentration)}</b></p>
            <div class="id-chips"><span>${esc(e.grad.toUpperCase())}</span><span>${esc(e.dates)}</span></div>
            <p class="id-honors">${esc(e.honors)}</p>
          </div>
        </div>
      </section>
      <section class="story story-site" data-in aria-label="Why this site"><h3>WHY THIS SITE</h3>${storyList(resume.siteStory)}</section>
      <ul class="traits">${resume.funFacts.map((f, i) => `<li class="trait t${i}" data-in><i class="ff-star" aria-hidden="true"></i>${esc(f)}</li>`).join('')}</ul>
      <blockquote class="motto-strip" data-in>“${esc(resume.motto.text)}”<cite>— ${esc(resume.motto.by)}</cite></blockquote>`,
    intro(root) {
      if (reducedMotion()) return;
      const num = root.querySelector('.gpa-num b');
      const v = { n: Math.min(3.5, gpa) };
      gsap.to(v, { n: gpa, duration: 0.7, ease: 'power3.out', delay: 0.1, onUpdate: () => (num.textContent = v.n.toFixed(2)) });
      gsap.from(root.querySelector('.gpa-bar i'), { scaleX: 0, duration: 0.6, ease: 'back.out(1.8)', delay: 0.15, clearProps: 'transform' });
      gsap.from(root.querySelector('.gpa-tag'), { scale: 2.4, rotation: -30, duration: 0.3, ease: 'back.out(2.5)', delay: 0.05, clearProps: 'transform' });
    }
  };
}

function sideQuests() {
  const n = resume.sideQuests.length;
  let d = 'M50 0';
  for (let i = 0; i < n; i++) d += ` C ${i % 2 ? 90 : 10} ${i * 100 + 35}, ${i % 2 ? 10 : 90} ${i * 100 + 65}, 50 ${i * 100 + 100}`;
  return {
    title: 'SIDE QUESTS',
    html: `${watermark('ROUTE')}${back}${head('SIDE QUESTS', 'Not everything I learned came from a keyboard.')}
      <div class="route" style="--n:${n}">
        <svg class="route-line" viewBox="0 0 100 ${n * 100}" preserveAspectRatio="none" aria-hidden="true">
          <path class="route-under" d="${d}" pathLength="1"/><path class="route-dash" d="${d}"/>
        </svg>
        ${resume.sideQuests
          .map(
            (q, i) => `<article class="stop ${i % 2 ? 'right' : 'left'}" data-nav tabindex="0">
            <span class="stop-pin" aria-hidden="true">${i + 1}</span>
            <div class="stop-card">
              <div class="stop-head"><span class="stop-title">${esc(q.title)}</span><span class="stop-meta">${esc(q.place)} · ${esc(q.dates)}</span></div>
              <p class="stop-stat"><b>${esc(q.stat[0])}</b><span>${esc(q.stat[1])}</span></p>
              <span class="lesson"><b class="ql-tag">REWARD ★</b><span class="ql-text">${esc(q.lesson)}</span></span>
              <span class="stop-clear${/present/i.test(q.dates) ? ' active' : ''}" aria-hidden="true">${/present/i.test(q.dates) ? 'ACTIVE' : 'CLEAR'}</span>
            </div></article>`
          )
          .join('')}
      </div>`,
    intro(root) {
      if (reducedMotion()) return;
      const path = root.querySelector('.route-under');
      gsap.fromTo(path, { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.8, ease: 'power3.out', clearProps: 'strokeDasharray,strokeDashoffset' });
      // every stop is heard once, the first time it is on screen: as its pin lands if it is on screen
      // from the start, else as it comes into view (one watcher, so a stop at the fold is never missed)
      const t0 = performance.now();
      const io = 'IntersectionObserver' in window && new IntersectionObserver((entries) => entries.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        const i = Number(en.target.dataset.i);
        const wait = Math.max(0, (0.1 + i * 0.22 + 0.12) * 1000 - (performance.now() - t0)); // (never before its pin lands)
        setTimeout(() => root.isConnected && sfx('questPin', i), wait);
      }), { threshold: 0.15 });
      root.querySelectorAll('.stop').forEach((st, i) => {
        const at = 0.1 + i * 0.22;
        gsap.from(st.querySelector('.stop-pin'), { scale: 0, rotation: -120, duration: 0.3, ease: 'back.out(3)', delay: at, clearProps: 'transform' });
        st.dataset.i = String(i);
        if (io) io.observe(st);
        gsap.from(st.querySelector('.stop-card'), { x: st.classList.contains('right') ? 160 : -160, skewX: st.classList.contains('right') ? -14 : 14, autoAlpha: 0, duration: 0.32, ease: 'back.out(2)', delay: at + 0.05, clearProps: 'transform,opacity,visibility' });
        gsap.from(st.querySelector('.stop-clear'), { scale: 3, rotation: -40, autoAlpha: 0, duration: 0.2, ease: 'power4.in', delay: at + 0.35, clearProps: 'transform,opacity,visibility' });
      });
    }
  };
}

function contact() {
  const L = resume.links;
  return {
    title: 'CONTACT',
    html: `${watermark('CALLING')}${back}${head('CONTACT')}
      <div class="card-stage"><div class="pg-rays" aria-hidden="true"></div><div class="ccard" id="ccard">
        <div class="ccard-face ccard-front" aria-hidden="true"><div class="ccard-emblem"></div></div>
        <div class="ccard-face ccard-back">
          <span class="ccard-name">${esc(resume.name)}</span>
          <span class="ccard-role">${esc(resume.role)}</span>
        </div>
      </div></div>
      <div class="contact-btns" data-in>
        <a class="btn btn-primary" data-nav data-magnetic href="${esc(L.linkedin)}" target="_blank" rel="noopener noreferrer" data-track="linkedin_click">in · Connect on LinkedIn ${EXT}</a>
        <a class="btn" data-nav href="mailto:${esc(L.email)}" data-track="email_click">${esc(L.email)}</a>
        <a class="btn" data-nav href="${esc(L.github)}" target="_blank" rel="noopener noreferrer" data-track="github_click">GitHub ${EXT}</a>
        <a class="btn btn-accent" data-nav href="${esc(L.pdf)}" download data-track="pdf_click">↓ PDF resume</a>
      </div>`,
    after(root) {
      const card = root.querySelector('#ccard');
      if (reducedMotion()) return;
      gsap.fromTo(card, { rotationY: 180, scale: 0.8 }, { rotationY: 0, scale: 1, duration: 0.6, ease: 'back.out(1.4)', delay: 0.1 });
      // the card follows the pointer in 3D, so it never sits frozen
      const stage = root.querySelector('.card-stage');
      const qx = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power3.out' });
      const qy = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power3.out' });
      stage.addEventListener('pointermove', (e) => {
        const r = stage.getBoundingClientRect();
        qx(((e.clientX - r.left) / r.width - 0.5) * 22);
        qy(-((e.clientY - r.top) / r.height - 0.5) * 16);
      });
      stage.addEventListener('pointerleave', () => {
        qx(0);
        qy(0);
      });
    }
  };
}

function system() {
  const s = store.get().settings;
  const reduce = s.reduceMotion === null ? reducedMotion() : s.reduceMotion;
  return {
    title: 'SETTINGS',
    html: `${watermark('CONFIG')}${back}${head('SETTINGS')}
      <div class="sys-grid">
        <section class="sys jag light" data-in>
          <h3>RESUME</h3>
          <div class="row">One-page version <a class="btn" data-nav href="#/quick">Quick View ▸</a></div>
          <div class="row">Standard PDF <a class="btn" data-nav href="${esc(resume.links.pdf)}" download data-track="pdf_click">↓ Download</a></div>
        </section>
        <section class="sys jag light" data-in>
          <h3>SETTINGS</h3>
          <div class="row">Sound <button class="toggle" type="button" data-nav data-toggle="sound" aria-pressed="${s.sound ? 'true' : 'false'}">${s.sound ? 'ON' : 'OFF'}</button></div>
          <div class="row"><label for="musicVol">Music volume</label><input id="musicVol" type="range" min="0" max="1" step="0.05" value="${Number(s.music) || 0}" data-nav></div>
          <div class="row">Reduce motion <button class="toggle" type="button" data-nav data-toggle="motion" aria-pressed="${reduce ? 'true' : 'false'}">${reduce ? 'ON' : 'OFF'}</button></div>
        </section>
        <section class="sys jag light" data-in style="grid-column:1/-1">
          <h3>ACHIEVEMENTS</h3>
          ${listMarkup()}
          ${allFound() ? '<p style="margin:14px 0 0"><a class="btn" data-nav href="#/secret">★ Behind the scenes</a></p>' : ''}
        </section>
        <section class="sys jag light sys-credits" data-in style="grid-column:1/-1">
          <h3>SOUND CREDITS</h3>
          <p>Most sounds are synthesized live. These are real recordings, free under Creative Commons:</p>
          <ul>${SOUND_CREDITS.map((c) => `<li><b>${esc(c.what)}</b> · <a href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">${esc(c.pack)}</a> by ${c.authorUrl ? `<a href="${esc(c.authorUrl)}" target="_blank" rel="noopener noreferrer">${esc(c.author)}</a>` : esc(c.author)} · <a href="${esc(c.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(c.license)}</a>${c.changes ? ` · ${esc(c.changes)}` : ''}</li>`).join('')}</ul>
        </section>
      </div>
      <p class="legal">Independent, non-commercial personal portfolio inspired by Persona 5. Persona 5 and related marks are trademarks of ATLUS / SEGA. No affiliation implied. © 2026 John Nguyen. <a href="/privacy.html">Privacy and terms</a></p>`,
    after(root) {
      // the slider's red runs as far as its knob (the track is drawn by the page, not the browser)
      const vol = root.querySelector('#musicVol');
      const fill = () => vol.style.setProperty('--fill', `${Math.round(Number(vol.value) * 100)}%`);
      if (vol) { fill(); vol.addEventListener('input', fill); }
    }
  };
}

function secret() {
  return {
    title: 'BEHIND THE SCENES',
    html: `${back}${head('BEHIND THE SCENES', 'You found every secret. Here is how this site was made.')}
      <div class="sq-list bts">
        <article class="sq jag light" data-in><h3>THE CREW</h3><p>Same workflow as my projects. An orchestrator agent planned it, a researcher agent checked the details, a builder agent wrote the code, and I directed and reviewed every step. Every click path is covered by automated browser tests.</p></article>
        <article class="sq jag light" data-in><h3>THE ART</h3><p>The subway, the city, the train and the trash on the platform are cel-shaded art I directed Google's Nano Banana to generate. The train that roars past is drawn live in perspective by code, and every sticker, poster and comic shape is inline SVG and CSS.</p></article>
        <article class="sq jag light" data-in><h3>THE SOUND</h3><p>The music, every click, the wind on the fall and the train's horn are synthesized live in your browser. The trains, the breaking glass and a few hits (a whoosh, a paper slide, the stamp's clang, a passing car) are real recordings, free Creative Commons sounds, each kept only after an AI listening test picked it over the synthesized version.</p></article>
        <article class="sq jag light" data-in><blockquote class="motto" style="margin:0">“${esc(resume.motto.text)}”<cite>— ${esc(resume.motto.by)}</cite></blockquote></article>
      </div>`
  };
}

export const SECTION_TITLES = { missions: 'MISSIONS', skills: 'SKILLS', different: 'MY EDGE', stats: 'STATS', 'side-quests': 'SIDE QUESTS', contact: 'CONTACT', system: 'SETTINGS', secret: 'BEHIND THE SCENES' };

export const SECTION_RENDERERS = {
  missions,
  skills,
  different,
  stats,
  'side-quests': sideQuests,
  contact,
  system,
  secret
};
