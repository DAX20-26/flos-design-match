'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/engine.js');
const { Game, SIZE, BRUCO, BRUCALIFFO, FLOWERS } = E;

const kinds = (g) => g.grid.map((row) => row.map((p) => p.kind));
const noNulls = (g) => g.grid.every((row) => row.every((p) => p !== null));

/* Layout di base senza combinazioni e senza mosse fortuite: schema a mattonelle di 4 fiori. */
function baseRows() {
  const pattern = ['MMTT', 'RRCC', 'TTMM', 'CCRR'];
  const rows = [];
  for (let r = 0; r < SIZE; r++) {
    let row = '';
    for (let c = 0; c < SIZE; c++) row += pattern[r % 4][(c + (r >> 2) * 0) % 4];
    rows.push(row);
  }
  return rows;
}
function withCells(rows, edits) {
  const out = rows.map((r) => r.split(''));
  for (const [r, c, ch] of edits) out[r][c] = ch;
  return out.map((r) => r.join(''));
}

test('griglia iniziale: 8x8, nessuna combinazione pronta, almeno una mossa, 5 tipi presenti', () => {
  for (let lv = 0; lv < 3; lv++) {
    for (let seed = 1; seed <= 200; seed++) {
      const g = new Game(lv, E.mulberry32(seed));
      assert.equal(g.grid.length, SIZE);
      assert.ok(g.grid.every((row) => row.length === SIZE));
      assert.ok(noNulls(g));
      assert.equal(E.findMatches(g.grid).length, 0, 'nessuna combinazione iniziale');
      assert.ok(E.hasMatchMove(g.grid), 'almeno una mossa disponibile');
      assert.equal(g.bruchiOnBoard(), E.LEVELS[lv].startBruchi);
      assert.equal(g.movesLeft, [22, 18, 16][lv]);
      const present = new Set(kinds(g).flat());
      FLOWERS.forEach((f) => assert.ok(present.has(f), `fiore ${f} presente`));
    }
  }
});

test('mosse per livello: 22 / 18 / 16', () => {
  assert.deepEqual(E.LEVELS.map((l) => l.moves), [22, 18, 16]);
});

test('layout di base non ha combinazioni', () => {
  assert.equal(E.findMatches(Game.fromLayout(0, baseRows()).grid).length, 0);
});

test('mossa non valida: nessuna mossa consumata e griglia invariata', () => {
  const g = Game.fromLayout(0, baseRows());
  const before = JSON.stringify(g.grid);
  const res = g.tryMove({ r: 0, c: 0 }, { r: 0, c: 1 });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'no-match');
  assert.equal(g.movesLeft, 22);
  assert.equal(JSON.stringify(g.grid), before);
  assert.equal(g.tryMove({ r: 0, c: 0 }, { r: 2, c: 2 }).ok, false); // non adiacenti
  assert.equal(g.movesLeft, 22);
});

test('combinazione di 3 fiori: elimina, cade, rifornisce, consuma una mossa', () => {
  // M M . / M sotto: spostando (1,2)->(0,2)... costruiamo un match orizzontale in riga 0
  const rows = withCells(baseRows(), [[0, 0, 'M'], [0, 1, 'M'], [0, 2, 'C'], [1, 2, 'M'], [1, 0, 'R'], [1, 1, 'R'], [0, 3, 'T']]);
  const g = Game.fromLayout(0, rows);
  assert.equal(E.findMatches(g.grid).length, 0);
  const res = g.tryMove({ r: 0, c: 2 }, { r: 1, c: 2 });
  assert.equal(res.ok, true);
  assert.equal(g.movesLeft, 21);
  assert.ok(res.steps.length >= 1);
  assert.equal(res.steps[0].type, 'cascade');
  assert.ok(res.steps[0].clearIds.length >= 3);
  assert.ok(noNulls(g));
  assert.equal(E.findMatches(g.grid).length, 0, 'stato finale stabile');
});

test('cascate: i nuovi elementi possono generare combinazioni a catena', () => {
  let cascades = 0, total = 0;
  for (let seed = 1; seed <= 300 && cascades < 5; seed++) {
    const g = new Game(0, E.mulberry32(seed));
    for (let i = 0; i < 12 && g.status === 'playing'; i++) {
      const m = E.listMoves(g.grid).find((x) => x.type === 'match');
      if (!m) break;
      const res = g.tryMove(m.a, m.b);
      total++;
      if (res.steps.filter((s) => s.type === 'cascade').length >= 2) cascades++;
    }
  }
  assert.ok(cascades >= 5, `cascate osservate: ${cascades}/${total}`);
});

