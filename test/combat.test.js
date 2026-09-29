import test from 'node:test'; import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
const tcOf = (g, p) => [...g.buildings.values()].find(b => b.owner === p && b.type === 'town_center');
test('melee chases and kills', () => {
  const g = createGame({ seed: 1 }); const a = g.spawnUnit('clubman', 0, 20, 20), t = g.spawnUnit('villager', 1, 24, 20);
  g.command(0, { type: 'attack', ids: [a.id], targetId: t.id });
  for (let i = 0; i < 400; i++) g.tick();
  assert.equal(g.entities.has(t.id), false); assert.ok(g.players[0].kills >= 1);
});
test('ranged attacks from range without closing', () => {
  const g = createGame({ seed: 1 }); const a = g.spawnUnit('bowman', 0, 20, 20), t = g.spawnUnit('villager', 1, 25, 20); t.order = { type: 'idle' };
  g.command(0, { type: 'attack', ids: [a.id], targetId: t.id }); for (let i = 0; i < 60; i++) g.tick();
  assert.ok(t.hp < t.maxHp); assert.ok(Math.hypot(a.x - t.x, a.y - t.y) > 3);
});
test('idle soldier auto-engages nearby enemy', () => {
  const g = createGame({ seed: 1 }); const a = g.spawnUnit('axeman', 0, 20, 20), t = g.spawnUnit('villager', 1, 24, 20);
  for (let i = 0; i < 400; i++) g.tick(); assert.equal(g.entities.has(t.id), false);
});
test('buildings can be destroyed; catapult splashes', () => {
  const g = createGame({ seed: 1 }); const home = tcOf(g, 1);
  const cats = [g.spawnUnit('catapult', 0, home.x - 6, home.y + 1)];
  g.command(0, { type: 'attack', ids: [cats[0].id], targetId: home.id });
  const v = g.spawnUnit('villager', 1, home.x - 2, home.y + 1);
  for (let i = 0; i < 3000 && g.entities.has(home.id); i++) g.tick();
  assert.equal(g.entities.has(home.id), false); assert.ok(g.players[0].bdestroyed >= 1);
});
test('dead relic carrier drops relic', () => {
  const g = createGame({ seed: 1 }); const r = g.spawnRelic(20.5, 20.5), u = g.spawnUnit('villager', 0, 20.5, 20.5);
  g.command(0, { type: 'relic', ids: [u.id], relicId: r.id }); for (let i = 0; i < 5; i++) g.tick();
  assert.equal(r.holder, u.id); g.damage(u, 999, null); assert.equal(r.holder, null); assert.equal(u.dead, true);
});
