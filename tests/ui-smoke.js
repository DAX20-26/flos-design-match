'use strict';
/*
 * Test end-to-end nel browser (Chromium via Playwright): apre index.html da file://,
 * gioca davvero con trascinamenti e tocchi, e verifica HUD, griglia, livelli, sconfitta e schermata finale.
 *
 * Uso: node tests/ui-smoke.js [cartella_screenshot]
 *   SEED=21 per cambiare il seme delle partite; il test è deterministico a parità di seme.
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function shot(page, name) { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); }

async function waitIdle(page) {
  await page.waitForFunction(() => {
    const f = window.__flos;
    return (f && !f.state.busy) || !document.getElementById('modal').hidden || document.getElementById('screen-final').classList.contains('active');
  }, null, { timeout: 30000 });
}

async function cellRect(page, c) { return page.evaluate(([r, cc]) => window.__flos.cellRect(r, cc), [c.r, c.c]); }

async function drag(page, a, b) {
  const pa = await cellRect(page, a), pb = await cellRect(page, b);
  await page.mouse.move(pa.x, pa.y);
  await page.mouse.down();
  await page.mouse.move((pa.x + pb.x) / 2, (pa.y + pb.y) / 2, { steps: 3 });
  await page.mouse.move(pb.x, pb.y, { steps: 3 });
  await page.mouse.up();
}
async function tap(page, a) {
  const p = await cellRect(page, a);
  await page.mouse.click(p.x, p.y);
}

/** Gioca una mossa suggerita; verifica coerenza HUD / griglia. Restituisce {status, type}. */
async function playOneMove(page, opts) {
  const mv = await page.evaluate(() => {
    const g = window.__flos.state.game;
    const m = g.suggest();
    return m && { a: m.a, b: m.b, type: m.type, created: g.created };
  });
  if (!mv) return null;
  const leftBefore = await page.evaluate(() => window.__flos.state.game.movesLeft);
  await drag(page, mv.a, mv.b);
  if (opts && opts.onAfterDrag) await opts.onAfterDrag(mv);
  await waitIdle(page);
  const info = await page.evaluate(() => {
    const g = window.__flos.state.game;
    return { left: g.movesLeft, status: g.status, n: document.querySelectorAll('.piece').length, hud: document.getElementById('moves').textContent, created: g.created, slots: document.querySelectorAll('.slot.full').length };
  });
  return { mv: mv, leftBefore: leftBefore, info: info };
}

