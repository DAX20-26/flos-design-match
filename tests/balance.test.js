'use strict';
/* Bilanciamento: la difficoltà cresce e i livelli restano superabili. Deterministico (seed fissi). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('./simulate.js');

test('bilanciamento dei livelli (100 partite simulate per livello e per profilo)', { timeout: 300000 }, () => {
  const N = 100;
  process.argv[2] = String(N);
  const results = run('expert');
  const casual = run('casual');
  console.log('esperto :', results.map((r) => `L${r.level} ${Math.round(r.rate * 100)}% (${r.avg.toFixed(1)} mosse)`).join(' | '));
  console.log('distratto:', casual.map((r) => `L${r.level} ${Math.round(r.rate * 100)}% (${r.avg.toFixed(1)} mosse)`).join(' | '));
  // superabili: un buon giocatore vince quasi sempre
  assert.ok(results[0].rate >= 0.95, 'L1 esperto >= 95%');
  assert.ok(results[1].rate >= 0.85, 'L2 esperto >= 85%');
  assert.ok(results[2].rate >= 0.70, 'L3 esperto >= 70%');
  // impegnativi: il livello 3 non è banale nemmeno per il bot esperto
  assert.ok(results[2].rate <= 0.97, 'L3 non banale');
  // difficoltà crescente
  assert.ok(results[0].rate >= results[1].rate && results[1].rate >= results[2].rate, 'esperto: difficoltà crescente');
  assert.ok(casual[0].rate > casual[1].rate && casual[1].rate > casual[2].rate, 'distratto: difficoltà crescente');
  assert.ok(casual[2].rate >= 0.30, 'L3 superabile anche da un giocatore distratto (>=30%)');
  assert.ok(casual[0].rate >= 0.90, 'L1 accogliente (>=90%)');
  // le mosse medie usate crescono col livello
  assert.ok(results[2].avg > results[0].avg + 1.5, 'servono più mosse nei livelli alti');
});