test('tre bruchi: scompaiono e generano un Brucaliffo nella casella scambiata', () => {
  // B B . in riga 0 con il terzo bruco sotto la casella (0,2)
  const rows = withCells(baseRows(), [[0, 0, 'B'], [0, 1, 'B'], [0, 2, 'C'], [1, 2, 'B']]);
  const g = Game.fromLayout(1, rows);
  assert.equal(E.findMatches(g.grid).length, 0);
  const res = g.tryMove({ r: 0, c: 2 }, { r: 1, c: 2 });
  assert.equal(res.ok, true);
  const s = res.steps[0];
  assert.equal(s.merges.length, 1);
  assert.equal(s.merges[0].ids.length, 3);
  assert.deepEqual(s.merges[0].to, { r: 0, c: 2 }, 'nasce nella casella dello scambio');
  assert.equal(s.spawned.length, 1);
  assert.equal(g.created, 1);
  assert.equal(g.brucaliffiOnBoard(), 1);
});

test('4 o 5 bruchi in linea: un solo Brucaliffo', () => {
  const rows = withCells(baseRows(), [[0, 0, 'B'], [0, 1, 'B'], [0, 2, 'B'], [0, 3, 'C'], [0, 4, 'B'], [1, 3, 'B']]);
  const g = Game.fromLayout(0, rows);
  const res = g.tryMove({ r: 0, c: 3 }, { r: 1, c: 3 });
  assert.equal(res.ok, true);
  assert.equal(res.steps[0].spawned.length, 1);
  assert.equal(res.steps[0].merges[0].ids.length, 5);
});

test('il Brucaliffo non partecipa alle combinazioni normali', () => {
  const rows = withCells(baseRows(), [[0, 0, 'K'], [0, 1, 'K'], [0, 2, 'K']]);
  const g = Game.fromLayout(0, rows);
  assert.equal(E.findMatches(g.grid).length, 0);
});

test('il Brucaliffo si può spostare anche senza combinazione, consumando una mossa', () => {
  const rows = withCells(baseRows(), [[3, 3, 'K']]);
  const g = Game.fromLayout(0, rows);
  const id = g.grid[3][3].id;
  const res = g.tryMove({ r: 3, c: 3 }, { r: 3, c: 4 });
  assert.equal(res.ok, true, 'spostamento libero consentito');
  assert.equal(g.movesLeft, 21);
  // dopo lo spostamento (e eventuali cascate) il Brucaliffo esiste ancora
  assert.equal(g.brucaliffiOnBoard(), 1);
  assert.ok(g.snapshot().some((p) => p.id === id && p.kind === BRUCALIFFO));
});

test('scambio di due Brucaliffo: esplosione, griglia svuotata, livello completato', () => {
  const rows = withCells(baseRows(), [[2, 2, 'K'], [2, 3, 'K']]);
  const g = Game.fromLayout(2, rows);
  const res = g.tryMove({ r: 2, c: 2 }, { r: 2, c: 3 });
  assert.equal(res.ok, true);
  assert.equal(res.status, 'won');
  assert.equal(g.status, 'won');
  assert.equal(res.steps[0].type, 'explosion');
  assert.equal(res.steps[0].clearIds.length, 64);
  assert.ok(g.grid.every((row) => row.every((p) => p === null)));
  assert.equal(g.movesLeft, 15);
});

test('vittoria con l\'ultima mossa ha la precedenza sulla sconfitta', () => {
  const rows = withCells(baseRows(), [[2, 2, 'K'], [2, 3, 'K']]);
  const g = Game.fromLayout(2, rows);
  g.movesLeft = 1;
  const res = g.tryMove({ r: 2, c: 2 }, { r: 2, c: 3 });
  assert.equal(res.status, 'won');
});

test('mosse esaurite senza obiettivo: sconfitta; nessuna mossa dopo la fine', () => {
  const g = new Game(2, E.mulberry32(5));
  g.movesLeft = 1;
  const m = E.listMoves(g.grid).find((x) => x.type === 'match');
  const res = g.tryMove(m.a, m.b);
  assert.equal(res.status, 'lost');
  assert.equal(g.movesLeft, 0);
  assert.equal(g.tryMove(m.a, m.b).ok, false);
});

