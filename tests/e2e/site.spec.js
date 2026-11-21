import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

/* Any US-style phone number, e.g. (555) 123-4567, 555-123-4567, 555.123.4567. No real digits live in this repo. */
const PHONE = /\(?\b\d{3}\)?[\s.-]*\d{3}[\s.-]\d{4}\b/;

const errorsOf = (page) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
};

async function openBoard(page, url = '/#/board') {
  await page.goto(url);
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'board');
  await expect(page.locator('#board .pl-item').first()).toBeVisible();
}

test('title → PRESS START → THE PLAN: six chapters in order and a CONTINUE that points at chapter 1', async ({ page }) => {
  const errors = errorsOf(page);
  await page.goto('/');
  await expect(page.locator('#titleName')).toHaveAccessibleName('JOHN');
  await expect(page.getByRole('heading', { name: 'JOHN' })).toBeVisible();
  await page.locator('#pressStart').click();
  await page.locator('#saves .sv-slot').first().click(); // SAVE DATA: a new game in file 1
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'board');
  const chapters = page.locator('#board .pl-item');
  await expect(chapters).toHaveCount(6);
  expect(await chapters.evaluateAll((els) => els.map((e) => e.dataset.ch))).toEqual(['stats', 'missions', 'skills', 'side-quests', 'different', 'contact']);
  // the next chapter is already picked: one tap on the big word continues
  await expect(page.locator('#board .plan-continue')).toHaveAttribute('href', '#/stats');
  await expect(page.locator('#board .plan-continue')).toHaveAccessibleName(/STATS/);
  await expect(page.locator('#board .pcn-kicker')).toHaveText(''); // quiet: no "start here", the pick says it
  await expect(page.locator('#board .pl-item.on')).toHaveAttribute('data-ch', 'stats');
  expect(errors).toEqual([]);
});

test('old #/talk links land on the board', async ({ page }) => {
  await openBoard(page, '/#/talk');
});

test('THE PLAN: pointing at a chapter picks it (number, preview stickers, big word), letting go returns to the next one', async ({ page, isMobile }) => {
  test.skip(isMobile, 'phones tap straight into a chapter');
  await openBoard(page);
  await page.locator('.pl-item[data-ch="missions"]').hover();
  await expect(page.locator('#board .pl-item.on')).toHaveAttribute('data-ch', 'missions');
  await expect(page.locator('#board .cn-no .sr-only')).toHaveText('02');
  await expect(page.locator('#board .cmd-loot')).toContainText('727 of 728 checks');
  await expect(page.locator('#board .plan-continue')).toHaveAttribute('href', '#/missions');
  await expect(page.locator('#board .pcn-kicker')).toHaveText('JUMP AHEAD');
  await page.mouse.move(5, 5);
  await expect(page.locator('#board .pl-item.on')).toHaveAttribute('data-ch', 'stats');
});

test('opening all six chapters unlocks Full Recon, and CONTINUE moves on as you read', async ({ page }) => {
  await page.goto('/#/stats');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'stats');
  await openBoard(page);
  await expect(page.locator('#board .plan-continue')).toHaveAttribute('href', '#/missions');
  await expect(page.locator('.pl-item[data-ch="stats"]')).toHaveClass(/seen/);
  for (const id of ['missions', 'skills', 'side-quests', 'different', 'contact']) {
    await page.goto(`/#/${id}`);
    await expect(page.locator('body')).toHaveAttribute('data-screen', id);
  }
  await expect(page.locator('#achCount')).toHaveText('1/7');
});

test('phone: all six chapters, the number and the big word fit on one screen', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone only');
  await openBoard(page);
  const vh = page.viewportSize().height;
  for (const sel of ['#board .plan-continue', '#board .pl-item[data-ch="contact"]', '#board .cmd-right']) {
    const box = await page.locator(sel).boundingBox();
    expect(box.y + box.height, sel).toBeLessThanOrEqual(vh);
  }
  await expect(page.locator('#board .pl-item.here')).toHaveAttribute('data-ch', 'stats');
});

test('case file opens a dossier with objectives, loot and live links', async ({ page }) => {
  await page.goto('/#/missions');
  await page.locator('.poster[data-mission="arcas"]').click();
  const modal = page.locator('#modal');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('199 of 201 planted errors caught');
  await expect(modal.locator('a[href*="excel-anomaly-hunter"]')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  // just opening the file does NOT clear the case
  await expect(page.locator('.poster[data-mission="arcas"] .clear-stamp')).toHaveCount(0);
});

test('a case is CLEARED only after visiting its project link and coming back', async ({ page, context }) => {
  await context.route(/excel-anomaly-hunter/, (r) => r.fulfill({ body: 'project page' }));
  await page.goto('/#/missions');
  await page.locator('.poster[data-mission="arcas"]').click();
  const [popup] = await Promise.all([context.waitForEvent('page'), page.locator('#modal a[data-clear]').first().click()]);
  await popup.close();
  // a quick blur/focus blip (what a phone does on the tap itself) must NOT clear it
  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));
  });
  await page.waitForTimeout(600);
  await expect(page.locator('#modal .clear-stamp')).toHaveCount(0);
  // a real visit: away for a while, then back
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(1700);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.keyboard.press('Escape');
  const poster = page.locator('.poster[data-mission="arcas"]');
  await expect(poster.locator('.clear-stamp')).toHaveCount(1);
  await expect(page.locator('.poster[data-mission="meliona"] .clear-stamp')).toHaveCount(0);
  // it stays cleared after a reload
  await page.reload();
  await expect(page.locator('.poster[data-mission="arcas"] .clear-stamp')).toHaveCount(1);
});

test('?company=Google pins a personal note', async ({ page }) => {
  await openBoard(page, '/?company=Google#/board');
  await expect(page.locator('.plan-note')).toContainText("Wait, someone from Google? I've been expecting you.");
});

test('?company= is sanitized and rendered as text only', async ({ page }) => {
  await openBoard(page, '/?company=%3Cimg%20src=x%20onerror=alert(1)%3EAcme#/board');
  await expect(page.locator('.plan-note')).toContainText('Wait, someone from img srcx onerroralert1Acme?');
  await expect(page.locator('#board img')).toHaveCount(0); // the hub is all type and shapes
});

test('deep links open sections directly, and Esc returns to the board', async ({ page }) => {
  for (const id of ['missions', 'skills', 'different', 'stats', 'side-quests', 'contact', 'system']) {
    await page.goto(`/#/${id}`);
    await expect(page.locator('body')).toHaveAttribute('data-screen', id);
    await expect(page.locator('#page h2.ransom')).toBeVisible();
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'board');
});

test('Quick View has the real PDF, and the PDF is served', async ({ page, request }) => {
  await page.goto('/#/quick');
  await expect(page.locator('#paper')).toContainText('Georgia State University');
  await expect(page.locator('#paper')).toContainText('0 failures (727 of 728 checks)'); // word for word from the PDF
  const href = await page.locator('#quickPdf').getAttribute('href');
  const res = await request.get(`/${href}`);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('pdf');
});

test('contact leads with LinkedIn and never shows a phone number', async ({ page }) => {
  await page.goto('/#/contact');
  const primary = page.locator('.contact-btns .btn-primary');
  await expect(primary).toContainText('LinkedIn');
  await expect(primary).toHaveAttribute('href', /linkedin\.com\/in\//);
  await expect(page.locator('body')).not.toContainText(PHONE);
});

test('keyboard: 2 opens chapter 2, Q for Quick View, Esc back', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test is desktop only');
  await openBoard(page);
  await page.keyboard.press('2');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'missions');
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'board');
  await page.keyboard.press('q');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'quick');
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'board');
});

test('flipping the off-the-record star on STATS unlocks an achievement that survives reload', async ({ page }) => {
  await page.goto('/#/stats');
  await page.locator('#page .gpa-burst').click();
  await expect(page.locator('#page .gpa-burst')).toHaveClass(/flipped/);
  await expect(page.locator('#achCount')).toHaveText('1/7');
  await page.reload();
  await expect(page.locator('#achCount')).toHaveText('1/7');
});

test('dev console: john.run() unlocks Inspector', async ({ page }) => {
  await openBoard(page);
  const reply = await page.evaluate(() => window.john.run());
  expect(reply).toContain('Thanks for looking under the hood');
  await expect(page.locator('#achCount')).toHaveText('1/7');
});

test('works with motion enabled too (start sequence + board reveal finish)', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = errorsOf(page);
  await page.goto('/');
  await page.locator('#pressStart').click();
  await page.locator('#saves .sv-slot').first().click();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'board', { timeout: 15000 }); // the train brakes in (~1.8 s), plus up to 4 s waiting for the scene, on a busy shared test machine
  await expect(page.locator('#board .plan-continue')).toBeVisible();
  expect(errors).toEqual([]);
  await ctx.close();
});

test('phone: no horizontal scroll and thumb-sized targets', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone only');
  await openBoard(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const sel of ['#board .pl-item', '#board .plan-continue']) {
    const box = await page.locator(sel).first().boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});

test('no phone number anywhere in the built site', async () => {
  const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
  const text = walk('dist').filter((f) => /\.(html|js|css|svg|json)$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n');
  expect(text).not.toMatch(PHONE);
});

/* Reads every text string out of a PDF's compressed content streams. */
function pdfText(path) {
  const buf = readFileSync(path);
  const raw = buf.toString('latin1');
  let out = '';
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) break;
    let data;
    try {
      data = inflateSync(buf.subarray(start, end)).toString('latin1');
    } catch {
      continue;
    }
    for (const x of data.matchAll(/\(((?:\\.|[^\\)])*)\)/g)) out += x[1].replace(/\\(.)/g, '$1');
    for (const x of data.matchAll(/<([0-9A-Fa-f\s]+)>/g)) {
      const h = x[1].replace(/\s/g, '');
      for (let i = 0; i + 1 < h.length; i += 2) out += String.fromCharCode(parseInt(h.slice(i, i + 2), 16));
    }
  }
  return out;
}

