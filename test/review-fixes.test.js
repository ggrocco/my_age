import test from 'node:test'; import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { canPlace } from '../src/sim/commands.js';
import { roundById } from '../src/rounds/index.js';
const tcOf = (g, p) => [...g.buildings.values()].find(b => b.owner === p && b.type === 'town_center');
const spot = (g, p, type) => { const t = tcOf(g, p); for (let r = 4; r < 14; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = t.x + dx, y = t.y + dy; if (canPlace(g, p, type, x, y)) return { x, y }; } };
const inside = (u, b) => u.x >= b.x && u.x <= b.x + b.size && u.y >= b.y && u.y <= b.y + b.size;

test('review#1: a building placed over units does not trap them', () => {
  const g = createGame({ seed: 1 }); g.players[0].res.wood = 5000; const sp = spot(g, 0, 'barracks');
  const v = g.spawnUnit('villager', 0, sp.x + 1.5, sp.y + 1.5), enemy = g.spawnUnit('clubman', 1, sp.x + 0.5, sp.y + 0.5);
  assert.equal(g.command(0, { type: 'build', ids: [v.id], building: 'barracks', x: sp.x, y: sp.y }).ok, true);
  const b = [...g.buildings.values()].find(x => x.type === 'barracks');
  assert.equal(inside(v, b), false, 'own unit moved out'); assert.equal(inside(enemy, b), false, 'enemy unit moved out');
  g.command(0, { type: 'move', ids: [v.id], x: v.x + 6, y: v.y }); const x0 = v.x;
  for (let i = 0; i < 400; i++) g.tick(); assert.ok(Math.abs(v.x - x0) > 1 || v.order.type === 'build', 'unit can still move');
});
test('review#2: relics dropped by a destroyed building land on a free tile and stay retrievable', () => {
  const g = createGame({ seed: 1, rules: roundById('relics') }); g.players[0].res.wood = 5000; const tc = tcOf(g, 0), r = [...g.relics.values()][0];
  r.stored = tc.id; r.holder = null;
  const below = { x: tc.x, y: tc.y + tc.size }; // the row the relic used to be dropped on
  g.addBuilding('house', 0, below.x, below.y, true); g.remove(tc);
  assert.equal(g.occAt(Math.floor(r.x), Math.floor(r.y)), 0, 'relic tile is free');
  const u = g.spawnUnit('villager', 0, r.x + 3, r.y + 3); g.command(0, { type: 'relic', ids: [u.id], relicId: r.id });
  for (let i = 0; i < 400; i++) g.tick(); assert.equal(r.holder, u.id, 'unit picked the relic up');
});
test('review#2b: cannot build on a loose relic', () => {
  const g = createGame({ seed: 1, rules: roundById('relics') }); const t = tcOf(g, 0), sp = spot(g, 0, 'house');
  const r = [...g.relics.values()][0]; r.x = sp.x + 0.5; r.y = sp.y + 0.5;
  assert.equal(canPlace(g, 0, 'house', sp.x, sp.y), false);
});
test('review#3: a side with no units and no unit-producing building is eliminated', () => {
  const g = createGame({ seed: 1, rules: roundById('conquest') });
  for (const e of [...g.units.values(), ...g.buildings.values()]) if (e.owner === 1) g.remove(e);
  g.addBuilding('house', 1, 60, 60, true); g.tick();
  assert.deepEqual([g.result?.winner, g.result?.reason], [0, 'conquest']);
});
test('review#3b: resign hands the win to the opponent', () => {
  const g = createGame({ seed: 1, rules: roundById('conquest') });
  assert.equal(g.command(0, { type: 'resign' }).ok, true); assert.deepEqual([g.result.winner, g.result.reason], [1, 'resigned']);
});
