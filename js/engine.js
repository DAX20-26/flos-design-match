/*
 * FLOS DESIGN MATCH — motore di gioco (logica pura, nessun accesso al DOM).
 * Funziona sia nel browser (window.FlosEngine) sia in Node (require) per i test.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FlosEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SIZE = 8;
  var FLOWERS = ['margherita', 'tulipano', 'rosellina', 'campanula'];
  var BRUCO = 'bruco';
  var BRUCALIFFO = 'brucaliffo';
  var VARIANTS = ['lilla', 'rosa', 'salvia', 'ambra'];
  var NEEDED = 2; // Brucaliffo da creare per livello

  /*
   * Difficoltà: la distribuzione dei bruchi diventa meno favorevole.
   *  - moves        mosse disponibili
   *  - brucoRate    probabilità che un nuovo elemento generato sia un bruco
   *  - startBruchi  bruchi presenti nella griglia iniziale
   *  - nearTriples  gruppi di 3 bruchi "a una mossa dal match" già presenti all'inizio
   *  - slack        bruchi extra garantiti sulla griglia oltre al minimo strettamente necessario
   */
  var LEVELS = [
    { moves: 22, brucoRate: 0.08, startBruchi: 8, nearTriples: 1, slack: 2 },
    { moves: 18, brucoRate: 0.06, startBruchi: 7, nearTriples: 0, slack: 1 },
    { moves: 16, brucoRate: 0.045, startBruchi: 6, nearTriples: 0, slack: 0 }
  ];

  /* ---------- utilità ---------- */

  function mulberry32(seed) {
    var a = seed >>> 0;
    var fn = function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    fn.seed = seed;
    return fn;
  }

  function inBounds(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }
  function isBrucaliffo(p) { return !!p && p.kind === BRUCALIFFO; }
  function matchable(p) { return !!p && p.kind !== BRUCALIFFO; }
  function adjacent(a, b) { return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1; }

  function emptyGrid() {
    var g = [];
    for (var r = 0; r < SIZE; r++) { g.push(new Array(SIZE).fill(null)); }
    return g;
  }

  /* ---------- individuazione delle combinazioni ---------- */

  /** Restituisce le combinazioni (gruppi) presenti: [{kind, cells:[{r,c}]}]. */
  function findMatches(grid) {
    var runs = [];
    var r, c, k, start, p, q;
    for (r = 0; r < SIZE; r++) {
      c = 0;
      while (c < SIZE) {
        p = grid[r][c];
        if (!matchable(p)) { c++; continue; }
        start = c;
        while (c + 1 < SIZE && matchable(grid[r][c + 1]) && grid[r][c + 1].kind === p.kind) c++;
        if (c - start + 1 >= 3) {
          var cells = [];
          for (k = start; k <= c; k++) cells.push({ r: r, c: k });
          runs.push({ kind: p.kind, cells: cells });
        }
        c++;
      }
    }
    for (c = 0; c < SIZE; c++) {
      r = 0;
      while (r < SIZE) {
        q = grid[r][c];
        if (!matchable(q)) { r++; continue; }
        start = r;
        while (r + 1 < SIZE && matchable(grid[r + 1][c]) && grid[r + 1][c].kind === q.kind) r++;
        if (r - start + 1 >= 3) {
          var cells2 = [];
          for (k = start; k <= r; k++) cells2.push({ r: k, c: c });
          runs.push({ kind: q.kind, cells: cells2 });
        }
        r++;
      }
    }
    // Unisce le linee che condividono almeno una casella (forme a L, T, +).
    var parent = runs.map(function (_, i) { return i; });
    function find(i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
    var owner = {};
    runs.forEach(function (run, i) {
      run.cells.forEach(function (cell) {
        var key = cell.r * SIZE + cell.c;
        if (owner[key] === undefined) owner[key] = i;
        else parent[find(i)] = find(owner[key]);
      });
    });
    var groups = {};
    runs.forEach(function (run, i) {
      var root = find(i);
      if (!groups[root]) groups[root] = { kind: run.kind, map: {} };
      run.cells.forEach(function (cell) { groups[root].map[cell.r * SIZE + cell.c] = cell; });
    });
    return Object.keys(groups).map(function (g) {
      var cells = Object.keys(groups[g].map).map(function (k) { return groups[g].map[k]; });
      cells.sort(function (a, b) { return a.r - b.r || a.c - b.c; });
      return { kind: groups[g].kind, cells: cells };
    });
  }

  /** Controllo locale: la casella (r,c) fa parte di un allineamento di almeno 3? */
  function matchAt(grid, r, c) {
    var p = grid[r][c];
    if (!matchable(p)) return false;
    var n = 1, i;
    for (i = c - 1; i >= 0 && matchable(grid[r][i]) && grid[r][i].kind === p.kind; i--) n++;
    for (i = c + 1; i < SIZE && matchable(grid[r][i]) && grid[r][i].kind === p.kind; i++) n++;
    if (n >= 3) return true;
    n = 1;
    for (i = r - 1; i >= 0 && matchable(grid[i][c]) && grid[i][c].kind === p.kind; i--) n++;
    for (i = r + 1; i < SIZE && matchable(grid[i][c]) && grid[i][c].kind === p.kind; i++) n++;
    return n >= 3;
  }

  function swapCells(grid, a, b) {
    var t = grid[a.r][a.c];
    grid[a.r][a.c] = grid[b.r][b.c];
    grid[b.r][b.c] = t;
  }

  /** Lo scambio produce una combinazione normale (senza considerare i Brucaliffo)? */
  function swapMakesMatch(grid, a, b) {
    if (isBrucaliffo(grid[a.r][a.c]) || isBrucaliffo(grid[b.r][b.c])) return false;
    swapCells(grid, a, b);
    var ok = matchAt(grid, a.r, a.c) || matchAt(grid, b.r, b.c);
    swapCells(grid, a, b);
    return ok;
  }

  /** Tutte le mosse valide. type: 'match' | 'free' (spostamento Brucaliffo) | 'finale'. */
  function listMoves(grid) {
    var moves = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var a = { r: r, c: c };
        var targets = [{ r: r, c: c + 1 }, { r: r + 1, c: c }];
        for (var t = 0; t < 2; t++) {
          var b = targets[t];
          if (!inBounds(b.r, b.c)) continue;
          var pa = grid[r][c], pb = grid[b.r][b.c];
          if (isBrucaliffo(pa) && isBrucaliffo(pb)) moves.push({ a: a, b: b, type: 'finale' });
          else if (isBrucaliffo(pa) || isBrucaliffo(pb)) moves.push({ a: a, b: b, type: 'free' });
          else if (swapMakesMatch(grid, a, b)) moves.push({ a: a, b: b, type: 'match' });
        }
      }
    }
    return moves;
  }

  function hasMatchMove(grid) {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var a = { r: r, c: c };
        if (c + 1 < SIZE && swapMakesMatch(grid, a, { r: r, c: c + 1 })) return true;
        if (r + 1 < SIZE && swapMakesMatch(grid, a, { r: r + 1, c: c })) return true;
      }
    }
    return false;
  }

  function countKind(grid, kind) {
    var n = 0;
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) if (grid[r][c] && grid[r][c].kind === kind) n++;
    return n;
  }

  /* ---------- euristica di potenziale (suggerimenti e bot dei test) ---------- */

  function manhattan(a, b) { return Math.abs(a.r - b.r) + Math.abs(a.c - b.c); }

  /** Più alto = partita messa meglio. */
  function potential(grid) {
    var brucs = [], bruca = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var p = grid[r][c];
        if (!p) continue;
        if (p.kind === BRUCO) brucs.push({ r: r, c: c });
        else if (p.kind === BRUCALIFFO) bruca.push({ r: r, c: c });
      }
    }
    var score = 0, i, j, k;
    if (bruca.length >= 2) {
      var best = 99;
      for (i = 0; i < bruca.length; i++) for (j = i + 1; j < bruca.length; j++) best = Math.min(best, manhattan(bruca[i], bruca[j]));
      return 2000 - best * 40;
    }
    score += bruca.length * 700;
    var span = 40;
    var bestTriple = null;
    for (i = 0; i < brucs.length; i++) {
      for (j = i + 1; j < brucs.length; j++) {
        for (k = j + 1; k < brucs.length; k++) {
          var s = manhattan(brucs[i], brucs[j]) + manhattan(brucs[j], brucs[k]) + manhattan(brucs[i], brucs[k]);
          if (s < span) { span = s; bestTriple = [brucs[i], brucs[j], brucs[k]]; }
        }
      }
    }
    score -= span * 10;
    if (bruca.length === 1 && bestTriple) {
      var cr = (bestTriple[0].r + bestTriple[1].r + bestTriple[2].r) / 3;
      var cc = (bestTriple[0].c + bestTriple[1].c + bestTriple[2].c) / 3;
      score -= (Math.abs(bruca[0].r - cr) + Math.abs(bruca[0].c - cc)) * 3;
    }
    return score;
  }

  /* ---------- partita ---------- */

  function Game(levelIndex, rng, layout) {
    this.levelIndex = levelIndex;
    this.level = LEVELS[levelIndex];
    this.rng = rng || mulberry32((Math.random() * 4294967296) >>> 0);
    this.nextId = 1;
    this.movesLeft = this.level.moves;
    this.moveCount = 0;
    this.created = 0;      // Brucaliffo creati finora
    this.variantCursor = Math.floor(this.rng() * VARIANTS.length);
    this.status = 'playing'; // playing | won | lost
    this.grid = layout ? this._fromLayout(layout) : this._generate();
  }

  Game.prototype._piece = function (kind, variant) {
    return { id: this.nextId++, kind: kind, variant: variant || null };
  };

  Game.prototype._randomFlower = function (exclude) {
    var pool = FLOWERS.filter(function (f) { return !exclude || exclude.indexOf(f) < 0; });
    return pool[Math.floor(this.rng() * pool.length)];
  };

  Game.prototype._randomKind = function () {
    if (this.rng() < this.level.brucoRate) return BRUCO;
    return FLOWERS[Math.floor(this.rng() * FLOWERS.length)];
  };

  Game.prototype._nextVariant = function (grid) {
    var used = {};
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) {
      var p = grid[r][c];
      if (p && p.kind === BRUCALIFFO) used[p.variant] = true;
    }
    for (var i = 0; i < VARIANTS.length; i++) {
      var v = VARIANTS[(this.variantCursor + i) % VARIANTS.length];
      if (!used[v]) { this.variantCursor = (this.variantCursor + i + 1) % VARIANTS.length; return v; }
    }
    return VARIANTS[this.variantCursor++ % VARIANTS.length];
  };

  /** Layout di test: righe di 8 caratteri. M T R C = fiori, B = bruco, K = Brucaliffo. */
  Game.prototype._fromLayout = function (rows) {
    var map = { M: 'margherita', T: 'tulipano', R: 'rosellina', C: 'campanula', B: BRUCO, K: BRUCALIFFO };
    var grid = emptyGrid();
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var kind = map[rows[r][c]];
        grid[r][c] = this._piece(kind, kind === BRUCALIFFO ? this._nextVariant(grid) : null);
        if (kind === BRUCALIFFO) this.created++;
      }
    }
    return grid;
  };

  /** Griglia iniziale: nessuna combinazione già fatta, almeno una mossa disponibile. */
  Game.prototype._generate = function () {
    var lv = this.level, rng = this.rng, self = this;
    for (var attempt = 0; attempt < 2000; attempt++) {
      var kinds = [];
      for (var r = 0; r < SIZE; r++) kinds.push(new Array(SIZE).fill(null));
      var bruchi = 0;

      // gruppi di bruchi a una sola mossa dal match: B B . / . . B  (in orientamenti casuali)
      for (var n = 0; n < lv.nearTriples; n++) {
        var base = [[0, 0], [0, 1], [1, 2]], partner = [0, 2];
        var transpose = rng() < 0.5, mirror = rng() < 0.5;
        var cells = base.concat([partner]).map(function (p) {
          var rr = p[0], cc = mirror ? 2 - p[1] : p[1];
          return transpose ? [cc, rr] : [rr, cc];
        });
        var h = transpose ? 3 : 2, w = transpose ? 2 : 3;
        var r0 = Math.floor(rng() * (SIZE - h + 1)), c0 = Math.floor(rng() * (SIZE - w + 1));
        var abs = cells.map(function (p) { return [p[0] + r0, p[1] + c0]; });
        var clash = abs.some(function (p, i) { return (i < 3 && kinds[p[0]][p[1]]) || (i === 3 && kinds[p[0]][p[1]] === BRUCO); });
        if (clash) continue;
        for (var i = 0; i < 3; i++) { kinds[abs[i][0]][abs[i][1]] = BRUCO; bruchi++; }
      }
      while (bruchi < lv.startBruchi) {
        var rr = Math.floor(rng() * SIZE), cc = Math.floor(rng() * SIZE);
        if (!kinds[rr][cc]) { kinds[rr][cc] = BRUCO; bruchi++; }
      }
      // riempie il resto con fiori evitando combinazioni iniziali
      for (var r1 = 0; r1 < SIZE; r1++) {
        for (var c1 = 0; c1 < SIZE; c1++) {
          if (kinds[r1][c1]) continue;
          var ex = [];
          if (c1 >= 2 && kinds[r1][c1 - 1] === kinds[r1][c1 - 2]) ex.push(kinds[r1][c1 - 1]);
          if (r1 >= 2 && kinds[r1 - 1][c1] === kinds[r1 - 2][c1]) ex.push(kinds[r1 - 1][c1]);
          kinds[r1][c1] = this._randomFlower(ex);
        }
      }
      var grid = emptyGrid();
      for (var r2 = 0; r2 < SIZE; r2++) for (var c2 = 0; c2 < SIZE; c2++) grid[r2][c2] = self._piece(kinds[r2][c2]);
      if (findMatches(grid).length === 0 && hasMatchMove(grid)) return grid;
    }
    throw new Error('Impossibile generare una griglia valida');
  };

  Game.prototype.bruchiOnBoard = function () { return countKind(this.grid, BRUCO); };
  Game.prototype.brucaliffiOnBoard = function () { return countKind(this.grid, BRUCALIFFO); };

  Game.prototype.snapshot = function () {
    var out = [];
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) {
      var p = this.grid[r][c];
      if (p) out.push({ id: p.id, kind: p.kind, variant: p.variant, r: r, c: c });
    }
    return out;
  };

  Game.prototype.clone = function (seed) {
    var g = Object.create(Game.prototype);
    g.levelIndex = this.levelIndex; g.level = this.level;
    g.rng = mulberry32(seed === undefined ? ((this.rng() * 4294967296) >>> 0) : seed);
    g.nextId = this.nextId; g.movesLeft = this.movesLeft; g.moveCount = this.moveCount;
    g.created = this.created; g.variantCursor = this.variantCursor; g.status = this.status;
    g.grid = this.grid.map(function (row) { return row.map(function (p) { return p && { id: p.id, kind: p.kind, variant: p.variant }; }); });
    return g;
  };

  /**
   * Tenta uno scambio. Restituisce:
   *  { ok:false, reason }                       se la mossa non è valida (nessuna mossa consumata)
   *  { ok:true, swap, steps, status, movesLeft } altrimenti; `steps` descrive animazioni e stato finale.
   */
  Game.prototype.tryMove = function (a, b) {
    if (this.status !== 'playing') return { ok: false, reason: 'finished' };
    if (!inBounds(a.r, a.c) || !inBounds(b.r, b.c)) return { ok: false, reason: 'bounds' };
    if (!adjacent(a, b)) return { ok: false, reason: 'not-adjacent' };
    var g = this.grid, pa = g[a.r][a.c], pb = g[b.r][b.c];
    if (!pa || !pb) return { ok: false, reason: 'empty' };

    var swap = { a: { r: a.r, c: a.c }, b: { r: b.r, c: b.c }, idA: pa.id, idB: pb.id };

    // Due Brucaliffo scambiati: esplosione finale.
    if (isBrucaliffo(pa) && isBrucaliffo(pb)) {
      this.movesLeft--; this.moveCount++;
      var ids = [];
      for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) if (g[r][c]) { ids.push(g[r][c].id); g[r][c] = null; }
      this.status = 'won';
      return {
        ok: true, swap: swap, status: 'won', movesLeft: this.movesLeft,
        steps: [{ type: 'explosion', origin: { r: (a.r + b.r) / 2, c: (a.c + b.c) / 2 }, clearIds: ids }]
      };
    }

    var free = isBrucaliffo(pa) || isBrucaliffo(pb);
    swapCells(g, a, b);
    if (!free && !matchAt(g, a.r, a.c) && !matchAt(g, b.r, b.c)) {
      swapCells(g, a, b);
      return { ok: false, reason: 'no-match' };
    }

    this.movesLeft--; this.moveCount++;
    var steps = [];
    this._resolve(steps, [a, b]);
    this._stabilise(steps);
    if (this.movesLeft <= 0) this.status = 'lost';
    return { ok: true, swap: swap, steps: steps, status: this.status, movesLeft: this.movesLeft };
  };

  /** Risolve a catena le combinazioni, con gravità e nuovi elementi. */
  Game.prototype._resolve = function (steps, swapped) {
    var g = this.grid, chain = 0, guard = 0;
    while (guard++ < 50) {
      var groups = findMatches(g);
      if (!groups.length) break;
      chain++;
      var clearIds = [], merges = [], spawns = [];
      var pivotHints = chain === 1 ? swapped : [];
      groups.forEach(function (grp) {
        grp.cells.forEach(function (cell) { clearIds.push(g[cell.r][cell.c].id); });
        if (grp.kind === BRUCO) {
          var pivot = null;
          pivotHints.forEach(function (s) {
            if (!pivot) grp.cells.forEach(function (cell) { if (cell.r === s.r && cell.c === s.c) pivot = cell; });
          });
          if (!pivot) pivot = grp.cells[Math.floor(grp.cells.length / 2)];
          merges.push({
            ids: grp.cells.map(function (cell) { return g[cell.r][cell.c].id; }),
            to: { r: pivot.r, c: pivot.c }
          });
          spawns.push({ pivot: pivot });
        }
      });
      groups.forEach(function (grp) { grp.cells.forEach(function (cell) { g[cell.r][cell.c] = null; }); });
      var created = [], spawnedIds = [];
      spawns.forEach(function (s) {
        var np = this._piece(BRUCALIFFO, this._nextVariant(g));
        g[s.pivot.r][s.pivot.c] = np;
        this.created++;
        created.push({ id: np.id, fromR: s.pivot.r, fromC: s.pivot.c });
        spawnedIds.push(np.id);
      }, this);
      // gravità + rifornimento
      for (var c = 0; c < SIZE; c++) {
        var col = [];
        for (var r = SIZE - 1; r >= 0; r--) if (g[r][c]) col.push(g[r][c]);
        var holes = SIZE - col.length;
        for (var r2 = SIZE - 1, i = 0; r2 >= 0; r2--, i++) {
          if (i < col.length) g[r2][c] = col[i];
          else {
            var kind = this._randomKind();
            var np2 = this._piece(kind);
            g[r2][c] = np2;
            created.push({ id: np2.id, fromR: r2 - holes, fromC: c });
          }
        }
      }
      steps.push({
        type: 'cascade', chain: chain, clearIds: clearIds, merges: merges,
        spawned: spawnedIds, created: created, board: this.snapshot()
      });
    }
  };

  /** Garantisce che il livello resti completabile e giocabile. */
  Game.prototype._stabilise = function (steps) {
    if (this.status === 'won') return;
    var g = this.grid;
    // 1) bruchi sufficienti per creare i Brucaliffo mancanti
    var onBoard = this.brucaliffiOnBoard();
    if (onBoard < NEEDED) {
      var floor = 3 * (NEEDED - onBoard) + this.level.slack;
      var have = this.bruchiOnBoard();
      if (have < floor) {
        var cands = [];
        for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) if (g[r][c] && FLOWERS.indexOf(g[r][c].kind) >= 0) cands.push({ r: r, c: c });
        for (var i = cands.length - 1; i > 0; i--) { var j = Math.floor(this.rng() * (i + 1)); var t = cands[i]; cands[i] = cands[j]; cands[j] = t; }
        var converted = [];
        for (var k = 0; k < cands.length && have < floor; k++) {
          var cell = cands[k], prev = g[cell.r][cell.c].kind;
          g[cell.r][cell.c].kind = BRUCO;
          var fine = findMatches(g).length === 0;
          if (fine) { have++; converted.push(g[cell.r][cell.c].id); }
          else g[cell.r][cell.c].kind = prev;
        }
        if (converted.length) steps.push({ type: 'sync', changed: converted, board: this.snapshot() });
      }
    }
    // 2) niente griglie senza mosse: rimescola (i Brucaliffo restano dove sono)
    if (this.brucaliffiOnBoard() < NEEDED && !hasMatchMove(g)) {
      this._shuffle();
      steps.push({ type: 'shuffle', board: this.snapshot() });
    }
  };

  Game.prototype._shuffle = function () {
    var g = this.grid, cells = [], pieces = [];
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) {
      if (g[r][c] && g[r][c].kind !== BRUCALIFFO) { cells.push({ r: r, c: c }); pieces.push(g[r][c]); }
    }
    for (var attempt = 0; attempt < 400; attempt++) {
      var order = pieces.slice();
      for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(this.rng() * (i + 1)); var t = order[i]; order[i] = order[j]; order[j] = t; }
      cells.forEach(function (cell, idx) { g[cell.r][cell.c] = order[idx]; });
      if (findMatches(g).length === 0 && hasMatchMove(g)) return;
    }
    // Ripiego: ridistribuisce i fiori in modo costruttivo, mantenendo i bruchi.
    for (var again = 0; again < 400; again++) {
      for (var r2 = 0; r2 < SIZE; r2++) {
        for (var c2 = 0; c2 < SIZE; c2++) {
          var p = g[r2][c2];
          if (!p || FLOWERS.indexOf(p.kind) < 0) continue;
          var ex = [];
          if (c2 >= 2 && g[r2][c2 - 1] && g[r2][c2 - 2] && g[r2][c2 - 1].kind === g[r2][c2 - 2].kind) ex.push(g[r2][c2 - 1].kind);
          if (r2 >= 2 && g[r2 - 1][c2] && g[r2 - 2][c2] && g[r2 - 1][c2].kind === g[r2 - 2][c2].kind) ex.push(g[r2 - 1][c2].kind);
          p.kind = this._randomFlower(ex);
        }
      }
      if (findMatches(g).length === 0 && hasMatchMove(g)) return;
    }
  };

  /**
   * Suggerimento: la mossa più promettente, valutata simulando ogni mossa su una copia
   * (il generatore casuale della partita vera non viene toccato).
   */
  Game.prototype.suggest = function (samples) {
    if (this.status !== 'playing') return null;
    samples = samples || 2;
    var moves = listMoves(this.grid), best = null, bestScore = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i], total = 0;
      for (var k = 0; k < samples; k++) {
        var g = this.clone(7001 + i * 31 + k);
        g.tryMove(m.a, m.b);
        total += (g.status === 'won' ? 1e6 : potential(g.grid)) + (m.type === 'free' ? -15 : 0);
      }
      var score = total / samples + hash01(i) * 4;
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return best;
  };

  function hash01(i) { var x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); }

  Game.fromLayout = function (levelIndex, rows, rng) { return new Game(levelIndex, rng || mulberry32(1), rows); };

  return {
    SIZE: SIZE, FLOWERS: FLOWERS, BRUCO: BRUCO, BRUCALIFFO: BRUCALIFFO, VARIANTS: VARIANTS,
    NEEDED: NEEDED, LEVELS: LEVELS, Game: Game, mulberry32: mulberry32,
    findMatches: findMatches, matchAt: matchAt, listMoves: listMoves, hasMatchMove: hasMatchMove,
    swapMakesMatch: swapMakesMatch, potential: potential, countKind: countKind
  };
});
