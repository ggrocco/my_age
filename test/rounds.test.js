import test from 'node:test'; import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { ROUNDS, roundById } from '../src/rounds/index.js';
const G = id => createGame({ seed: 2, rules: roundById(id) });
const wipe = (g, p) => { for (const e of [...g.units.values(), ...g.buildings.values()]) if (e.owner === p) g.remove(e); };
test('conquest ends when a side is wiped out', () => {
  const g = G('conquest'); wipe(g, 1); g.tick(); assert.deepEqual([g.result.winner, g.result.reason], [0, 'conquest']);
});
test('both eliminated on the same tick still resolves', () => {
  const g = G('conquest'); wipe(g, 0); wipe(g, 1); g.tick(); assert.ok(g.result && [0, 1].includes(g.result.winner));
});
test('deathmatch setup grants 20000 each', () => {
  const g = G('deathmatch'); for (const p of g.players) for (const k of ['food', 'wood', 'gold', 'stone']) assert.equal(p.res[k], 20000);
});
test('regicide ends when the king dies', () => {
  const g = G('regicide'); g.damage(g.entities.get(g.roundState.kings[1]), 9999, g.units.get(1)); g.tick();
  assert.deepEqual([g.result.winner, g.result.reason], [0, 'regicide']);
});
test('wonder: hold 3 minutes wins; destroyed wonder resets countdown', () => {
  const g = G('wonder'); const w = g.addBuilding('wonder', 0, 30, 30, true);
  for (let i = 0; i < 1800; i++) g.tick(); assert.equal(g.result, null); g.remove(w); g.tick(); assert.equal(g.roundState.hold[0], 0);
  g.addBuilding('wonder', 0, 30, 30, true); for (let i = 0; i < 3700; i++) g.tick();
  assert.deepEqual([g.result.winner, g.result.reason], [0, 'wonder']);
});
test('relics: hold all 5 for 3 minutes wins; losing one resets', () => {
  const g = G('relics'); const tc = [...g.buildings.values()].find(b => b.owner === 0);
  for (const r of g.relics.values()) r.stored = tc.id;
  for (let i = 0; i < 1000; i++) g.tick(); assert.ok(g.roundState.hold[0] >= 999);
  const r = [...g.relics.values()][0]; r.stored = null; g.tick(); assert.equal(g.roundState.hold[0], 0);
  r.stored = tc.id; for (let i = 0; i < 3700; i++) g.tick(); assert.deepEqual([g.result.winner, g.result.reason], [0, 'relics']);
});
test('every round returns a winner at the cap', () => {
  for (const r of ROUNDS) { const g = createGame({ seed: 3, rules: r }); g.time = r.capTicks - 1; g.tick(); assert.ok(g.result && [0, 1].includes(g.result.winner), r.id); }
});