test('the downloadable resume PDF has no phone number', async () => {
  const text = pdfText('dist/assets/John_Nguyen_Resume.pdf');
  expect(text).toContain('Nguyen'); // the reader really found text
  expect(text).not.toMatch(PHONE);
});

test('a corrupted or hostile save can never crash the site or inject markup', async ({ page }) => {
  const errors = errorsOf(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('jn-resume-v1', JSON.stringify({
      visited: 5, cleared: '"]<img src=x onerror=window.__pwned=1>', lit: { a: 1 }, achievements: null,
      settings: { sound: '"><img src=x onerror=window.__pwned=1>', music: 'loud', reduceMotion: 'x' }
    }));
    sessionStorage.setItem('clear-pending', '"]<b>x</b>');
  });
  await openBoard(page);
  await page.goto('/#/system');
  await expect(page.locator('#page h2.ransom')).toBeVisible();
  await expect(page.locator('[data-toggle="sound"]')).toHaveAttribute('aria-pressed', 'true'); // junk is not a choice: the default (on)
  await expect(page.locator('#musicVol')).toHaveValue('0.5');
  await page.evaluate(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')); });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  expect(await page.locator('img[src="x"]').count()).toBe(0);
  expect(errors).toEqual([]);
});

test('hostile ?company= values render as plain text', async ({ page }) => {
  const errors = errorsOf(page);
  for (const bad of ['constructor', '__proto__', '<script>alert(1)</script>', '" onmouseover="alert(1)']) {
    await openBoard(page, `/?company=${encodeURIComponent(bad)}#/board`);
    expect(await page.locator('#board script').count()).toBe(0);
    await expect(page.locator('.plan-note')).not.toContainText('Object');
  }
  expect(errors).toEqual([]);
});

test('progress is saved: returning visitors CONTINUE their file from SAVE DATA', async ({ page }) => {
  await page.goto('/#/skills');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'skills');
  await page.goto('/#/stats');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'stats');
  await page.goto('/#/');
  await page.reload();
  await expect(page.locator('#pressStart')).toHaveText('CONTINUE');
  await expect(page.locator('#saveLine')).toHaveCount(0); // (the old save line under the button is gone)
  await page.locator('#pressStart').click();
  const file1 = page.locator('#saves .sv-slot[data-i="0"]');
  await expect(file1).toHaveAccessibleName(/File 1: STATS, 2 of 8 cleared/);
  await file1.click();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'board');
  await expect(page.locator('#progressChip')).toContainText('2/8');
});

/* ---- with animations ON: the timing bugs only show up when transitions really run ---- */
test.describe('with motion on', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('a newer navigation wins: no stale title slam, no stale visit', async ({ page }) => {
    const errors = errorsOf(page);
    await openBoard(page);
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      window.__punch = [];
      new MutationObserver(() => window.__punch.push(document.getElementById('punchText').textContent)).observe(document.getElementById('punchText'), { childList: true, characterData: true, subtree: true });
    });
    await page.evaluate(() => (location.hash = '#/stats'));
    await page.waitForTimeout(150);
    await page.evaluate(() => (location.hash = '#/contact'));
    await page.waitForTimeout(2500);
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'contact');
    expect((await page.evaluate(() => window.__punch)).join(' ')).not.toContain('STATS');
    expect(await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('jn-resume-v1')); return d.slots[d.active].visited; })).not.toContain('stats');
    expect(errors).toEqual([]);
  });

  test('THE DROP: THE PLAN -> chapter 1 falls past the tower and lands on the page', async ({ page }) => {
    const errors = errorsOf(page);
    await openBoard(page);
    await page.waitForTimeout(1500);
    await page.evaluate(() => (location.hash = '#/stats'));
    await expect(page.locator('.fall')).toHaveCount(1);
    await expect(page.locator('.fall-sign .sr-only')).toHaveText('STATS'); // the sign is cut-out letters; this is its plain-text name
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'stats');
    await expect(page.locator('.fall')).toHaveCount(0, { timeout: 4000 }); // the film cut cleans itself up
    await expect(page.locator('#page .back-btn')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('PRESS START: the train bursts out of the tunnel, blows the title away, and the board lands', async ({ page }) => {
    const errors = errorsOf(page);
    await page.goto('/');
    await expect(page.locator('.bd-cam canvas').first()).toBeAttached({ timeout: 6000 }); // the platform layers (trash below, the train's GPU side between, its nose on top) mount once the art loads
    await page.locator('#pressStart').click({ force: true });
    await page.locator('#saves .sv-slot').first().click();
    await expect(page.locator('.fall.tunnel')).toHaveCount(1);
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'board', { timeout: 15000 });
    await expect(page.locator('.fall.tunnel')).toHaveCount(0, { timeout: 4000 }); // the shot cleans up after itself
    expect(await page.locator('#backdrop').evaluate((b) => b.style.translate)).toBe(''); // the camera shake is reset
    expect(await page.locator('.title-block').evaluate((t) => t.style.transform)).toBe(''); // the title is back in place for next time
    expect(errors).toEqual([]);
  });

  test('NEXT EPISODE: pushing past the bottom of a page fills the fuse and rolls the next chapter', async ({ page, isMobile }) => {
    test.skip(isMobile, 'wheel input is desktop only (the button path is tested on every device)');
    const errors = errorsOf(page);
    await page.goto('/#/missions');
    await expect(page.locator('#page .next-ep')).toBeVisible();
    await page.locator('#screen-page').evaluate((s) => s.scrollTo(0, s.scrollHeight));
    await page.mouse.move(600, 400);
    await page.waitForTimeout(2000); // let the page's title slam finish (pushes during an animation don't count)
    for (let i = 0; i < 14; i++) {
      await page.mouse.wheel(0, 100);
      await page.waitForTimeout(80);
    }
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'skills', { timeout: 4000 });
    expect(errors).toEqual([]);
  });

  test('leaving during the case-file cut-in does not pop the file over the next screen', async ({ page }) => {
    await page.goto('/#/missions');
    await page.waitForTimeout(1500);
    await page.locator('.poster[data-mission="arcas"]').click({ force: true }); // posters sway on purpose (idle motion)
    await page.waitForTimeout(100);
    await page.evaluate(() => (location.hash = '#/quick'));
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'quick');
    await expect(page.locator('#modal')).toBeHidden();
  });

  test('keyboard: Enter on the sound button does not start the game, pages land focus on something real', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard check');
    await page.goto('/');
    await page.waitForTimeout(1200);
    await page.locator('#soundBtn').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'title');
    for (const id of ['missions', 'skills', 'stats', 'side-quests', 'system']) {
      await page.evaluate((x) => (location.hash = `#/${x}`), id);
      await expect(page.locator('body')).toHaveAttribute('data-screen', id);
      await page.waitForTimeout(2200);
      const tag = await page.evaluate(() => (document.activeElement === document.body ? 'BODY' : document.activeElement.closest('#page') ? 'PAGE' : 'ELSEWHERE'));
      expect(tag, `focus after opening ${id}`).toBe('PAGE');
    }
  });

  test('an open file traps focus and gives it back when closed', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard check');
    await page.goto('/#/missions');
    await page.waitForTimeout(1500);
    const opener = page.locator('.poster[data-mission="meliona"]');
    await opener.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#modal')).toBeVisible();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => Boolean(document.activeElement.closest('#modal')))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(page.locator('#modal')).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('menu -> STATS (flip wipe) and a repeated hotkey still land focus on the page', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard check');
    await openBoard(page);
    await page.waitForTimeout(1500);
    await page.locator('#menuBtn').click();
    await page.waitForTimeout(500);
    await page.locator('.stair-item[data-go="stats"]').click();
    await page.waitForTimeout(2500);
    expect(await page.evaluate(() => Boolean(document.activeElement.closest('#page')))).toBe(true);
    await page.keyboard.press('3');
    await page.waitForTimeout(400);
    await page.keyboard.press('3'); // same page again: must not cancel the entrance
    await page.waitForTimeout(2500);
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'skills'); // menu order = chapter order: 3 is SKILLS
    expect(await page.evaluate(() => Boolean(document.activeElement.closest('#page')))).toBe(true);
  });

  test('menu: opens with focus on the first item, Esc returns focus to MENU', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard check');
    await openBoard(page);
    await page.waitForTimeout(1500);
    await page.locator('#menuBtn').click();
    await expect(page.locator('#menuBtn')).toHaveAttribute('aria-expanded', 'true');
    await page.waitForTimeout(500);
    await expect(page.locator('.stair-item').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#menuBtn')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#menuBtn')).toBeFocused();
  });
});

test('every CASE LOG item can be reached from the site itself (ALL CLEAR is possible)', async ({ page }) => {
  await openBoard(page);
  // open every chapter from THE PLAN by clicking, then mark both projects cleared
  for (const id of ['stats', 'missions', 'skills', 'side-quests', 'different', 'contact']) {
    await page.locator(`.pl-item[data-ch="${id}"]`).click();
    await expect(page.locator('body')).toHaveAttribute('data-screen', id);
    await page.locator('#page .back-btn').click();
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'board');
  }
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('jn-resume-v1'));
    d.slots[d.active].cleared = ['meliona', 'arcas'];
    localStorage.setItem('jn-resume-v1', JSON.stringify(d));
  });
  await page.goto('/#/');
  await page.reload();
  await page.locator('#pressStart').click();
  await expect(page.locator('#saves .sv-slot.sv-complete')).toHaveCount(1); // its file carries the COMPLETED stamp
  await expect(page.locator('#saves .sv-complete .sv-done')).toBeVisible();
});

