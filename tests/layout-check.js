'use strict';
/*
 * Verifica il layout su molte dimensioni di schermo (nessuna partita): niente scroll orizzontale,
 * elementi principali dentro lo schermo, griglia abbastanza grande da distinguere i fiori.
 * Uso: node tests/layout-check.js [cartella_screenshot]
 */
const path = require('path');
const fs = require('fs');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node-tools/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const SHOTS = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const URL = 'file://' + path.join(ROOT, 'index.html') + '?seed=5';

const VIEWPORTS = [
  { name: 'se-320x568', w: 320, h: 568, mobile: true, minBoard: 280 },
  { name: 'android-360x640', w: 360, h: 640, mobile: true, minBoard: 300 },
  { name: 'iphone-390x844', w: 390, h: 844, mobile: true, minBoard: 340 },
  { name: 'pixel-412x915', w: 412, h: 915, mobile: true, minBoard: 360 },
  { name: 'land-667x375', w: 667, h: 375, mobile: true, minBoard: 300 },
  { name: 'land-844x390', w: 844, h: 390, mobile: true, minBoard: 320 },
  { name: 'tablet-768x1024', w: 768, h: 1024, mobile: true, minBoard: 560 },
  { name: 'desktop-1280x800', w: 1280, h: 800, mobile: false, minBoard: 470 },
  { name: 'desktop-1920x1080', w: 1920, h: 1080, mobile: false, minBoard: 600 }
];

let failures = 0;
function check(cond, msg) { if (cond) console.log('  ok   ' + msg); else { failures++; console.log('  FAIL ' + msg); } }

(async () => {
  const browser = await playwright.chromium.launch();
  for (const v of VIEWPORTS) {
    console.log(v.name);
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1, hasTouch: v.mobile, isMobile: v.mobile });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await page.waitForTimeout(1400);
    const inView = (sel) => page.evaluate((s) => {
      const el = document.querySelector(s); if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5;
    }, sel);
    const noHScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1);

    // schermata iniziale
    check(await noHScroll(), 'start: nessuno scroll orizzontale');
    check(await inView('.title-brand'), 'start: nome FLOS DESIGN dentro lo schermo');
    check(await inView('#btn-play'), 'start: pulsante GIOCA dentro lo schermo');
    check(await inView('.hero'), 'start: gioiello dentro lo schermo');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, v.name + '-1start.png') });

    // finestra introduttiva
    await page.click('#btn-play');
    await page.waitForSelector('#modal:not([hidden])');
    await page.waitForTimeout(700);
    check(await inView('#modal-btn'), 'intro: pulsante Inizia raggiungibile senza scorrere');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, v.name + '-2intro.png') });
    await page.click('#modal-btn');
    await page.waitForTimeout(500);

    // gioco
    check(await noHScroll(), 'gioco: nessuno scroll orizzontale');
    check(await inView('#board'), 'gioco: griglia interamente visibile');
    check(await inView('.hud'), 'gioco: pannello mosse/obiettivo visibile');
    check(await inView('.topbar'), 'gioco: barra superiore visibile');
    const bw = await page.evaluate(() => document.getElementById('board').getBoundingClientRect().width);
    check(bw >= v.minBoard, `gioco: griglia ${Math.round(bw)}px (>= ${v.minBoard}px, cella ${Math.round(bw / 8)}px)`);
    const squares = await page.evaluate(() => { const r = document.getElementById('board').getBoundingClientRect(); return Math.abs(r.width - r.height) < 1; });
    check(squares, 'gioco: griglia quadrata');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, v.name + '-3game.png') });

    // finale
    await page.evaluate(() => window.__flos.showFinal());
    await page.waitForTimeout(3600);
    check(await noHScroll(), 'finale: nessuno scroll orizzontale');
    check(await inView('#btn-replay'), 'finale: pulsante rigioca dentro lo schermo');
    check(await inView('.final-title'), 'finale: titolo dentro lo schermo');
    check(await inView('.final-logo'), 'finale: logo FLOS DESIGN dentro lo schermo');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, v.name + '-4final.png') });
    check(errors.length === 0, 'nessun errore JS' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await ctx.close();
  }
  await browser.close();
  console.log(failures ? `\n${failures} controlli falliti` : '\nLayout verificato su tutte le dimensioni');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