(async () => {
  const browser = await playwright.chromium.launch();
  const errors = [];
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
  };

  /* ---------- Parte A: livello 1 con animazioni reali, su smartphone ---------- */
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  watch(page);

  console.log('Schermata iniziale');
  await page.goto(URL);
  await page.waitForTimeout(1600);
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
  const good = await page.evaluate(() => window.__flos.engine.listMoves(window.__flos.state.game.grid).find((m) => m.type === 'match'));
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

  console.log('Livello 1 fino al completamento (trascinamenti con animazioni reali)');
  const seen = {};
  let guard = 0, won1 = false, spent = 0;
  while (guard++ < 60) {
    if (await page.evaluate(() => !document.getElementById('modal').hidden)) break;
    const res = await playOneMove(page, {
      onAfterDrag: async (mv) => {
        if (mv.type === 'free' && !seen.free) { seen.free = 1; await page.waitForTimeout(110); await shot(page, '06-brucaliffo-move'); }
        if (mv.type === 'finale') { await page.waitForTimeout(1000); await shot(page, '07-explosion'); }
      }
    });
    if (!res) break;
    spent++;
    if (res.info.status === 'playing') {
      if (res.info.n !== 64) { check(false, 'griglia a 64 elementi a riposo (trovati ' + res.info.n + ')'); break; }
      if (res.info.hud !== String(res.info.left)) { check(false, 'HUD coerente con il motore'); break; }
      if (res.info.slots !== Math.min(res.info.created, 2)) { check(false, 'caselle obiettivo coerenti con i Brucaliffo creati'); break; }
      if (res.info.created >= 1 && !seen.k1) { seen.k1 = 1; await shot(page, '08-first-brucaliffo'); }
    }
    if (res.info.status === 'won') { won1 = true; break; }
    if (res.info.status === 'lost') break;
  }
  await page.waitForSelector('#modal:not([hidden])', { timeout: 15000 });
  await page.waitForTimeout(700);
  const kicker1 = await page.textContent('#modal-kicker');
  if (won1) {
    check(/Livello 1 superato/.test(kicker1), 'esplosione dei due Brucaliffo: livello 1 completato (' + spent + ' mosse)');
    check((await page.locator('#board .piece').count()) === 0, 'dopo l\'esplosione la griglia è vuota');
    await shot(page, '09-level-won');
  } else {
    check(false, 'livello 1 non completato con il seme di test (kicker: ' + kicker1 + ')');
    await shot(page, '09-level-1-not-won');
  }
  await page.close();
  await ctx.close();

  /* ---------- Parte B: partita completa fino alla schermata finale (movimento ridotto = più veloce) ---------- */
  console.log('Partita completa: tre livelli, anche con sconfitte e ripartenze dal livello 1');
  const fctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const fp = await fctx.newPage();
  watch(fp);
  await fp.goto(URL);
  await fp.click('#btn-play');
  let moves = 0, losses = 0, wins = 0, levelsSeen = new Set(), lostBackTo1 = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 420000) {
    await waitIdle(fp);
    if (await fp.evaluate(() => document.getElementById('screen-final').classList.contains('active'))) break;
    if (await fp.evaluate(() => !document.getElementById('modal').hidden)) {
      const kicker = await fp.textContent('#modal-kicker');
      if (/superato/.test(kicker)) wins++;
      if (/terminate/.test(kicker)) {
        losses++;
        if (losses === 1) await shot(fp, '10-lost');
        lostBackTo1 = (await fp.textContent('#modal-body')).includes('livello 1');
      }
      await fp.click('#modal-btn');
      await fp.waitForTimeout(80);
      if (/terminate/.test(kicker)) {
        const lv = await fp.evaluate(() => window.__flos.state.level);
        check(lv === 0, 'dopo la sconfitta si riparte dal livello 1');
      }
      continue;
    }
    levelsSeen.add(await fp.evaluate(() => window.__flos.state.level));
    const res = await playOneMove(fp);
    if (!res) break;
    moves++;
    if (res.info.status === 'playing' && (res.info.n !== 64 || res.info.hud !== String(res.info.left))) {
      check(false, 'incoerenza UI/motore a riposo: ' + JSON.stringify(res.info)); break;
    }
    if (res.info.status === 'playing') {
      // le mosse diminuiscono solo per azioni valide: esattamente di 1 per ogni mossa giocata
      if (res.leftBefore - res.info.left !== 1) { check(false, 'ogni mossa valida deve costare esattamente 1 (costo ' + (res.leftBefore - res.info.left) + ')'); break; }
    }
  }
  const final = await fp.evaluate(() => document.getElementById('screen-final').classList.contains('active'));
  check(final, `schermata finale raggiunta (mosse giocate ${moves}, livelli superati ${wins}, sconfitte ${losses})`);
  check(levelsSeen.has(0) && levelsSeen.has(1) && levelsSeen.has(2), 'tutti e tre i livelli giocati');
  check(wins >= 2, 'livelli 1 e 2 conclusi con l\'esplosione dei Brucaliffo');
  const ft = (await fp.textContent('#screen-final')).replace(/\s+/g, ' ');
  check(ft.includes('Hai fatto sbocciare Flos 🌸'), 'testo finale: titolo');
  check(ft.includes('Un piccolo abbraccio virtuale da Flos Design.'), 'testo finale: abbraccio');
  check(ft.includes('Grazie per far parte della nostra community.'), 'testo finale: grazie');
  check(ft.includes("Rigioca dall'inizio"), 'pulsante rigioca');
  if (losses) check(lostBackTo1 === true, 'il messaggio di sconfitta spiega la ripartenza dal livello 1');

  console.log('Rigioca dall\'inizio');
  await fp.click('#btn-replay');
  await fp.waitForSelector('#modal:not([hidden])');
  check((await fp.textContent('#modal-kicker')).includes('Livello 1'), 'si riparte dal livello 1');
  await fp.click('#modal-btn');
  await fp.waitForTimeout(300);
  check((await fp.textContent('#moves')) === '22', 'di nuovo 22 mosse');
  await fp.close();
  await fctx.close();

  /* ---------- Parte C: schermata finale con animazioni reali ---------- */
  console.log('Schermata finale (animazioni reali)');
  const c3 = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p3 = await c3.newPage();
  watch(p3);
  await p3.goto(URL);
  await p3.click('#btn-play');
  await p3.waitForSelector('#modal:not([hidden])');
  await p3.evaluate(() => window.__flos.showFinal());
  await p3.waitForTimeout(1500);
  await shot(p3, '11-final-a');
  await p3.waitForTimeout(2800);
  await shot(p3, '12-final-b');
  check(await p3.isVisible('#btn-replay'), 'pulsante rigioca visibile');
  await p3.close();
  await c3.close();

  /* ---------- Parte D: desktop con mouse ---------- */
  console.log('Desktop');
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dp = await dctx.newPage();
  watch(dp);
  await dp.goto(URL);
  await dp.waitForTimeout(1400);
  await shot(dp, '13-desktop-start');
  await dp.click('#btn-play');
  await dp.waitForSelector('#modal:not([hidden])');
  await dp.click('#modal-btn');
  await dp.waitForTimeout(500);
  await shot(dp, '14-desktop-board');
  const r = await dp.evaluate(() => { const b = document.getElementById('board').getBoundingClientRect(); return { w: b.width, h: b.height, top: b.top, bottom: b.bottom, vh: innerHeight }; });
  check(r.bottom <= r.vh && r.top >= 0, 'su desktop la griglia sta interamente nella finestra (' + Math.round(r.w) + 'px)');
  const dm = await dp.evaluate(() => window.__flos.engine.listMoves(window.__flos.state.game.grid).find((m) => m.type === 'match'));
  await drag(dp, dm.a, dm.b);
  await waitIdle(dp);
  check((await dp.textContent('#moves')) === '21', 'su desktop il trascinamento con il mouse funziona');

  console.log('Errori in console');
  check(errors.length === 0, 'nessun errore JS / richiesta fallita' + (errors.length ? ': ' + errors.join(' | ') : ''));

  await browser.close();
  console.log(failures ? `\n${failures} controlli falliti` : '\nTutti i controlli UI superati');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
