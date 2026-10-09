'use strict';
/*
 * Giocatori simulati.
 *  - expert: sceglie la mossa con la miglior valutazione dopo una simulazione (gioca "quasi" in modo ottimale)
 *  - casual: coglie le occasioni evidenti (crea un Brucaliffo, avvicina i Brucaliffo) ma per il resto
 *            gioca match qualsiasi, un po' a caso, come farebbe un giocatore distratto.
 */
const E = require('../js/engine.js');

function expertMove(game, samples) {
  const moves = E.listMoves(game.grid);
  if (!moves.length) return null;
  let best = null, bestScore = -Infinity;
  for (const m of moves) {
    let total = 0;
    for (let i = 0; i < samples; i++) {
      const g = game.clone();
      const res = g.tryMove(m.a, m.b);
      if (!res.ok) { total = -Infinity; break; }
      total += (g.status === 'won' ? 1e6 : E.potential(g.grid)) + (m.type === 'free' ? -15 : 0);
    }
    const score = total / samples + game.rng() * 4;
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

function casualMove(game) {
  const moves = E.listMoves(game.grid);
  if (!moves.length) return null;
  const rng = game.rng;
  const fin = moves.find((m) => m.type === 'finale');
  if (fin) return fin;
  // Obiettivo evidente: crea un Brucaliffo se esiste una mossa che lo fa.
  const makers = moves.filter((m) => {
    if (m.type !== 'match') return false;
    const g = game.clone(1);
    const before = g.created;
    return g.tryMove(m.a, m.b).ok && g.created > before;
  });
  if (makers.length) return makers[Math.floor(rng() * makers.length)];
  // Due Brucaliffo in gioco: li avvicina (un giocatore lo capisce subito).
  if (game.brucaliffiOnBoard() >= 2) {
    return expertMove(game, 1);
  }
  const matches = moves.filter((m) => m.type === 'match');
  if (!matches.length) return moves[Math.floor(rng() * moves.length)];
  // Metà delle volte sceglie a caso, l'altra metà preferisce mosse che toccano un bruco.
  const touching = matches.filter((m) => {
    const a = game.grid[m.a.r][m.a.c], b = game.grid[m.b.r][m.b.c];
    return a.kind === E.BRUCO || b.kind === E.BRUCO;
  });
  if (touching.length && rng() < 0.5) return touching[Math.floor(rng() * touching.length)];
  return matches[Math.floor(rng() * matches.length)];
}

function playLevel(levelIndex, seed, skill) {
  const game = new E.Game(levelIndex, E.mulberry32(seed));
  while (game.status === 'playing') {
    const m = skill === 'casual' ? casualMove(game) : expertMove(game, 2);
    if (!m) break;
    game.tryMove(m.a, m.b);
  }
  return { won: game.status === 'won', moves: game.moveCount, game };
}

module.exports = { expertMove, casualMove, playLevel };
