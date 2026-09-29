import test from 'node:test'; import assert from 'node:assert/strict';
import { createTournament } from '../src/tournament/bracket.js';
import { ROUNDS } from '../src/rounds/index.js';
const stub = calls => (id, seed, diffs) => { calls.push(id); return { winner: 0, reason: 'stub' }; };
test('32 players, 5 rounds, human wins all -> champion', () => {
  const t = createTournament(1), calls = []; assert.equal(ROUNDS.length, 5); assert.equal(t.alive.length, 32);
  const sizes = [];
  while (!t.over) { sizes.push(t.alive.length); t.resolve(true, stub(calls)); }
  assert.deepEqual(sizes, [32, 16, 8, 4, 2]); assert.equal(t.champion.id, 0); assert.equal(calls.length, 15 + 7 + 3 + 1 + 0);
});
test('loss ends the human run', () => {
  const t = createTournament(1); t.resolve(true, stub([])); t.resolve(false, stub([]));
  assert.equal(t.over, true); assert.equal(t.champion, null); assert.throws(() => t.resolve(true, stub([])));
});
test('opponent difficulty ramps up', () => {
  const t = createTournament(1), d = []; while (!t.over) { d.push(t.opponent.difficulty); t.resolve(true, stub([])); }
  assert.deepEqual(d, ['easy', 'easy', 'medium', 'medium', 'hard']);
});
test('real off-screen simulation resolves round 1', () => {
  const t = createTournament(2); t.resolve(true); assert.equal(t.alive.length, 16); assert.equal(t.history[0].results.length, 16);
});
