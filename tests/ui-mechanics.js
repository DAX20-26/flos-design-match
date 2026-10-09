'use strict';
/*
 * Test UI deterministici: scenari costruiti ad hoc e giocati nel browser con il mouse.
 * Controllano che ciò che si vede (DOM) coincida sempre con lo stato del motore.
 * Uso: node tests/ui-mechanics.js
 */
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node-tools/node_modules/playwright'); }

const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
let failures = 0;
function check(cond, msg) { if (cond) console.log('  ok   ' + msg); else { failures++; console.log('  FAIL ' + msg); } }

const LABEL = { margherita: 'Margherita', tulipano: 'Tulipano', rosellina: 'Rosellina', campanula: 'Campanula lilla', bruco: 'Bruco verde', brucaliffo: 'Brucaliffo' };

/** Schema a "mattonelle" senza combinazioni né mosse possibili: (2r+c) mod 4. */
function deadlock() {
  const L = 'MTRC', rows = [];
  for (let r = 0; r < 8; r++) { let s = ''; for (let c = 0; c < 8; c++) s += L[(2 * r + c) % 4]; rows.push(s); }
  return rows;
}
function put(rows, edits) {
  const o = rows.map((r) => r.split(''));
  for (const [r, c, ch] of edits) o[r][c] = ch;
  return o.map((r) => r.join(''));
}

