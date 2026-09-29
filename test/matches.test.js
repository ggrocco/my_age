import test from 'node:test'; import assert from 'node:assert/strict';
import { simulateMatch } from '../src/tournament/sim.js';
import { ROUNDS } from '../src/rounds/index.js';
// Every round must terminate with a valid winner, no invariant errors, and no command spam.
for (const r of ROUNDS) test(`bots finish ${r.id} on 3 seeds`, () => {
  for (const seed of [1, 2, 3]) {
    const m = simulateMatch(r.id, seed, ['medium', 'medium']);
    assert.equal(m.ended, true, `${r.id} seed ${seed} did not end`); assert.deepEqual(m.errors, [], `${r.id} seed ${seed}`);
    assert.ok([0, 1].includes(m.winner)); assert.ok(m.ticks <= m.cap + 50); assert.ok(m.maxRejects <= 20, 'reject spam ' + m.maxRejects);
  }
});
