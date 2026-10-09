'use strict';
/*
 * Test end-to-end nel browser (Chromium via Playwright): apre index.html da file://,
 * gioca davvero con trascinamenti/tocchi, verifica HUD, griglia, livelli, sconfitta e schermata finale.
 * Uso: node tests/ui-smoke.js [cartella_screenshot]
 */
const path = require('path');
const fs = require('fs');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node-tools/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const SHOTS = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const URL = 'file://' + path.join(ROOT, 'index.html') + '?seed=' + (process.env.SEED || 21);

let failures = 0;
function check(cond, msg) { if (cond) console.log('  ok   ' + msg); else { failures++; console.log('  FAIL ' + msg); } }

async function shot(page, name) { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitIdle(page) {
  await page.waitForFunction(() => window.__flos && !window.__flos.state.busy || !document.getElementById('modal').hidden || document.getElementById('screen-final').classList.contains('active'), null, { timeout: 30000 });
}

async function drag(page, a, b) {
  const pa = await page.evaluate(([r, c]) => window.__flos.cellRect(r, c), [a.r, a.c]);
  const pb = await page.evaluate(([r, c]) => window.__flos.cellRect(r, c), [b.r, b.c]);
  await page.mouse.move(pa.x, pa.y);
  await page.mouse.down();
  await page.mouse.move((pa.x + pb.x) / 2, (pa.y + pb.y) / 2, { steps: 3 });
  await page.mouse.move(pb.x, pb.y, { steps: 3 });
  await page.mouse.up();
}
async function tap(page, a) {
  const p = await page.evaluate(([r, c]) => window.__flos.cellRect(r, c), [a.r, a.c]);
  await page.mouse.click(p.x, p.y);
}

(async () => {
  const browser = await playwright.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));

  console.log('Schermata iniziale');
  await page.goto(URL);
  await page.waitForTimeout(1500);
  check((await page.textContent('.title')).replace(/\s+/g, ' ').trim() === 'FLOS DESIGN MATCH', 'titolo FLOS DESIGN MATCH');
  check(await page.isVisible('#btn-play'), 'pulsante GIOCA visibile');
  check((await page.textContent('#btn-play')).trim() === 'GIOCA', 'etichetta GIOCA');
  await shot(page, '01-start');

  console.log('Introduzione livello 1');
  await page.click('#btn-play');
  await page.waitForSelector('#modal:not([hidden])');
  await page.waitForTimeout(600);
  await shot(page, '02-intro');
  await page.click('#modal-btn');
  await page.waitForTimeout(400);
  const st0 = await page.evaluate(() => ({ moves: window.__flos.state.game.movesLeft, pieces: document.querySelectorAll('.piece').length, lv: window.__flos.state.level }));
  check(st0.moves === 22 && st0.lv === 0, 'livello 1 con 22 mosse');
  check(st0.pieces === 64, 'griglia con 64 elementi');
  check((await page.textContent('#moves')) === '22', 'HUD mostra 22 mosse');
  await shot(page, '03-board');

  console.log('Mossa non valida: nessuna mossa consumata');
  const bad = await page.evaluate(() => {
    const E = window.__flos.engine, g = window.__flos.state.game;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 7; c++) {
      const a = { r, c }, b = { r, c: c + 1 };
      if (!E.swapMakesMatch(g.grid, a, b)) return { a, b };
    }
  });
  await drag(page, bad.a, bad.b);
  await page.waitForTimeout(900);
  await waitIdle(page);
  check((await page.textContent('#moves')) === '22', 'mosse ancora 22 dopo scambio non valido');
  check((await page.evaluate(() => window.__flos.state.game.movesLeft)) === 22, 'stato del motore invariato');

  console.log('Tocco su due caselle (tap-tap) con mossa valida');
  const good = await page.evaluate(() => {
    const g = window.__flos.state.game;
    return window.__flos.engine.listMoves(g.grid).find((m) => m.type === 'match');
  });
  await tap(page, good.a);
  await page.waitForTimeout(150);
  check((await page.locator('.piece.sel').count()) === 1, 'prima casella selezionata');
  await shot(page, '04-selected');
  await tap(page, good.b);
  await page.waitForTimeout(450);
  await shot(page, '05-matching');
  await waitIdle(page);
  check((await page.textContent('#moves')) === '21', 'mosse scalate a 21 dopo mossa valida');
  check((await page.locator('.piece').count()) === 64, 'griglia di nuovo piena (64) dopo la caduta');

  console.log('Partita completa con trascinamenti (anche ripartendo dopo eventuali sconfitte)');
  let moves = 0, losses = 0, wins = 0, shotsTaken = {};
  const t0 = Date.now();
  while (Date.now() - t0 < 240000) {
    if (await page.evaluate(() => document.getElementById('screen-final').classList.contains('active'))) break;
    await waitIdle(page);
    if (await page.evaluate(() => !document.getElementById('modal').hidden)) {
      const title = await page.textContent('#modal-title');
      const kicker = await page.textContent('#modal-kicker');
      if (/superato/.test(kicker)) { wins++; if (!shotsTaken.won) { await shot(page, '08-level-won'); shotsTaken.won = 1; } }
      if (/terminate/.test(kicker)) { losses++; await shot(page, '09-lost'); }
      await sleep(250);
      await page.click('#modal-btn');
      await page.waitForTimeout(250);
      continue;
    }
    const mv = await page.evaluate(() => {
      const g = window.__flos.state.game;
      const m = g.suggest();
      return m && { a: m.a, b: m.b, type: m.type, created: g.created, kinds: [g.grid[m.a.r][m.a.c].kind, g.grid[m.b.r][m.b.c].kind] };
    });
    if (!mv) break;
    const before = await page.evaluate(() => window.__flos.state.game.movesLeft);
    await drag(page, mv.a, mv.b);
    moves++;
    await page.waitForTimeout(120);
    if (!shotsTaken.k && mv.type === 'free') { await page.waitForTimeout(100); await shot(page, '06-brucaliffo-move'); shotsTaken.k = 1; }
    await waitIdle(page);
    const info = await page.evaluate(() => ({ g: window.__flos.state.game, left: window.__flos.state.game.movesLeft, n: document.querySelectorAll('.piece').length, hud: document.getElementById('moves').textContent, st: window.__flos.state.game.status, created: window.__flos.state.game.created }));
    if (info.st === 'playing') {
      if (info.n !== 64) { check(false, 'griglia a 64 elementi a riposo (trovati ' + info.n + ')'); break; }
      if (info.hud !== String(info.left)) { check(false, 'HUD coerente con il motore'); break; }
    }
    if (!shotsTaken.c && info.created >= 1 && info.st === 'playing') { await shot(page, '07-first-brucaliffo'); shotsTaken.c = 1; }
  }
  const final = await page.evaluate(() => document.getElementById('screen-final').classList.contains('active'));
  check(final, `schermata finale raggiunta (mosse giocate ${moves}, livelli superati ${wins}, sconfitte ${losses})`);
  check(wins >= 2, 'almeno i livelli 1 e 2 superati con esplosione');
  await page.waitForTimeout(3600);
  await shot(page, '10-final');
  const ft = (await page.textContent('#screen-final')).replace(/\s+/g, ' ');
  check(ft.includes('Hai fatto sbocciare Flos 🌸'), 'testo finale: titolo');
  check(ft.includes('Un piccolo abbraccio virtuale da Flos Design.'), 'testo finale: abbraccio');
  check(ft.includes('Grazie per far parte della nostra community.'), 'testo finale: grazie');
  check(ft.includes("Rigioca dall'inizio"), 'pulsante rigioca');

  console.log('Rigioca dall\'inizio');
  await page.click('#btn-replay');
  await page.waitForSelector('#modal:not([hidden])');
  check((await page.textContent('#modal-kicker')).includes('Livello 1'), 'si riparte dal livello 1');
  await page.click('#modal-btn');
  await page.waitForTimeout(300);
  check((await page.textContent('#moves')) === '22', 'di nuovo 22 mosse');

  console.log('Errori in console');
  check(errors.length === 0, 'nessun errore JS / richiesta fallita' + (errors.length ? ': ' + errors.join(' | ') : ''));

  // desktop
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dpage = await dctx.newPage();
  await dpage.goto(URL);
  await dpage.waitForTimeout(1300);
  await shot(dpage, '11-desktop-start');
  await dpage.click('#btn-play'); await dpage.waitForSelector('#modal:not([hidden])'); await dpage.click('#modal-btn');
  await dpage.waitForTimeout(500);
  await shot(dpage, '12-desktop-board');

  await browser.close();
  console.log(failures ? `\n${failures} controlli falliti` : '\nTutti i controlli UI superati');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