async function waitIdle(page) {
  await page.waitForFunction(() => !window.__flos.state.busy || !document.getElementById('modal').hidden, null, { timeout: 30000 });
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
/** Ogni elemento nel DOM deve essere nella posizione e del tipo indicati dal motore. */
async function domMatchesEngine(page) {
  return page.evaluate((LABEL) => {
    const g = window.__flos.state.game, els = [...document.querySelectorAll('#board .piece')];
    let ok = els.length === g.snapshot().length;
    const byId = {};
    g.snapshot().forEach((p) => { byId[p.id] = p; });
    for (const el of els) {
      const p = byId[el.dataset.id];
      if (!p) { ok = false; break; }
      if (Number(el.style.getPropertyValue('--r')) !== p.r || Number(el.style.getPropertyValue('--c')) !== p.c) { ok = false; break; }
      if (el.querySelector('svg').getAttribute('aria-label') !== LABEL[p.kind]) { ok = false; break; }
    }
    return ok;
  }, LABEL);
}
const hud = (page) => page.textContent('#moves');

(async () => {
  const browser = await playwright.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 900, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL + '?seed=3');
  await page.waitForTimeout(500);
  await page.click('#btn-play');
  await page.waitForSelector('#modal:not([hidden])');
  await page.click('#modal-btn');

  console.log('Due Brucaliffo vicini: lo scambio con un trascinamento fa esplodere la griglia');
  await page.evaluate((rows) => window.__flos.loadLayout(0, rows), put(deadlock(), [[3, 3, 'K'], [3, 4, 'K']]));
  check((await page.locator('#board .piece.k').count()) === 2, 'due Brucaliffo in griglia');
  check((await page.locator('.slot.full').count()) === 2, 'entrambe le caselle obiettivo sono piene');
  await drag(page, { r: 3, c: 3 }, { r: 3, c: 4 });
  await page.waitForTimeout(900);
  check((await page.locator('.shock').count()) >= 1, 'onda d\'urto dell\'esplosione visibile');
  check((await page.locator('.piece.blast').count()) > 20, 'gli elementi della griglia sbocciano e svaniscono');
  await page.waitForSelector('#modal:not([hidden])', { timeout: 10000 });
  check(/Livello 1 superato/.test(await page.textContent('#modal-kicker')), 'livello completato');
  check((await page.locator('#board .piece').count()) === 0, 'griglia svuotata');
  check((await hud(page)) === '21', 'la mossa dello scambio è stata conteggiata');
  await page.click('#modal-btn');
  await page.waitForSelector('#modal:not([hidden])');
  check(/Livello 2/.test(await page.textContent('#modal-kicker')), '"Livello successivo" porta al livello 2');
  check((await page.evaluate(() => window.__flos.state.level)) === 1, 'livello 2 attivo');
  await page.click('#modal-btn');
  check((await hud(page)) === '18', 'livello 2 con 18 mosse');

  console.log('Brucaliffo mai bloccato: lo spostamento libero attraversa tutta la griglia fino al secondo Brucaliffo');
  await page.evaluate((rows) => window.__flos.loadLayout(0, rows), put(deadlock(), [[0, 0, 'K'], [7, 7, 'K']]));
  let pos = { r: 0, c: 0 }, left = 22, allOk = true, consistent = true;
  const path1 = [];
  for (let c = 1; c <= 7; c++) path1.push({ r: 0, c });
  for (let r = 1; r <= 6; r++) path1.push({ r, c: 7 });
  for (const nxt of path1) {
    await drag(page, pos, nxt);
    await waitIdle(page);
    left -= 1;
    if ((await hud(page)) !== String(left)) allOk = false;
    if (!(await domMatchesEngine(page))) consistent = false;
    const isK = await page.evaluate(([r, c]) => window.__flos.state.game.grid[r][c].kind === 'brucaliffo', [nxt.r, nxt.c]);
    if (!isK) allOk = false;
    pos = nxt;
  }
  check(allOk, `13 spostamenti liberi consecutivi: ogni mossa costa 1 e il Brucaliffo arriva dove l'ho trascinato (restano ${left})`);
  check(consistent, 'dopo ogni spostamento il DOM coincide con lo stato del motore');
  await drag(page, pos, { r: 7, c: 7 });
  await page.waitForSelector('#modal:not([hidden])', { timeout: 10000 });
  check(/superato/.test(await page.textContent('#modal-kicker')), 'scambio finale dei due Brucaliffo: livello completato');
  check((await hud(page)) === String(left - 1), 'mosse residue corrette: ' + (left - 1));

  console.log('Anti-blocco: senza mosse disponibili il giardino si rimescola');
  await page.evaluate((rows) => {
    window.__flos.loadLayout(0, rows);
    const g = window.__flos.state.game;
    g.level = Object.assign({}, g.level, { slack: -99 }); // isola il rimescolamento dal rifornimento di bruchi
    const orig = g.tryMove;
    window.__steps = [];
    g.tryMove = function () { const r = orig.apply(this, arguments); window.__steps = (r.steps || []).map((st) => st.type); return r; };
  }, put(deadlock(), [[0, 0, 'K']]));
  await drag(page, { r: 0, c: 0 }, { r: 0, c: 1 });
  await page.waitForTimeout(600);
  const steps = await page.evaluate(() => window.__steps);
  check(steps.includes('shuffle'), 'il motore ha deciso il rimescolamento (passaggi: ' + steps.join(',') + ')');
  check(/rimescola/.test(await page.textContent('#toast')), 'avviso "il giardino si rimescola" mostrato');
  await waitIdle(page);
  await page.waitForTimeout(300);
  check(await domMatchesEngine(page), 'dopo il rimescolamento il DOM coincide con il motore');
  check(await page.evaluate(() => window.__flos.engine.hasMatchMove(window.__flos.state.game.grid)), 'dopo il rimescolamento esiste almeno una mossa');
  check((await page.locator('#board .piece').count()) === 64, 'sempre 64 elementi');
  check((await hud(page)) === '21', 'il rimescolamento non consuma mosse (solo la mossa giocata)');

  console.log('Completabilità: se i bruchi sono troppo pochi ne compaiono di nuovi');
  await page.evaluate((rows) => window.__flos.loadLayout(2, rows), put(deadlock(), [[3, 3, 'K'], [0, 0, 'B']]));
  const bruchiBefore = await page.evaluate(() => window.__flos.state.game.bruchiOnBoard());
  await drag(page, { r: 3, c: 3 }, { r: 3, c: 4 });
  await waitIdle(page);
  const bruchiAfter = await page.evaluate(() => window.__flos.state.game.bruchiOnBoard());
  check(bruchiAfter >= 3 && bruchiAfter > bruchiBefore, `bruchi in griglia ${bruchiBefore} → ${bruchiAfter} (ne servono almeno 3 per il secondo Brucaliffo)`);
  check(await domMatchesEngine(page), 'il DOM mostra i nuovi bruchi');
  check((await page.locator('#board svg[aria-label="Bruco verde"]').count()) === bruchiAfter, 'bruchi visibili = bruchi del motore');

  console.log('Sconfitta: ultima mossa senza obiettivo → si riparte dal livello 1');
  await page.evaluate(() => { window.__flos.state.level = 2; });
  await page.evaluate((rows) => window.__flos.loadLayout(2, rows), put(deadlock(), [[0, 0, 'K'], [7, 7, 'K']]));
  await page.evaluate(() => { window.__flos.state.game.movesLeft = 1; });
  await drag(page, { r: 0, c: 0 }, { r: 0, c: 1 });
  await page.waitForSelector('#modal:not([hidden])', { timeout: 10000 });
  check(/terminate/.test(await page.textContent('#modal-kicker')), 'messaggio "Mosse terminate"');
  check((await hud(page)) === '0', 'mosse a 0');
  check((await page.textContent('#modal-body')).includes('livello 1'), 'il messaggio spiega che si riparte dal livello 1');
  await page.click('#modal-btn');
  await page.waitForSelector('#modal:not([hidden])');
  check(/Livello 1 di 3/.test(await page.textContent('#modal-kicker')), 'dopo "Riprova" si torna al livello 1');
  await page.click('#modal-btn');
  check((await hud(page)) === '22', 'livello 1 con 22 mosse');
  check((await page.locator('.slot.full').count()) === 0, 'obiettivo azzerato');
  check(await domMatchesEngine(page), 'nuova griglia coerente');

  console.log('Tentativi illimitati: dopo molte sconfitte si può sempre riprovare');
  let again = true;
  for (let i = 0; i < 4 && again; i++) {
    await page.evaluate((rows) => window.__flos.loadLayout(0, rows), put(deadlock(), [[0, 0, 'K'], [7, 7, 'K']]));
    await page.evaluate(() => { window.__flos.state.game.movesLeft = 1; });
    await drag(page, { r: 0, c: 0 }, { r: 0, c: 1 });
    await page.waitForSelector('#modal:not([hidden])', { timeout: 10000 });
    again = /terminate/.test(await page.textContent('#modal-kicker'));
    await page.click('#modal-btn');
    await page.waitForSelector('#modal:not([hidden])');
    await page.click('#modal-btn');
  }
  check(again && (await hud(page)) === '22', '4 sconfitte consecutive, sempre possibile ricominciare');

  check(errors.length === 0, 'nessun errore JS' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(failures ? `\n${failures} controlli falliti` : '\nTutti i controlli sulle meccaniche UI superati');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
