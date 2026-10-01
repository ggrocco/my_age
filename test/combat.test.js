import test from 'node:test'; import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { damageTo } from '../src/sim/orders.js';
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
test('railgun outranges: kills a distant target without closing to melee', () => {
  const g = createGame({ seed: 1 }); const a = g.spawnUnit('railgun', 0, 20, 20), t = g.spawnUnit('clubman', 1, 30, 20); t.order = { type: 'idle' };
  g.command(0, { type: 'attack', ids: [a.id], targetId: t.id });
  for (let i = 0; i < 200; i++) g.tick();
  assert.equal(g.entities.has(t.id), false, 'clubman died'); assert.ok(g.players[0].kills >= 1);
  assert.ok(Math.hypot(a.x - t.x, a.y - t.y) > 9, 'railgun fired from where it stood (started 10 away), never closing to melee');
});
test('railgun splash hurts enemies next to the target but never friendlies', () => {
  const g = createGame({ seed: 1 }); const a = g.spawnUnit('railgun', 0, 20, 20), t = g.spawnUnit('clubman', 1, 30, 20);
  const enemyNear = g.spawnUnit('villager', 1, 30, 21), friendNear = g.spawnUnit('villager', 0, 31, 20);
  t.order = enemyNear.order = friendNear.order = { type: 'idle' };
  g.command(0, { type: 'attack', ids: [a.id], targetId: t.id });
  for (let i = 0; i < 10; i++) g.tick();
  assert.equal(g.entities.has(t.id), false, 'target died');
  assert.ok(enemyNear.hp < enemyNear.maxHp, 'adjacent enemy took splash damage');
  assert.equal(friendNear.hp, friendNear.maxHp, 'adjacent friendly took none');
});
test('drone is ranged; mech is melee and tanky', () => {
  const g = createGame({ seed: 1 }); const d = g.spawnUnit('drone', 0, 20, 20), v = g.spawnUnit('villager', 1, 25, 20); v.order = { type: 'idle' };
  g.command(0, { type: 'attack', ids: [d.id], targetId: v.id }); for (let i = 0; i < 60; i++) g.tick();
  assert.ok(v.hp < v.maxHp, 'drone hit the villager'); assert.ok(Math.hypot(d.x - v.x, d.y - v.y) > 3, 'drone stayed at range');
  const g2 = createGame({ seed: 1 }); const m = g2.spawnUnit('mech', 0, 20, 20), c = g2.spawnUnit('clubman', 1, 26, 20); c.order = { type: 'idle' };
  g2.command(0, { type: 'attack', ids: [m.id], targetId: c.id });
  for (let i = 0; i < 600 && g2.entities.has(c.id); i++) g2.tick();
  assert.equal(g2.entities.has(c.id), false, 'mech killed the clubman'); assert.ok(m.hp > 0 && !m.dead, 'mech survived');
});
test('attack cooldown depends on unit class', () => {
  const g = createGame({ seed: 1 });
  assert.equal(g.spawnUnit('railgun', 0, 20, 20).cooldown, 80); assert.equal(g.spawnUnit('drone', 0, 20, 21).cooldown, 40);
  assert.equal(g.spawnUnit('mech', 0, 20, 22).cooldown, 30);
});
test('attack type reads the matching armor class (AoE1 damage model)', () => {
  const g = createGame({ seed: 1 });
  const hoplite = g.spawnUnit('hoplite', 0, 20, 20);    // melee 17, marmor 5 / parmor 0
  const swords = g.spawnUnit('swordsman', 1, 24, 20);   // marmor 2
  const bowman = g.spawnUnit('bowman', 1, 26, 20);      // pierce 3
  const ha = g.spawnUnit('horse_archer', 1, 28, 20);    // parmor 2
  assert.equal(damageTo(hoplite, swords), 17 - 2, 'melee attacker subtracts melee armor');
  assert.equal(damageTo(bowman, hoplite), 3, 'pierce attacker ignores melee armor (hoplite parmor 0)');
  assert.equal(damageTo(bowman, ha), 1, 'pierce armor blunts arrows: max(1, 3-2)');
});
test('bonus damage applies after armor and only to the matching class', () => {
  const g = createGame({ seed: 1 });
  const spear = g.spawnUnit('spearman', 0, 20, 20);     // melee 6, bonus { cav: 8 }
  const scout = g.spawnUnit('scout', 1, 22, 20);        // cls cav
  const club = g.spawnUnit('clubman', 1, 24, 20);       // cls inf
  assert.equal(damageTo(spear, scout), 6 + 8, 'spearman bonus vs cavalry');
  assert.equal(damageTo(spear, club), 6, 'no bonus vs infantry');
});
test('archers bounce off buildings; melee and siege do not', () => {
  const g = createGame({ seed: 1 }); const tc = tcOf(g, 1); // building marmor 3 / parmor 8
  const bowman = g.spawnUnit('bowman', 0, 20, 20);      // pierce 3
  const swords = g.spawnUnit('swordsman', 0, 20, 21);   // melee 13
  const catapult = g.spawnUnit('catapult', 0, 20, 22);  // melee 60
  assert.equal(damageTo(bowman, tc), 1, 'pierce attack bounces off building pierce armor');
  assert.equal(damageTo(swords, tc), 13 - 3, 'melee infantry damages buildings');
  assert.equal(damageTo(catapult, tc), 60 - 3, 'siege crushes buildings');
});
test('dead relic carrier drops relic', () => {
  const g = createGame({ seed: 1 }); const r = g.spawnRelic(20.5, 20.5), u = g.spawnUnit('villager', 0, 20.5, 20.5);
  g.command(0, { type: 'relic', ids: [u.id], relicId: r.id }); for (let i = 0; i < 5; i++) g.tick();
  assert.equal(r.holder, u.id); g.damage(u, 999, null); assert.equal(r.holder, null); assert.equal(u.dead, true);
});
