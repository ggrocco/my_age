import test from 'node:test'; import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
const nearest = (g, type, from) => [...g.resources.values()].filter(r => r.type === type).sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
const villagers = (g, p) => [...g.units.values()].filter(u => u.owner === p && u.type === 'villager');
test('start state', () => {
  const g = createGame({ seed: 1 });
  assert.equal(villagers(g, 0).length, 3); assert.equal(villagers(g, 1).length, 3);
  assert.equal([...g.buildings.values()].filter(b => b.type === 'town_center').length, 2);
});
test('villager gathers wood and returns it', () => {
  const g = createGame({ seed: 1 }); const v = villagers(g, 0)[0], start = g.players[0].res.wood;
  const tree = nearest(g, 'tree', v);
  assert.equal(g.command(0, { type: 'gather', ids: [v.id], resourceId: tree.id }).ok, true);
  for (let i = 0; i < 1500; i++) g.tick();
  assert.ok(g.players[0].res.wood > start + 20, 'wood ' + g.players[0].res.wood);
});
test('unreachable move ends idle without exception', () => {
  const g = createGame({ seed: 1 }); const v = villagers(g, 0)[0];
  const water = g.map.tiles.findIndex(t => t === 1);
  g.command(0, { type: 'move', ids: [v.id], x: (water % g.map.size) + 0.5, y: Math.floor(water / g.map.size) + 0.5 });
  for (let i = 0; i < 2500; i++) g.tick();
  assert.equal(v.order.type, 'idle');
});
test('deterministic', () => {
  const run = () => { const g = createGame({ seed: 9 }); const v = villagers(g, 0)[0];
    g.command(0, { type: 'gather', ids: [v.id], resourceId: nearest(g, 'tree', v).id });
    for (let i = 0; i < 500; i++) g.tick(); return JSON.stringify(g.snapshot()); };
  assert.equal(run(), run());
});