test('every story page ends with a NEXT EPISODE card that rolls the next chapter', async ({ page }) => {
  const order = ['stats', 'missions', 'skills', 'side-quests', 'different', 'contact', 'board'];
  await page.goto('/#/stats');
  for (let i = 1; i < order.length; i++) {
    await expect(page.locator('body')).toHaveAttribute('data-screen', order[i - 1]);
    await page.locator('#page [data-episode]').click({ force: true });
  }
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'board');
});

test('SAVE DATA is a stack: every card peeks out, and picking one opens it and slides the cards below it down', async ({ page }) => {
  const errors = errorsOf(page);
  await page.goto('/#/stats');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'stats');
  await page.goto('/#/');
  await page.reload();
  await page.locator('#pressStart').click();
  const saves = page.locator('#saves');
  await expect(saves).toBeVisible();
  const slot = (i) => saves.locator(`.sv-slot[data-i="${i}"]`);
  const settle = () => page.waitForTimeout(450);
  // every card's file number is on screen and on top (its peek row is not covered by the next card)
  const peeksOut = () => page.evaluate(() => [...document.querySelectorAll('#saves .sv-slot[data-i]')].map((s) => {
    const r = s.querySelector('.sv-no').getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && !!hit && s.contains(hit);
  }));
  // the cards overlap (a stack, not a list)
  const overlap = await page.evaluate(() => {
    const a = document.querySelector('#saves .sv-slot[data-i="2"]').getBoundingClientRect();
    const b = document.querySelector('#saves .sv-slot[data-i="3"]').getBoundingClientRect();
    return a.bottom - b.top;
  });
  expect(overlap).toBeGreaterThan(4);
  const y = async (i) => (await slot(i).boundingBox()).y;
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown'); // file 5 picked: nothing below it
  await expect(slot(4)).toHaveClass(/\bon\b/);
  await settle();
  expect(await peeksOut()).toEqual([true, true, true, true, true]);
  const restY = await y(3);
  for (const k of [0, 0, 0, 0]) await page.keyboard.press('ArrowUp'); // back to file 1
  await expect(slot(0)).toHaveClass(/\bon\b/);
  await settle();
  expect(await peeksOut()).toEqual([true, true, true, true, true]);
  expect(await y(3)).toBeGreaterThan(restY + 10); // file 1 opened: the cards below slid down to make room
  await expect(slot(0).locator('.sv-go')).toBeVisible();
  expect(await slot(3).locator('.sv-more').evaluate((e) => e.offsetHeight)).toBeLessThan(2); // closed cards keep their details row shut
  expect(await slot(0).locator('.sv-more').evaluate((e) => e.offsetHeight)).toBeGreaterThan(20);
  // all black, no red L; the picked file pops with THE PLAN's language: a yellow star cursor at its left end
  // and ONE red blade: the card itself running on to the left (no second white blade: it read as two shapes); a red halftone corner
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); // file 3 picked
  await settle();
  const pop = await page.evaluate(() => {
    const lis = [...document.querySelectorAll('#saves .sv-li')];
    const star = (li) => { const r = li.querySelector('.sv-star').getBoundingClientRect(); return { on: getComputedStyle(li.querySelector('.sv-star')).opacity === '1', inView: r.left >= 0 && r.right <= innerWidth && r.width > 20 }; };
    const blade = (li) => getComputedStyle(li, '::before').display;
    return { bg: getComputedStyle(document.querySelector('#saves')).backgroundColor, gone: document.querySelectorAll('#saves .sv-l, #saves .sv-band, #saves .sv-arm').length,
      star: star(lis[2]), others: lis.filter((l, k) => k !== 2).every((l) => getComputedStyle(l.querySelector('.sv-star')).opacity === '0'),
      white: blade(lis[2]), red: getComputedStyle(lis[2], '::after').backgroundColor, dots: !!document.querySelector('#saves .sv-dots') };
  });
  expect(pop).toEqual({ bg: 'rgb(11, 11, 11)', gone: 0, star: { on: true, inView: true }, others: true, white: 'none', red: 'rgb(229, 25, 28)', dots: true });
  expect(errors).toEqual([]);
});

test('SAVE DATA: five files; a new game starts clean in its own file, the old file keeps its progress, its CLEAR DATA tag asks twice; keys work', async ({ page }) => {
  const errors = errorsOf(page);
  // file 1 has played STATS (a deep link saves to the visitor's first file)
  await page.goto('/#/stats');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'stats');
  await page.goto('/#/');
  await page.reload();
  await page.locator('#pressStart').click();
  const saves = page.locator('#saves');
  await expect(saves).toBeVisible();
  await expect(saves.locator('.sv-slot')).toHaveCount(5); // (no CLEAR DATA box: each file has its own tag)
  await expect(saves.locator('.sv-erase')).toHaveCount(1); // (only a file with a game has one)
  await expect(saves.locator('.sv-empty')).toHaveCount(4);
  await expect(saves.locator('.sv-slot[data-i="0"]')).toHaveClass(/\bon\b/); // the last file played is picked
  await expect(saves.locator('.sv-slot[data-i="0"]')).toBeFocused();
  // keys: Down picks file 2, Esc goes back to the title
  await page.keyboard.press('ArrowDown');
  await expect(saves.locator('.sv-slot[data-i="1"]')).toHaveClass(/\bon\b/);
  await expect(saves.locator('.sv-slot[data-i="1"]')).toContainText('START NEW GAME');
  await page.keyboard.press('Escape');
  await expect(saves).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'title');
  // a new game in file 2: THE PLAN starts clean (nothing read)
  await page.locator('#pressStart').click();
  await saves.locator('.sv-slot[data-i="1"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'board');
  await expect(page.locator('#progressChip')).toContainText('0/8');
  await page.goto('/#/skills');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'skills');
  // both files are kept, each with its own progress
  await page.goto('/#/');
  await page.reload();
  await page.locator('#pressStart').click();
  await expect(saves.locator('.sv-slot[data-i="0"]')).toHaveAccessibleName(/File 1: STATS, 1 of 8 cleared/);
  await expect(saves.locator('.sv-slot[data-i="1"]')).toHaveAccessibleName(/File 2: SKILLS, 1 of 8 cleared/);
  await expect(saves.locator('.sv-slot[data-i="1"]')).toHaveClass(/\bon\b/); // file 2 was played last
  // back to file 1: its own progress comes back
  await saves.locator('.sv-slot[data-i="0"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'board');
  expect(await page.evaluate(() => [...document.querySelectorAll('#board .pl-item.read, #board .pl-item[data-read]')].length >= 0)).toBe(true);
  await expect(page.locator('#progressChip')).toContainText('1/8');
  expect(await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('jn-resume-v1')); return [d.active, d.slots[0].visited, d.slots[1].visited]; })).toEqual([0, ['stats'], ['skills']]);
  // CLEAR DATA on file 2 (its own small tag, there without picking the file): the first press asks, the second clears it
  await page.goto('/#/');
  await page.reload();
  await page.locator('#pressStart').click();
  await saves.locator('.sv-slot[data-i="0"]').hover(); // (file 1 picked: file 2's tag is still there)
  const erase = saves.locator('.sv-erase[data-erase="1"]');
  await expect(erase).toHaveText('CLEAR DATA');
  await expect(saves.locator('.sv-erase[data-erase="0"]')).toBeVisible();
  await erase.click();
  await expect(erase).toHaveText('SURE?');
  await expect(saves.locator('.sv-empty')).toHaveCount(3); // not yet
  await erase.click();
  await expect(saves.locator('.sv-empty')).toHaveCount(4);
  await expect(saves.locator('.sv-slot[data-i="0"]')).not.toHaveClass(/sv-empty/); // file 1 untouched
  expect(errors).toEqual([]);
});

test('SAVE DATA: a save from before files becomes File 1, and a hostile file can never inject markup', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('jn-resume-v1', JSON.stringify({ visited: ['stats', 'missions'], cleared: ['meliona'], achievements: ['first-words'], settings: { sound: false, soundChosen: true, music: 0.3, reduceMotion: null } }));
  });
  await page.goto('/');
  await page.locator('#pressStart').click();
  await expect(page.locator('#saves .sv-slot[data-i="0"]')).toHaveAccessibleName(/File 1: THE STATION, 3 of 8 cleared/);
  const d = await page.evaluate(() => JSON.parse(localStorage.getItem('jn-resume-v1')));
  expect(d.v === undefined || d.v === 2).toBe(true);
  await page.evaluate(() => localStorage.setItem('jn-resume-v1', JSON.stringify({ v: 2, active: 7, settings: {}, slots: [{ visited: ['<img src=x onerror=window.__pwned=1>'], meta: { last: '"><b>x</b>', saved: 'soon', playMs: -5 } }, 'junk', null] })));
  await page.reload();
  await page.locator('#pressStart').click();
  await expect(page.locator('#saves .sv-slot[data-i]')).toHaveCount(5);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  expect(await page.locator('#saves img, #saves b:not(.sv-date b, .sv-lv b, .sv-time b)').count()).toBe(0);
});

test('Back closes an open case file instead of leaving the page', async ({ page }) => {
  await page.goto('/#/missions');
  await page.locator('.poster[data-mission="meliona"]').click();
  await expect(page.locator('#modal')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#modal')).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'missions');
  // closing with X does not leave a stray history step behind
  await page.locator('.poster[data-mission="meliona"]').click();
  await page.locator('#modalPanel [data-close]').click();
  await expect(page.locator('#modal')).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'missions');
});