function deadlockRows() {
  const L = 'MTRC', rows = [];
  for (let r = 0; r < SIZE; r++) { let s = ''; for (let c = 0; c < SIZE; c++) s += L[(2 * r + c) % 4]; rows.push(s); }
  return rows;
}

test('anti-blocco: una griglia senza alcuna mossa viene rimescolata e torna giocabile', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const g = Game.fromLayout(0, deadlockRows(), E.mulberry32(seed));
    g.level = Object.assign({}, g.level, { slack: -99 }); // isola il rimescolamento dal rifornimento di bruchi
    assert.equal(E.findMatches(g.grid).length, 0);
    assert.equal(E.hasMatchMove(g.grid), false, 'punto di partenza davvero bloccato');
    const ids = g.snapshot().map((p) => p.id).sort((x, y) => x - y);
    const steps = [];
    g._stabilise(steps);
    assert.ok(steps.some((s) => s.type === 'shuffle'), 'rimescolamento avvenuto');
    assert.equal(E.findMatches(g.grid).length, 0, 'nessuna combinazione gratuita dopo il rimescolamento');
    assert.ok(E.hasMatchMove(g.grid), 'dopo il rimescolamento esiste una mossa');
    assert.deepEqual(g.snapshot().map((p) => p.id).sort((x, y) => x - y), ids, 'stessi elementi, solo riposizionati');
  }
});

test('anti-blocco: con due Brucaliffo in gioco non serve rimescolare (si spostano liberamente)', () => {
  const g = Game.fromLayout(0, withCells(deadlockRows(), [[0, 0, 'K'], [7, 7, 'K']]));
  const steps = [];
  g._stabilise(steps);
  assert.ok(!steps.some((s) => s.type === 'shuffle'));
  assert.ok(E.listMoves(g.grid).some((m) => m.type === 'free'));
});

test('completabilità: se i bruchi sono troppo pochi ne vengono aggiunti (senza creare combinazioni)', () => {
  const g = Game.fromLayout(2, withCells(baseRows(), [[0, 0, 'B'], [4, 4, 'B']]));
  assert.equal(g.bruchiOnBoard(), 2);
  const steps = [];
  g._stabilise(steps);
  assert.ok(g.bruchiOnBoard() >= 6, `bruchi dopo il rifornimento: ${g.bruchiOnBoard()}`);
  assert.equal(E.findMatches(g.grid).length, 0);
  assert.ok(steps.some((s) => s.type === 'sync'));
  // con un Brucaliffo già creato ne servono almeno 3
  const h = Game.fromLayout(2, withCells(baseRows(), [[0, 0, 'K'], [4, 4, 'B']]));
  h._stabilise([]);
  assert.ok(h.bruchiOnBoard() >= 3);
});

test('fuzz: 600 partite casuali mantengono sempre gli invarianti di gioco', () => {
  let shuffles = 0, topups = 0;
  for (let n = 0; n < 600; n++) {
    const lv = n % 3;
    const g = new Game(lv, E.mulberry32(9000 + n));
    let guard = 0;
    while (g.status === 'playing' && guard++ < 60) {
      const moves = E.listMoves(g.grid);
      assert.ok(moves.length > 0, 'esiste sempre almeno una mossa valida');
      const m = moves[Math.floor(g.rng() * moves.length)];
      const before = g.movesLeft;
      const res = g.tryMove(m.a, m.b);
      assert.equal(res.ok, true);
      assert.equal(g.movesLeft, before - 1, 'ogni mossa valida costa esattamente una mossa');
      res.steps.forEach((s) => { if (s.type === 'shuffle') shuffles++; if (s.type === 'sync') topups++; });
      if (g.status === 'won') break;
      assert.ok(noNulls(g), 'nessuna casella vuota');
      assert.equal(E.findMatches(g.grid).length, 0, 'griglia stabile');
      const onBoard = g.brucaliffiOnBoard();
      assert.ok(g.bruchiOnBoard() + 3 * onBoard >= 6, 'completamento sempre matematicamente possibile');
      if (onBoard < 2) assert.ok(E.hasMatchMove(g.grid), 'mai griglie senza mosse');
    }
  }
  assert.ok(topups >= 0 && shuffles >= 0);
});

test('suggerimento: restituisce sempre una mossa valida', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const g = new Game(seed % 3, E.mulberry32(seed));
    const h = g.suggest();
    assert.ok(h);
    const c = g.clone(1);
    assert.equal(c.tryMove(h.a, h.b).ok, true);
  }
});
