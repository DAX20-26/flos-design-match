'use strict';
/* Uso: node tests/simulate.js [partite_per_livello] */
const { playLevel } = require('./bot.js');
const N = parseInt(process.argv[2] || '150', 10);
function run(skill) {
  const out = [];
  for (let lv = 0; lv < 3; lv++) {
    let wins = 0, movesSum = 0;
    for (let i = 0; i < N; i++) {
      const r = playLevel(lv, 1000 * (lv + 1) + i, skill);
      if (r.won) { wins++; movesSum += r.moves; }
    }
    out.push({ level: lv + 1, wins, rate: wins / N, avg: movesSum / Math.max(wins, 1) });
  }
  return out;
}
if (require.main === module) {
  for (const skill of ['expert', 'casual']) {
    for (const o of run(skill)) {
      console.log(`${skill.padEnd(7)} Livello ${o.level}: vittorie ${o.wins}/${N} (${Math.round(100 * o.rate)}%), mosse medie nelle vittorie ${o.avg.toFixed(1)}`);
    }
  }
}
module.exports = { run };