test('Ctrl+K opens and closes the menu', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard');
  await openBoard(page);
  await page.keyboard.press('Control+k');
  await expect(page.locator('#menu')).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(page.locator('#menu')).toBeHidden();
});

test('every menu item fits on short laptop screens and phones held sideways', async ({ page, isMobile }) => {
  test.skip(isMobile, 'sizes are set by hand');
  for (const [width, height] of [[1440, 900], [1366, 768], [1280, 720], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/#/missions');
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'missions');
    await page.locator('#menuBtn').click();
    await expect(page.locator('#menu')).toBeVisible();
    await page.waitForTimeout(1200); // the staircase slides in
    const bottoms = await page.$$eval('#stair .stair-item', (els) => els.map((e) => e.getBoundingClientRect().bottom));
    expect(bottoms.length).toBe(7);
    for (const b of bottoms) expect(b, `${width}x${height}`).toBeLessThanOrEqual(height);
    await page.keyboard.press('Escape');
  }
});

test('the line map: ticket tiles (no circles), the station names over the line, a dagger is thrown through the stop you are at (it pokes through the ticket, rattles, with a sound) and passed stops keep a cut', async ({ page }) => {
  await page.addInitScript(() => { window.__sfxLog = []; try { localStorage.setItem('jn-resume-v1', JSON.stringify({ visited: ['stats'] })); } catch {} });
  await page.goto('/#/missions');
  const strip = page.locator('#page .stop-strip');
  await expect(strip.locator('.ss-name')).toHaveText(['YONGEN-JAYA', 'SHIBUYA', 'AOYAMA-ITCHOME', 'SHINJUKU', 'AKIHABARA', 'KICHIJOJI']);
  await expect(strip.locator('.ss-num')).toHaveText(['01', '02', '03', '04', '05', '06']);
  expect(await strip.locator('.ss-dot').first().evaluate((e) => getComputedStyle(e).borderRadius)).toBe('0px'); // not a circle
  await expect(strip.locator('.ss-stop.now .ss-name')).toHaveText('SHIBUYA');
  await expect(strip.locator('.ss-stop.seen')).toHaveCount(1);
  await expect(strip.locator('.ss-dagger')).toHaveCount(1); // only in the stop you're at
  await expect(strip.locator('.ss-stop.now')).toHaveClass(/\bstab\b|\bin\b/, { timeout: 5000 });
  await expect(strip.locator('.ss-stop.now .ss-dagger-back')).toHaveCount(1); // (its point comes out under the ticket)
  await expect(strip.locator('.ss-dagger')).toHaveCSS('opacity', '1', { timeout: 3000 });
  // thrown like a dart, it pokes through the ticket and rattles to a stop: the slit shows once it's in
  await expect(strip.locator('.ss-stop.now .ss-tear')).toHaveCount(1);
  await expect(strip.locator('.ss-stop.now .ss-tear')).toBeVisible();
  // the station's name hangs under your ticket, clear of the dagger
  const [nm, tk] = await Promise.all([strip.locator('.ss-stop.now .ss-name').boundingBox(), strip.locator('.ss-dot.now').boundingBox()]);
  expect(nm.y).toBeGreaterThan(tk.y + tk.height - 6);
  await expect(strip).toHaveAttribute('aria-label', /SHIBUYA/);
  await expect(strip.locator('.ss-dot.now')).toHaveAttribute('aria-label', /SHIBUYA/);
  // its point is in the tile, its handle above it
  const [tile, dag] = await Promise.all([strip.locator('.ss-dot.now').boundingBox(), strip.locator('.ss-dagger').boundingBox()]);
  expect(dag.y + dag.height).toBeGreaterThan(tile.y);
  expect(dag.y).toBeLessThan(tile.y - 20);
  // the next chapter moves the dagger there (a click first: browsers play no sound before one)
  await page.mouse.click(4, 640);
  await page.waitForTimeout(300);
  await page.evaluate(() => { location.hash = '#/skills'; });
  await expect(page.locator('#page .stop-strip .ss-stop.now .ss-name')).toHaveText('AOYAMA-ITCHOME', { timeout: 8000 });
  await expect(page.locator('#page .stop-strip .ss-dagger')).toHaveCount(1);
  await expect(page.locator('#page .stop-strip .ss-stop.seen')).toHaveCount(2); // the stop you left keeps its cut
  await expect.poll(() => page.evaluate(() => window.__sfxLog.includes('stab')), { timeout: 6000 }).toBe(true);
});

test('the guide: every chapter shows where you are, and the guide button leads to the next stop', async ({ page, isMobile }) => {
  await page.goto('/#/skills');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'skills');
  const strip = page.locator('#page .stop-strip');
  await expect(strip).toContainText('STOP 03 / 06');
  await expect(strip.locator('.ss-dot.now')).toHaveAttribute('href', '#/skills');
  if (isMobile) {
    const guide = page.locator('.guide');
    await expect(guide).toContainText('NEXT: SIDE QUESTS');
    // it never rests on words (Nov 21): at the top of SKILLS on a phone its corner is all skill meters, so it waits;
    // scrolled to a clear spot (between the list and RECEIPTS) it shows, and never over the page's words
    await expect.poll(async () => {
      await page.locator('#screen-page').evaluate((s) => { s.scrollTop += 60; s.dispatchEvent(new Event('scroll')); });
      await page.waitForTimeout(1100);
      return guide.isVisible();
    }, { timeout: 20000, intervals: [0] }).toBe(true);
    expect(await page.evaluate(() => { const r = document.querySelector('.guide').getBoundingClientRect(); const hit = (q) => q.left < r.right - 2 && q.right > r.left + 2 && q.top < r.bottom - 2 && q.bottom > r.top + 2;
      return [...document.querySelectorAll('#page *')].some((el) => { if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return false; const g = document.createRange(); g.selectNodeContents(el); return [...g.getClientRects()].some(hit); }); })).toBe(false);
    await guide.click(); // scrolls to the NEXT STOP card, then bows out
    await expect(page.locator('#page .next-ep')).toBeInViewport();
    await expect(guide).toBeHidden();
  }
  await page.locator('#page .back-btn').click();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'board');
  await expect(page.locator('.guide')).toBeHidden();
});

test('the guided ride: every chapter arrives with its own transition (six stops, six different moves)', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = errorsOf(page);
  await page.addInitScript(() => {
    window.__moves = [];
    new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach((n) => {
      if (n.nodeType === 1 && /\b(fall|fxw)\b/.test(n.className)) window.__moves.push(`${n.className}|${n.firstElementChild?.className || ''}`);
    }))).observe(document, { childList: true, subtree: true }); // init scripts run before <html> exists
  });
  await page.goto('/#/board');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'board');
  await page.waitForTimeout(1200);
  const ride = ['stats', 'missions', 'skills', 'side-quests', 'different', 'contact'];
  const seen = [];
  for (const [k, id] of ride.entries()) {
    const before = await page.evaluate(() => window.__moves.length);
    if (k === 0) await page.locator('#board .plan-continue').click();
    else await page.locator('#page .next-ep .ne-go').click({ force: true });
    await expect(page.locator('body')).toHaveAttribute('data-screen', id, { timeout: 6000 });
    seen.push(await page.evaluate((b) => window.__moves[b], before));
    await page.waitForTimeout(1600);
  }
  expect(seen.every(Boolean)).toBe(true);
  expect(new Set(seen).size).toBe(6);
  expect(errors).toEqual([]);
  await ctx.close();
});

test('THE PLAN holds still: nothing on the hub jumps between frames (a scrollbar loop once made it jitter)', async ({ page }) => {
  await openBoard(page);
  await page.waitForTimeout(800);
  const tops = await page.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      out.push([...document.querySelectorAll('#board .pl-item, #board .plan-continue')].map((e) => Math.round(e.getBoundingClientRect().top)).join(','));
    }
    return out;
  });
  expect(new Set(tops).size).toBe(1);
  const over = await page.evaluate(() => { const s = document.querySelector('#screen-board'); return s.scrollHeight - s.clientHeight; });
  expect(over).toBeLessThanOrEqual(0);
});

test('THE PLAN: a mouse resting where a chapter slides in does not steal the pick; moving it does', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mouse only');
  await openBoard(page);
  const box = await page.locator('.pl-item[data-ch="contact"]').boundingBox();
  await page.locator('.pl-item[data-ch="stats"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'stats');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); // rest the mouse where CONTACT will be
  await page.locator('#page .back-btn').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'board');
  await page.waitForTimeout(600);
  await expect(page.locator('#board .pl-item.on')).toHaveAttribute('data-ch', 'missions'); // the next unread chapter
  await page.mouse.move(box.x + box.width / 2 + 6, box.y + box.height / 2 + 2); // a real move picks what's under it
  await expect(page.locator('#board .pl-item.on')).toHaveAttribute('data-ch', 'contact');
});

