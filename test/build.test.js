import test from 'node:test'; import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { canPlace } from '../src/sim/commands.js';
const freeSpot = (g, p, type, skip = []) => { const t = tc(g, p); for (let r = 3; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = Math.floor(t.x) + dx, y = Math.floor(t.y) + dy; if (skip.some(k => Math.abs(k.x - x) < 4 && Math.abs(k.y - y) < 4)) continue; if (canPlace(g, p, type, x, y)) return { x, y }; } };
const mine = (g, p, type) => [...g.units.values()].filter(u => u.owner === p && u.type === type);
const tc = (g, p) => [...g.buildings.values()].find(b => b.owner === p && b.type === 'town_center');
const spot = (g, p) => { const t = tc(g, p); return { x: Math.floor(t.x) - 4, y: Math.floor(t.y) }; };
test('build deducts cost and constructs over time', () => {
  const g = createGame({ seed: 1 }); const v = mine(g, 0, 'villager')[0], w = g.players[0].res.wood, s = spot(g, 0);
  const r = g.command(0, { type: 'build', ids: [v.id], building: 'house', x: s.x, y: s.y }); assert.equal(r.ok, true, r.reason);
  assert.equal(g.players[0].res.wood, w - 30);
  const b = [...g.buildings.values()].find(b => b.type === 'house' && b.owner === 0); assert.equal(b.constructed, false);
  for (let i = 0; i < 800; i++) g.tick();
  assert.equal(b.constructed, true); assert.equal(g.players[0].popCap, 14);
});
test('bad placement rejected, nothing spent', () => {
  const g = createGame({ seed: 1 }); const v = mine(g, 0, 'villager')[0], before = { ...g.players[0].res }, t = tc(g, 0);
  for (const [x, y] of [[t.x, t.y], [-3, 5], [g.map.size, 5]]) {
    const r = g.command(0, { type: 'build', ids: [v.id], building: 'house', x, y }); assert.equal(r.ok, false);
  }
  assert.deepEqual(g.players[0].res, before);
});
test('placement in unexplored area rejected', () => {
  const g = createGame({ seed: 1 }); const v = mine(g, 0, 'villager')[0];
  const r = g.command(0, { type: 'build', ids: [v.id], building: 'house', x: g.map.size - 8, y: g.map.size - 8 });
  assert.equal(r.ok, false);
});
test('train: rejected without resources or at pop cap; works otherwise', () => {
  const g = createGame({ seed: 1 }); const t = tc(g, 0), p = g.players[0];
  p.res.food = 10; let r = g.command(0, { type: 'train', buildingId: t.id, unit: 'villager' }); assert.equal(r.ok, false); assert.equal(p.res.food, 10);
  p.res.food = 5000;
  for (let i = 0; i < 20; i++) { g.command(0, { type: 'train', buildingId: t.id, unit: 'villager' }); }
  assert.ok(t.queue.length <= 5);
  const g2 = createGame({ seed: 1 }); g2.players[0].res.food = 5000; const t2 = tc(g2, 0);
  for (let i = 0; i < 3000; i++) { g2.command(0, { type: 'train', buildingId: t2.id, unit: 'villager' }); g2.tick(); }
  assert.ok(mine(g2, 0, 'villager').length <= 10, 'pop capped at 10 without houses');
  assert.equal(g2.command(0, { type: 'train', buildingId: t2.id, unit: 'clubman' }).ok, false);
});
test('age up requires buildings, cost, and gates units', () => {
  const g = createGame({ seed: 1 }); const p = g.players[0]; p.res = { food: 5000, wood: 5000, gold: 5000, stone: 5000 };
  assert.equal(g.command(0, { type: 'age' }).ok, false, 'needs 2 buildings');
  const vs = mine(g, 0, 'villager'), s = spot(g, 0);
  const placed = [];
  for (const [i, type] of ['house', 'granary', 'barracks'].entries()) { const sp = freeSpot(g, 0, type, placed); placed.push(sp); assert.equal(g.command(0, { type: 'build', ids: [vs[i].id], building: type, x: sp.x, y: sp.y }).ok, true, type); }
  for (let i = 0; i < 2000; i++) g.tick();
  const b = [...g.buildings.values()].find(b => b.type === 'barracks' && b.owner === 0);
  assert.equal(g.command(0, { type: 'train', buildingId: b.id, unit: 'axeman' }).ok, false, 'axeman is Tool Age');
  const r = g.command(0, { type: 'age' }); assert.equal(r.ok, true, r.reason);
  for (let i = 0; i < 700; i++) g.tick();
  assert.equal(p.age, 'tool');
  assert.equal(g.command(0, { type: 'train', buildingId: b.id, unit: 'axeman' }).ok, true);
});
