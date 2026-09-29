// Usage: node test/bot-sim.js [seeds=5] [difficulties like medium,medium]
import { simulateMatch } from '../src/tournament/sim.js';
import { ROUNDS } from '../src/rounds/index.js';
const seeds = +(process.argv[2] || 5), diffs = (process.argv[3] || 'medium,medium').split(',');
let bad = 0;
for (const r of ROUNDS) {
  const rows = [];
  for (let s = 1; s <= seeds; s++) {
    const t0 = Date.now(), m = simulateMatch(r.id, s, diffs);
    const ok = m.ended && !m.errors.length && m.ticks <= m.cap + 50 && m.maxRejects <= 20; if (!ok) bad++;
    rows.push({ seed: s, ok, winner: m.winner, reason: m.reason, ticks: m.ticks, ms: Date.now() - t0, rej: m.maxRejects, err: m.errors[0] });
  }
  const tally = {}; for (const w of rows) tally[w.reason] = (tally[w.reason] || 0) + 1; const wins = [0, 1].map(i => rows.filter(w => w.winner === i).length);
  console.log(`${r.id.padEnd(11)} cap ${r.capTicks}  n=${rows.length}  reasons=${JSON.stringify(tally)}  p0/p1 wins=${wins}  median ticks=${rows.map(w => w.ticks).sort((a, b) => a - b)[rows.length >> 1]}  max rej=${Math.max(...rows.map(w => w.rej))}`);
  for (const w of rows) if (!w.ok) console.log('   FAIL', JSON.stringify(w));
}
console.log(bad ? `FAILURES: ${bad}` : 'ALL MATCHES ENDED CLEANLY'); process.exit(bad ? 1 : 0);