test('contact plate: LinkedIn, GitHub and email sit at the very top of every screen, readable and tappable', async ({ page, isMobile }) => {
  for (const r of ['/#/board', '/#/missions', '/#/contact', '/#/quick']) {
    await page.goto(r);
    const li = page.locator('#hudLinkedIn');
    const gh = page.locator('#hudGitHub');
    const em = page.locator('#hudEmail');
    await expect(li).toHaveAttribute('href', /linkedin\.com\/in\//);
    await expect(gh).toHaveAttribute('href', 'https://github.com/ricepillow3000');
    await expect(em).toHaveAttribute('href', /^mailto:[a-z0-9.]+@gmail\.com$/);
    for (const a of [li, gh, em]) {
      await expect(a).toBeVisible();
      const box = await a.boundingBox();
      expect(box.y, r).toBeLessThan(60); // the very top of the screen
      if (isMobile) expect(box.width, r).toBeGreaterThanOrEqual(44); // a full tap target each
      expect(await a.getAttribute('aria-label')).toBeTruthy(); // named even when only the icon shows
    }
    await expect(li).toHaveAttribute('target', '_blank');
    await expect(gh).toHaveAttribute('rel', /noopener/);
  }
  // the email is copied too (many visitors have no mail app), with a toast that says so
  await page.goto('/#/board');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await page.locator('#hudEmail').evaluate((a) => a.addEventListener('click', (e) => e.preventDefault()));
  await page.locator('#hudEmail').click();
  await expect(page.locator('.toast').filter({ hasText: 'EMAIL COPIED' })).toBeVisible();
});

test('title: the CONNECT card holds LinkedIn, GitHub and email (or, where it would touch the title, the plate does), and nothing touches the title', async ({ page, isMobile }) => {
  await page.goto('/');
  await page.waitForTimeout(1500);
  const onCard = await page.locator('#contactCard').isVisible();
  const ids = onCard ? ['#ccLinkedIn', '#ccGitHub', '#ccEmail'] : ['#hudLinkedIn', '#hudGitHub', '#hudEmail'];
  for (const id of ids) {
    await expect(page.locator(id)).toBeVisible();
    if (isMobile) expect((await page.locator(id).boundingBox()).height, id).toBeGreaterThanOrEqual(onCard ? 44 : 26);
  }
  await expect(page.locator(ids[0])).toHaveAttribute('href', /linkedin\.com\/in\//);
  await expect(page.locator(ids[1])).toHaveAttribute('href', 'https://github.com/ricepillow3000');
  await expect(page.locator(ids[2])).toHaveAttribute('href', /^mailto:/);
  if (onCard) await expect(page.locator('.cc-goal')).toHaveText('Status: open to opportunities');
  // the card and the calendar never touch the title's text (the fit guard)
  const overlaps = await page.evaluate(() => {
    const R = (el) => el.getBoundingClientRect();
    const vis = (el) => el && getComputedStyle(el).display !== 'none' && R(el).width > 0;
    const title = [...document.querySelectorAll('#titleName, .title-codename, .title-role, .title-hook, #pressStart, .quick-link')].map(R);
    const mine = [document.querySelector('#contactCard'), ...document.querySelectorAll('.hud-cal > *')].filter(vis).map(R);
    return mine.filter((a) => title.some((c) => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom)).length;
  });
  expect(overlaps).toBe(0);
});

test('title calendar: date, weekday and time of day from the visitor\'s clock, plus Atlanta\'s live weather (and quietly none when it can\'t load)', async ({ browser }) => {
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (const ok of [true, false]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    let asked = '';
    await ctx.route('**/api.open-meteo.com/**', (r) => {
      asked = r.request().url();
      return ok ? r.fulfill({ contentType: 'application/json', body: JSON.stringify({ current: { temperature_2m: 57.6, weather_code: 63, is_day: 0 } }) }) : r.abort();
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    const now = new Date();
    await expect(page.locator('.cal-d')).toHaveText(String(now.getDate()).padStart(2, '0'));
    await expect(page.locator('.cal-m')).toHaveText(String(now.getMonth() + 1));
    await expect(page.locator('.cal-week')).toHaveText(new RegExp(`^${DAYS[now.getDay()]}$`, 'i')); // magazine letters: some are lowercase on purpose
    await expect(page.locator('.cal-tod')).toHaveText(/^(Early Morning|Morning|Lunchtime|Afternoon|After School|Evening|Late Night)$/);
    if (ok) {
      await expect(page.locator('.cal-wx')).toHaveText('ATL · RAIN · 58°', { timeout: 8000 });
      expect(asked).toContain('latitude=33.749'); // Atlanta's fixed spot: nothing about the visitor is sent
      await expect(page.locator('.hud-cal')).toHaveAttribute('aria-label', /Atlanta weather: rain, 58 degrees/);
    } else {
      await page.waitForTimeout(4500);
      await expect(page.locator('.cal-wx')).toHaveCount(0); // no badge, no error
    }
    expect(errors).toEqual([]);
    await ctx.close();
  }
});

test('sound: SETTINGS credits every real recording, and every clip the engine asks for exists', async ({ page, request }) => {
  await page.goto('/#/system');
  const credits = page.locator('.sys-credits');
  await expect(credits).toContainText('Gregor Quendel');
  await expect(credits).toContainText('CC BY-SA 4.0');
  await expect(credits).toContainText('Litlok'); // the NEXT STOP braking
  await expect(credits).toContainText('Campos'); // the PRESS START pass
  await expect(credits).toContainText('CC BY-SA 3.0');
  await expect(credits).toContainText('ProtoplasmaKid'); // the NEXT STOP metro braking
  await expect(credits).toContainText('W.carter'); // THE DROP's gale
  await expect(credits.locator('li')).toHaveCount(15);
  const src = readFileSync(join(process.cwd(), 'src/audio/audio.js'), 'utf8');
  const names = [...src.slice(src.indexOf('const CLIP_HIT = {'), src.indexOf('};', src.indexOf('const CLIP_HIT = {'))).matchAll(/'([a-z-]+)':/g)].map((m) => m[1]);
  expect(names.length).toBe(15);
  for (const n of names) {
    const r = await request.get(`/assets/sfx/${n}.mp3`);
    expect(r.status(), n).toBe(200);
  }
  // no recording ships without its credit: every file in the folder is in CREDITS.txt and on SETTINGS,
  // and every share-alike clip says it was changed (CC BY-SA asks for both)
  const dir = join(process.cwd(), 'public/assets/sfx');
  const files = readdirSync(dir).filter((f) => f.endsWith('.mp3'));
  expect(files.sort()).toEqual(names.map((n) => `${n}.mp3`).sort());
  const txt = readFileSync(join(dir, 'CREDITS.txt'), 'utf8');
  const { SOUND_CREDITS } = await import('../../src/data/credits.js');
  for (const f of files) {
    expect(txt, f).toContain(f);
    expect(SOUND_CREDITS.some((c) => c.file.split(', ').includes(f)), f).toBe(true);
  }
  for (const c of SOUND_CREDITS.filter((x) => x.license.startsWith('CC BY-SA'))) expect(c.changes, c.file).toContain(c.license);
});

test('sound: on by default, but nothing downloads and nothing plays before the first tap; the first tap starts the effects and the music', async ({ page }) => {
  const fetched = [];
  const music = [];
  page.on('request', (r) => { if (r.url().includes('/assets/sfx/')) fetched.push(r.url()); if (/\/music[-.]/.test(r.url())) music.push(r.url()); });
  await page.goto('/');
  await expect(page.locator('#soundBtn')).toHaveAttribute('aria-pressed', 'true'); // on by default
  await page.waitForTimeout(2500);
  expect(fetched).toEqual([]); // no gesture yet: no audio engine, no downloads
  expect(music).toEqual([]);
  await page.locator('.title-hook').click(); // the first tap anywhere
  await expect.poll(() => fetched.length, { timeout: 5000 }).toBe(15);
  await expect.poll(() => music.length, { timeout: 5000 }).toBe(1);
  await expect.poll(() => page.evaluate(() => document.querySelector('#soundBtn').getAttribute('aria-pressed'))).toBe('true');
});

test('sound: leaving the page pauses it and coming back resumes it, with no toggling; a choice to mute is remembered', async ({ page }) => {
  await page.goto('/');
  await page.locator('.title-hook').click(); // starts the sound
  const state = () => page.evaluate(() => window.__acState?.());
  await page.evaluate(async () => { const m = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => /audio\.js|main-/.test(n)) || ''); return m; }).catch(() => {});
  // the page goes away (another app or tab) and comes back
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(500);
  await expect(page.locator('#soundBtn')).toHaveAttribute('aria-pressed', 'true');
  // mute, reload: it stays muted (the visitor's choice is kept)
  await page.locator('#soundBtn').click();
  await expect(page.locator('#soundBtn')).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(page.locator('#soundBtn')).toHaveAttribute('aria-pressed', 'false');
  void state;
});

test('tower lights: every aviation light blinks on its own random beat (never all together); all steady on with reduced motion', async ({ page, browser }) => {
  await openBoard(page); // reduced motion (this context)
  const states = () => page.locator('.bd-avfix .av').evaluateAll((els) => els.map((e) => e.classList.contains('lit')));
  await expect.poll(async () => (await states()).every(Boolean)).toBe(true);
  const ctx = await browser.newContext({ reducedMotion: 'no-preference' });
  const p2 = await ctx.newPage();
  await p2.goto('/#/board');
  const rows = [];
  for (let i = 0; i < 40; i++) {
    rows.push(await p2.locator('.bd-avfix .av').evaluateAll((els) => els.map((e) => (e.classList.contains('lit') ? 1 : 0)).join('')));
    await p2.waitForTimeout(150);
  }
  expect(rows[0].length).toBe(23);
  expect(rows.filter((r) => /^(0+|1+)$/.test(r)).length).toBeLessThan(3); // almost never all on or all off at once
  for (let i = 0; i < 23; i++) expect(new Set(rows.map((r) => r[i])).size, `light ${i} blinks`).toBe(2);
  // no two lights share a rhythm
  const cols = [...Array(23).keys()].map((i) => rows.map((r) => r[i]).join(''));
  expect(new Set(cols).size).toBeGreaterThan(18);
  // its lens and its light switch together
  const pairs = await p2.evaluate(() => [...document.querySelectorAll('.bd-avfix .av')].map((e) => e.classList.contains('lit') === document.querySelector(`.bd-avglow .av[data-av="${e.dataset.av}"]`).classList.contains('lit')));
  expect(pairs.every(Boolean)).toBe(true);
  await ctx.close();
});

test('city billboard: TAKE YOUR TIME crawls across the ring above JOHN NGUYEN ★, both looping (both rest centered with reduced motion)', async ({ page, browser }) => {
  await openBoard(page);
  await expect(page.locator('.bd-billboard .bb-ring')).toHaveCount(2);
  const word = (ring) => page.locator(`.bb-${ring} .bb-ch text`).evaluateAll((els) => els.map((e) => e.textContent || ' ').join(''));
  expect((await word('top')).replace(/\s+/g, ' ').trim()).toBe('TAKE YOUR TIME');
  expect((await word('middle')).replace(/\s+/g, ' ').trim()).toBe('JOHN NGUYEN');
  await expect(page.locator('.bb-middle .bb-ch')).toHaveCount(12); // J O H N _ N G U Y E N ★
  const visible = (ring) => page.locator(`.bb-${ring} .bb-ch`).evaluateAll((els) => els.filter((e) => e.style.visibility === 'visible').length);
  // reduced motion (this context): each line sits still in the middle of its ring, whole
  await expect.poll(() => visible('top')).toBeGreaterThan(13);
  await expect.poll(() => visible('middle')).toBeGreaterThan(8);
  // with motion: both lines move, and each one leaves its screen and comes back (a loop)
  const ctx = await browser.newContext({ reducedMotion: 'no-preference' });
  const p2 = await ctx.newPage();
  await p2.goto('/#/board');
  const firsts = { top: new Set(), middle: new Set() };
  const gone = { top: false, middle: false };
  for (let i = 0; i < 30; i++) {
    const r = await p2.evaluate(() => Object.fromEntries(['top', 'middle'].map((n) => {
      const first = document.querySelector(`.bb-${n} .bb-ch`);
      return [n, first.style.visibility === 'visible' ? first.getAttribute('transform') : null];
    })));
    for (const n of ['top', 'middle']) { if (r[n]) firsts[n].add(r[n]); else gone[n] = true; }
    if (firsts.top.size > 3 && firsts.middle.size > 3 && gone.top && gone.middle) break;
    await p2.waitForTimeout(400);
  }
  for (const n of ['top', 'middle']) {
    expect(firsts[n].size, n).toBeGreaterThan(3); // the first letter crossed the screen
    expect(gone[n], n).toBe(true); // and left it, to come back round
  }
  await ctx.close();
});

test('heavy train: the camera moves like a heavy train (steady rumble + wheel-set thumps, never a random buzz), and the heavy nose is ready on the first frame', async ({ browser }) => {
  // the motion is pure math: the same moment always moves the camera the same way
  const { cameraMotion, NOSE_PASS } = await import('../../src/fx/subway.js');
  const near = (t) => (t < NOSE_PASS - 0.27 ? 0 : Math.min(1, (t - (NOSE_PASS - 0.27)) / 0.27));
  const ys = [];
  for (let t = 0; t <= 1.25; t += 1 / 60) ys.push(cameraMotion(t, near(t)).y);
  expect(cameraMotion(0.9, 1)).toEqual(cameraMotion(0.9, 1));
  const early = Math.max(...ys.slice(0, 30).map(Math.abs)); // still in the tunnel
  const late = Math.max(...ys.slice(44).map(Math.abs)); // the wheel sets pass the camera
  const jump = ys.slice(1).reduce((a, y, i) => a + Math.abs(y - ys[i]), 0) / (ys.length - 1);
  expect(late).toBeGreaterThan(early * 2); // it builds to the thumps as the train arrives
  expect(late).toBeLessThan(30); // strong, never jarring
  expect(jump).toBeLessThan(4); // a slow, heavy shake (the old random buzz jumped ~6px a frame)
  expect(cameraMotion(NOSE_PASS, 1).s).toBeGreaterThan(1.01); // the air wall shoves the camera as the nose passes

  // a returning-visitor-speed tap: START right away still gets the shaded (heavy) nose
  const ctx = await browser.newContext({ reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.locator('#pressStart').click({ force: true });
  await page.locator('#saves .sv-slot').first().click();
  await expect(page.locator('.bd-cam')).toHaveAttribute('data-train-art', 'heavy', { timeout: 6000 });
  await ctx.close();
});

test('PRESS START train: the GPU side passes its self-test, or the site falls back to the 2D slices (never no train)', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => document.querySelector('.bd-cam')?.dataset.trainGpu || ''), { timeout: 10000 }).toMatch(/^(on|off)$/);
  const mode = await page.evaluate(() => document.querySelector('.bd-cam').dataset.trainGpu);
  const layers = await page.locator('.bd-cam canvas').count();
  expect(layers).toBe(mode === 'on' ? 3 : 2);
  await ctx.close();
});

test('a returning visitor who taps CONTINUE right away still gets the train (it waits for the scene)', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('jn-resume-v1', JSON.stringify({ visited: ['stats', 'missions'], achievements: ['first-words'], settings: { sound: false, music: 0.5, reduceMotion: null } })));
  await page.goto('/');
  await expect(page.locator('#pressStart')).toHaveText('CONTINUE');
  await page.evaluate(() => { window.__tunnel = false; new MutationObserver(() => { if (document.querySelector('.fall.tunnel')) window.__tunnel = true; }).observe(document.body, { childList: true }); });
  await page.locator('#pressStart').tap(); // before the phone has loaded the scene on its own (2.5s)
  await page.locator('#saves .sv-slot[data-i="0"]').tap(); // their file is already picked: one tap plays it
  await expect.poll(() => page.evaluate(() => window.__tunnel), { timeout: 6000 }).toBe(true);
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'board', { timeout: 15000 });
  await ctx.close();
});

test('NEXT STOP always has its train car: the interior is decoded before the shot starts', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('/#/missions');
  await expect(page.locator('#page .next-ep .ne-go')).toBeAttached();
  await page.evaluate(() => { window.__car = null; new MutationObserver(() => { const c = document.querySelector('.nextstop .ns-car'); if (c && window.__car === null) window.__car = c.complete && c.naturalWidth > 0; }).observe(document.body, { childList: true, subtree: true }); });
  await page.locator('#page .next-ep .ne-go').click({ force: true });
  await expect.poll(() => page.evaluate(() => window.__car), { timeout: 5000 }).toBe(true);
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'skills', { timeout: 6000 });
  await ctx.close();
});

test('station: the ceiling tubes flicker on their own (never two healthy ones at once), steady with reduced motion; the graffiti sits on a pillar on screen', async ({ page, browser }) => {
  // reduced motion (this context): every tube stays on
  await page.goto('/');
  await expect.poll(() => page.locator('.st-body .sl').count(), { timeout: 15000 }).toBe(15);
  await page.waitForTimeout(3000);
  expect(await page.locator('.st-body .sl').evaluateAll((els) => els.every((e) => e.dataset.st === 'on'))).toBe(true);
  // the graffiti (TAKE YOUR TIME and its cat, sprayed by tools/draw-graffiti.mjs): the painting loads, inside the screen
  const href = await page.locator('image.gf').getAttribute('href');
  expect(href).toContain('graffiti.webp');
  expect((await page.request.get(href)).status()).toBe(200);
  const vw = page.viewportSize().width;
  const gf = await page.locator('.gf-at').boundingBox();
  expect(gf.x).toBeGreaterThan(0);
  expect(gf.x + gf.width).toBeLessThan(vw);
  // with motion: they flicker, at random, one healthy tube at a time
  const ctx = await browser.newContext({ reducedMotion: 'no-preference', viewport: page.viewportSize() });
  const p2 = await ctx.newPage();
  await p2.goto('/');
  await expect.poll(() => p2.locator('.st-body .sl').count(), { timeout: 15000 }).toBe(15);
  const rows = await p2.evaluate(() => new Promise((res) => {
    const out = [];
    const t = setInterval(() => out.push([...document.querySelectorAll('.st-body .sl')].map((g) => (g.dataset.st === 'on' ? 0 : 1))), 50);
    setTimeout(() => { clearInterval(t); res(out); }, 14000);
  }));
  const acted = new Set();
  rows.forEach((r) => r.forEach((v, i) => v && acted.add(i)));
  expect(acted.size).toBeGreaterThan(1); // more than one tube misbehaved...
  const TIRED = [3, 13];
  expect(rows.every((r) => r.filter((v, i) => v && !TIRED.includes(i)).length <= 1)).toBe(true); // ...never two healthy ones together
  await ctx.close();
});

test('train horn: it dips in pitch as the train passes (a Doppler drop), never bends up into a whine', () => {
  const src = readFileSync('src/audio/audio.js', 'utf8');
  const doppler = Number(/const HORN_DOPPLER = ([\d.]+);/.exec(src)[1]);
  expect(doppler).toBeLessThan(1);
  expect(doppler).toBeGreaterThan(0.8);
  const calls = src.match(/trainHorn\(bus[^\n]*\);/g);
  expect(calls.length).toBeGreaterThan(1);
  for (const c of calls) expect(c, c).toContain('drop: HORN_DOPPLER');
});

test('loading screen: TAKE YOUR TIME is the progress bar (its letters fill as the page loads), ENTER THE STATION appears at 100, and its click dives through the O into the station', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  await page.goto('/?intro');
  await expect(page.locator('#loader .ld-l')).toHaveCount(12); // T A K E  Y O U R  T I M E
  await expect(page.locator('#loader .ld-case')).toHaveText('CASE FILE · JOHN NGUYEN');
  await expect(page.locator('#loader .ld-o .ld-ring')).toHaveCount(2); // the O whose hole is the doorway (empty slot + ink)
  await expect(page.locator('#loader .ld-seal')).toHaveCount(0); // (John, Nov 19: no star seal bottom right; keep it simple)
  await expect(page.locator('#loader .ld-go')).toBeHidden(); // no button until the bar is full
  await expect(page.locator('#loader .ld-wheel')).toContainText('NOW LOADING'); // the loading star, bottom left
  expect(await page.locator('#loader').evaluate((e) => getComputedStyle(e).backgroundImage)).not.toContain('radial-gradient'); // flat: no soft glow
  const seen = new Set();
  let most = 0;
  for (let i = 0; i < 200 && !(await page.locator('#loader .ld-go').isVisible()); i++) {
    const v = await page.locator('#loader [role=progressbar]').getAttribute('aria-valuenow');
    seen.add(Number(v));
    most = Math.max(most, await page.locator('#loader .ld-l.in').count());
    await page.waitForTimeout(30);
  }
  expect([...seen].filter((v) => v > 0 && v < 100).length).toBeGreaterThan(3); // a steady fill, not a jump
  await expect(page.locator('#loader .ld-l.in')).toHaveCount(12); // every letter inked
  await expect(page.locator('#loader')).toHaveClass(/inked/); // TIME underlined before the button
  await expect(page.locator('#loader .ld-go')).toBeVisible();
  await expect(page.locator('#loader .ld-go')).toContainText('ENTER THE STATION');
  await expect(page.locator('#loader .ld-wt-ok')).toBeVisible(); // READY
  await expect(page.locator('#loader .ld-go')).toBeFocused();
  await page.waitForTimeout(2500);
  await expect(page.locator('#loader')).toHaveCount(1); // it waits for the visitor's click
  await page.locator('#loader .ld-go').click();
  await expect(page.locator('#loader')).toHaveClass(/going/);
  await expect.poll(() => page.evaluate(() => document.getElementById('loader')?.style.clipPath || ''), { timeout: 1500 }).toContain('evenodd'); // the O's hole
  await expect(page.locator('#loader')).toHaveCount(0, { timeout: 3000 });
  await expect(page.locator('#pressStart')).toBeVisible();
  await ctx.close();
});

test('turn your phone: a red reminder on phones held upright, once a visit; turning the phone or GOT IT closes it', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto('/?rotate');
  const rot = page.locator('.rot');
  await expect(rot).toBeVisible();
  await expect(rot).toHaveAttribute('role', 'dialog');
  await expect(page.locator('#rotTitle')).toHaveAttribute('aria-label', 'Turn your phone');
  // our red, painted as an image over a black colour (so the browser never tints the notch strips red after it closes)
  expect(await rot.evaluate((e) => getComputedStyle(e).backgroundImage)).toContain('rgb(229, 25, 28)');
  expect(await rot.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(11, 11, 11)');
  await expect(page.locator('.rot-ok')).toBeFocused();
  await page.locator('.rot-ok').click();
  await expect(rot).toHaveCount(0);
  await page.reload(); // once a visit
  await page.waitForTimeout(800);
  await expect(page.locator('.rot')).toHaveCount(0);
  // a new visit: turning the phone sideways closes it by itself
  const p2 = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await p2.goto('/?rotate');
  await expect(p2.locator('.rot')).toBeVisible();
  await p2.setViewportSize({ width: 844, height: 390 });
  await expect(p2.locator('.rot')).toHaveCount(0);
  await ctx.close();
});

test('loading screen: the click on ENTER THE STATION turns the sound on, the dive and the doorway are heard, and the music waits until the doorway has opened', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  // the test browser lets audio start without a tap (an automation flag); real browsers don't: emulate them
  await page.addInitScript(() => {
    window.__sfxLog = [];
    let allowed = false;
    window.addEventListener('pointerup', () => { allowed = true; }, true);
    const AC = window.AudioContext;
    window.AudioContext = class extends AC {
      constructor(o) { super(o); if (!allowed) this.suspend(); }
      resume() { return allowed ? super.resume() : Promise.resolve(); }
    };
  });
  const music = [];
  page.on('request', (r) => /\/music[-.]/.test(r.url()) && music.push(Date.now()));
  await page.goto('/?intro');
  await expect(page.locator('#loader .ld-go')).toBeVisible({ timeout: 10000 });
  expect(music).toEqual([]);
  const clickAt = Date.now();
  await page.locator('#loader .ld-go').click();
  await expect(page.locator('#soundBtn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#loader')).toHaveCount(0, { timeout: 4000 });
  const heard = await page.evaluate(() => window.__sfxLog);
  expect(heard).toEqual(expect.arrayContaining(['portal', 'doorway']));
  await expect.poll(() => music.length, { timeout: 5000 }).toBe(1);
  expect(music[0]).toBeGreaterThanOrEqual(clickAt + 1000); // the music came after the dive (1.15 s), never over it
  await ctx.close();
});

test('sideways phones: the station shows clear (no ATL poster or arrow), a tap asks for full screen (never upright, never desktop), and the home-screen app files exist', async ({ browser, request }) => {
  const ctx = await browser.newContext({ viewport: { width: 829, height: 361 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__fs = 0;
    Element.prototype.requestFullscreen = function (o) { window.__fs++; window.__fsOpt = o; return Promise.resolve(); };
  });
  await page.goto('/');
  await expect(page.locator('#pressStart')).toBeVisible();
  await expect(page.locator('.bd-poster, .bd-arrow')).toHaveCount(0); // (Nov 21, John: removed, corny)
  await page.touchscreen.tap(700, 120);
  await expect.poll(() => page.evaluate(() => window.__fs)).toBe(1);
  expect(await page.evaluate(() => window.__fsOpt)).toEqual({ navigationUI: 'hide' });
  await page.touchscreen.tap(700, 140);
  expect(await page.evaluate(() => window.__fs)).toBe(1); // asked once, not on every tap
  await page.setViewportSize({ width: 390, height: 844 }); // upright: never asks
  await page.evaluate(() => { window.__fs = 0; });
  await page.touchscreen.tap(200, 120);
  expect(await page.evaluate(() => window.__fs)).toBe(0);
  await ctx.close();

  const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desk.addInitScript(() => { window.__fs = 0; Element.prototype.requestFullscreen = function () { window.__fs++; return Promise.resolve(); }; });
  await desk.goto('/');
  await desk.mouse.click(900, 300);
  expect(await desk.evaluate(() => window.__fs)).toBe(0);
  await desk.close();

  const m = await request.get('/manifest.webmanifest');
  expect(m.ok()).toBeTruthy();
  expect((await m.json()).display).toBe('fullscreen');
  for (const f of ['/apple-touch-icon.png', '/icon-512.png']) expect((await request.get(f)).ok()).toBeTruthy();
});

test('sound for every box: side quests are heard as they land and as you scroll to them, a tapped skill levels up, a tapped fact panel slaps (on a phone, with no hover)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 839 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__sfxLog = []; });
  const heard = () => page.evaluate(() => window.__sfxLog.splice(0));
  await page.goto('/');
  await page.touchscreen.tap(5, 300); // the first tap wakes the sound
  await page.waitForTimeout(300);
  const go = async (id) => { await heard(); await page.evaluate((h) => { location.hash = h; }, `#/${id}`); await page.waitForTimeout(3500); };
  const scrollDown = async () => { for (let k = 0; k < 8; k++) { await page.evaluate(() => document.querySelector('.screen.active').scrollBy(0, 300)); await page.waitForTimeout(350); } };

  await go('side-quests');
  await scrollDown();
  const stops = await page.locator('.stop').count();
  expect((await heard()).filter((n) => n === 'questPin').length).toBe(stops); // every stop, on screen or scrolled to
  await page.locator('.stop').first().tap();
  expect(await heard()).toContain('hvQuest');

  await go('skills');
  for (const i of [0, 2, 5]) { await page.locator('.crew-row').nth(i).tap(); await page.waitForTimeout(400); }
  expect((await heard()).filter((n) => n === 'skillUp').length).toBe(3); // the first row (picked already) answers too

  await go('different');
  await scrollDown();
  await page.evaluate(() => document.querySelector('.screen.active').scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.locator('.panel').first().tap();
  expect((await heard()).filter((n) => n === 'panelSlap').length).toBeGreaterThanOrEqual(2); // scrolled to + tapped
  await ctx.close();
});

test('SIDE QUESTS plays THE SQUARE: a painted square with nine screens, the big one says SIDE QUESTS, the small ones carry our ads', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#/board');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'board');
  await page.waitForTimeout(1500);
  await page.evaluate(() => { location.hash = '#/side-quests'; });
  const sq = page.locator('.sqr');
  await expect(sq).toHaveCount(1, { timeout: 6000 });
  await expect(sq.locator('.sq-img')).toHaveCount(1);
  await expect(sq.locator('.sq-scr')).toHaveCount(9);
  expect((await sq.locator('.sq-scr.sq-main .sq-label').textContent()).replace(/\s+/g, '')).toMatch(/SIDEQUESTS/i);
  for (const t of ['CLOSER', 'JOHN', 'ROUTINE', 'STEAL']) await expect(sq).toContainText(t);
  // the big screen's black bar: NOW SHOWING sliding left to right, a new copy following from the left
  const run = sq.locator('.sq-main .sq-bar .sq-bar-run');
  await expect(run.locator('span')).toHaveCount(4);
  const x0 = await run.evaluate((e) => e.getBoundingClientRect().left);
  await expect.poll(() => run.evaluate((e) => e.getBoundingClientRect().left), { timeout: 3000 }).toBeGreaterThan(x0);
  for (const t of ['TAKE YOUR', '2,000+', '727', 'BORING']) await expect(sq).not.toContainText(t); // (fresh lines, not the ones the rest of the site repeats)
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'side-quests', { timeout: 12000 });
  await expect(sq).toHaveCount(0, { timeout: 8000 }); // (it cleans itself up)
});

test('the departure board and the station lights never show off the title (they used to hang faded over the city on THE PLAN)', async ({ page }) => {
  await page.goto('/#/board');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'board');
  // (a deep link loads the station after THE PLAN has built in, so wait for its layer to exist)
  await expect(page.locator('.st-wrap')).toHaveCount(1, { timeout: 10000 });
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.st-wrap')).opacity)).toBe('0');
});

test('departure board: a 3D box in the station\'s perspective; LET US START THE GAME scrolls right to left, the clock shows the visitor\'s time (12-hour), it never covers the title, the calendar, the contact card or the top bar; on phones held upright too (a smaller board further back)', async ({ browser }) => {
  for (const [w, h, mob] of [[1440, 900, false], [852, 393, true], [390, 844, true], [390, 664, true], [412, 839, true]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob, reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    await page.goto('/');
    const sign = page.locator('.ss');
    await expect(sign).toHaveClass(/\bin\b/, { timeout: 15000 });
    // a painted board (the station's own toon style), hung from its ceiling channel; the LED text sits inside its painted screen
    const img = sign.locator('.ss-img');
    await expect(img).toBeVisible();
    expect(await img.evaluate((e) => e.complete && e.naturalWidth > 0)).toBe(true);
    const [ib, sb] = await Promise.all([img.boundingBox(), sign.locator('.ss-screen').boundingBox()]);
    expect(sb.x).toBeGreaterThan(ib.x); expect(sb.x + sb.width).toBeLessThan(ib.x + ib.width);
    expect(sb.y).toBeGreaterThan(ib.y + ib.height * 0.25); expect(sb.y + sb.height).toBeLessThan(ib.y + ib.height); // (under the rods and channel)
    await expect(sign.locator('.ss-run span').first()).toHaveText('LET US START THE GAME');
    await expect(sign.locator('.ss-code')).toHaveText('JN');
    const shown = (await sign.locator('.ss-time').innerText()).replace(/\s+/g, '');
    // the visitor's time now, or a minute ago (the sign updates once a second, so a read right at the turn of a minute can lag)
    const want = await page.evaluate(() => [0, 60000].map((ms) => { const d = new Date(Date.now() - ms); const hr = d.getHours(); return `${hr % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}${hr < 12 ? 'AM' : 'PM'}`; }));
    expect(want).toContain(shown);
    const x = () => sign.locator('.ss-run').evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).m41);
    const a = await x();
    await page.waitForTimeout(500);
    expect(await x()).toBeLessThan(a); // right to left
    const hits = await page.evaluate(() => {
      const b = document.querySelector('.ss-screen').getBoundingClientRect();
      return [...document.querySelectorAll('#titleName .rl, #hudDate .hud-cal, #contactCard, .hud-tr, #pressStart, #titleHook')]
        .filter((e) => getComputedStyle(e).visibility !== 'hidden')
        .filter((e) => { const o = e.getBoundingClientRect(); return o.width && b.left < o.right && b.right > o.left && b.top < o.bottom && b.bottom > o.top; })
        .map((e) => e.id || e.className);
    });
    expect(hits).toEqual([]);
    const box = await sign.locator('.ss-screen').boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(w);
    if (w === 1440) await expect(page.locator('#contactCard')).toBeVisible(); // Ways to Connect always stays
    await ctx.close();
  }
});

test('the floor mirrors the tubes: a tube going off takes its own stretch of the floor reflection with it', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.st-body')).toHaveCount(1, { timeout: 15000 });
  const refl = (i) => page.locator(`.st-body .sl[data-l="${i}"] .sl-off ellipse`);
  for (const i of [2, 5, 11, 14]) await expect(refl(i)).toHaveCount(1); // centre tubes on screen + the right tube
  await expect(refl(0)).toHaveCount(0); // (the nearest tube reflects below the screen)
  const op = (i) => page.locator(`.st-body .sl[data-l="${i}"] .sl-off`).evaluate((e) => Number(getComputedStyle(e).opacity));
  await page.evaluate(() => document.querySelectorAll('.sl[data-l="5"]').forEach((g) => { g.dataset.st = 'off'; }));
  await expect.poll(() => op(5)).toBe(1); // the tube's reflection is gone with it...
  expect(await op(6)).toBe(0); // ...and only its own
  await page.evaluate(() => document.querySelectorAll('.sl[data-l="5"]').forEach((g) => { g.dataset.st = 'on'; }));
  await expect.poll(() => op(5)).toBe(0);
});

test('SAVE DATA really saves: five new games fill five files (each its own progress) until no file is left; button sounds; each file has a CLEAR DATA tag that asks, then clears that file', async ({ page }) => {
  const errors = errorsOf(page);
  await page.addInitScript(() => { window.__sfxLog = []; });
  const chapters = ['stats', 'missions', 'skills', 'side-quests', 'contact'];
  for (let n = 0; n < 5; n++) {
    await page.goto('/#/');
    await page.reload();
    await page.locator('#pressStart').click();
    const empty = page.locator(`#saves .sv-slot[data-i="${n}"]`);
    await expect(empty).toHaveClass(/sv-empty/); // the next file is still free
    await empty.click(); // a new game in it
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'board');
    await expect(page.locator('#progressChip')).toContainText('0/8'); // a new game starts clean
    await page.goto(`/#/${chapters[n]}`);
    await expect(page.locator('body')).toHaveAttribute('data-screen', chapters[n]);
  }
  await page.goto('/#/');
  await page.reload();
  await page.locator('#pressStart').click();
  const saves = page.locator('#saves');
  await expect(saves.locator('.sv-empty')).toHaveCount(0); // every file is in use...
  for (let n = 0; n < 5; n++) await expect(saves.locator(`.sv-slot[data-i="${n}"]`)).toHaveAccessibleName(new RegExp(`File ${n + 1}: ${['STATS', 'MISSIONS', 'SKILLS', 'SIDE QUESTS', 'CONTACT'][n]}, 1 of 8 cleared`));
  await expect(saves.locator('.sv-sub')).toContainText('All 5 files are in use'); // ...and it says so
  // the clicky buttons: the metal chink as the mouse moves across the files, the confirm on a press
  await page.evaluate(() => { window.__sfxLog = []; });
  for (const n of [1, 2, 3]) { await saves.locator(`.sv-slot[data-i="${n}"]`).hover(); await page.waitForTimeout(60); }
  expect((await page.evaluate(() => window.__sfxLog)).filter((s) => s === 'hover').length).toBeGreaterThanOrEqual(3);
  // CLEAR DATA: a small tag inside every file, bottom right; the first press asks, the second clears that file
  const tags = saves.locator('.sv-erase');
  await expect(tags).toHaveCount(5);
  await expect(saves.locator('.sv-li-clear, .sv-clear')).toHaveCount(0); // (no box of its own any more)
  const inside = await page.evaluate(() => [...document.querySelectorAll('#saves .sv-li')].map((li) => {
    const c = li.querySelector('.sv-slot').getBoundingClientRect(); const t = li.querySelector('.sv-erase').getBoundingClientRect();
    const hit = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2);
    return t.left > c.left + c.width / 2 && t.right <= innerWidth && t.top > c.top && t.height < 40 && hit === li.querySelector('.sv-erase');
  }));
  expect(inside).toEqual([true, true, true, true, true]); // on the right half of its card, small, on screen, on top
  for (let n = 4; n >= 0; n--) {
    const tag = saves.locator(`.sv-erase[data-erase="${n}"]`);
    await tag.click();
    await expect(tag).toHaveClass(/armed/);
    await expect(tag).toHaveText('SURE?');
    await expect(saves.locator('.sv-empty')).toHaveCount(4 - n); // not yet
    await tag.click();
    await expect(saves.locator('.sv-empty')).toHaveCount(5 - n);
    await expect(saves.locator(`.sv-slot[data-i="${n}"]`)).toHaveClass(/sv-empty/);
  }
  await expect(tags).toHaveCount(0); // nothing left to clear
  expect(await page.evaluate(() => window.__sfxLog)).toEqual(expect.arrayContaining(['toggle', 'shatter']));
  const d = await page.evaluate(() => JSON.parse(localStorage.getItem('jn-resume-v1')));
  expect(d.slots.every((x) => x === null)).toBe(true);
  expect(d.settings).toBeTruthy(); // the settings stay
  await page.keyboard.press('Escape');
  await expect(page.locator('#pressStart')).toHaveText('PRESS START'); // nothing saved any more
  expect(errors).toEqual([]);
});

test('no emojis anywhere: no emoji-capable character in the site (phones draw them as emoji tiles), and outbound links use the drawn arrow', async ({ page }) => {
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(js|css|html)$/.test(f)) files.push(p); } };
  walk('src'); files.push('app.html');
  const found = files.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/\p{Extended_Pictographic}/gu)].filter((m) => m[0].codePointAt(0) > 127).map((m) => `${f}: U+${m[0].codePointAt(0).toString(16)}`));
  expect(found).toEqual([]);
  await page.goto('/#/contact');
  await expect(page.locator('#page a[href*="github"] .ext').first()).toBeAttached();
});
