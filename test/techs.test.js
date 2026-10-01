import test from 'node:test'; import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { secs } from '../src/sim/util.js';

const pit = (g, owner = 0) => g.addBuilding('storage_pit', owner, 10, 10, true);

test('a completed tech upgrades units that already exist', () => {
  const g = createGame({ seed: 1 }); g.players[0].age = 'tool';
  const club = g.spawnUnit('clubman', 0, 20, 20); // base atk 3
  g.completeTech(0, 'bronze_weapons');            // +2 to inf/cav
  assert.equal(club.atk, 5);
});

test('units trained after a tech inherit it', () => {
  const g = createGame({ seed: 1 }); g.players[0].age = 'tool';
  g.completeTech(0, 'bronze_weapons');
  assert.equal(g.spawnUnit('clubman', 0, 20, 20).atk, 5, 'new unit gets the upgrade');
  assert.equal(g.spawnUnit('bowman', 0, 20, 21).atk, 3, 'non-matching class (archer) unchanged');
});

test('a tech applies exactly once per unit (no double stacking)', () => {
  const g = createGame({ seed: 1 }); g.players[0].age = 'tool';
  const before = g.spawnUnit('clubman', 0, 20, 20);
  g.completeTech(0, 'bronze_weapons');
  const after = g.spawnUnit('clubman', 0, 20, 21);
  assert.equal(before.atk, 5, 'existing unit +2 once');
  assert.equal(after.atk, 5, 'spawned-after unit +2 once, not +4');
});

test('only the enemy who researched benefits; shared UNITS table is untouched', () => {
  const g = createGame({ seed: 1 }); g.players[0].age = g.players[1].age = 'tool';
  g.completeTech(0, 'bronze_weapons');
  assert.equal(g.spawnUnit('clubman', 0, 20, 20).atk, 5);
  assert.equal(g.spawnUnit('clubman', 1, 40, 40).atk, 3, 'other player unaffected');
});

test('economy tech multiplies the gather rate', () => {
  const g = createGame({ seed: 1 }); g.players[0].age = 'tool';
  assert.equal(g.players[0].gatherMult.wood, 1);
  g.completeTech(0, 'woodworking');
  assert.equal(g.players[0].gatherMult.wood, 1.25);
});

test('research command: pays, runs on a timer, then applies', () => {
  const g = createGame({ seed: 1 }); const p = g.players[0]; p.age = 'tool';
  const b = pit(g); const u = g.spawnUnit('axeman', 0, 12, 12); // base atk 5
  p.res = { food: 500, wood: 500, gold: 500, stone: 500 };
  assert.ok(g.command(0, { type: 'research', buildingId: b.id, tech: 'bronze_weapons' }).ok);
  assert.equal(p.res.food, 420, 'cost paid (80 food)'); assert.equal(p.res.gold, 460, 'cost paid (40 gold)');
  assert.ok(b.research && b.research.tech === 'bronze_weapons');
  for (let i = 0; i < secs(40) + 1; i++) g.tick();
  assert.ok(p.techs.has('bronze_weapons'), 'tech completed'); assert.equal(b.research, null);
  assert.equal(u.atk, 7, 'existing axeman upgraded 5 -> 7');
});

test('research gates: building, age, prerequisite, duplicate, concurrent, affordability', () => {
  const g = createGame({ seed: 1 }); const p = g.players[0];
  p.res = { food: 999, wood: 999, gold: 999, stone: 999 };
  const tc = [...g.buildings.values()].find(b => b.owner === 0 && b.type === 'town_center');
  const b1 = pit(g), b2 = g.addBuilding('storage_pit', 0, 14, 14, true);

  assert.equal(g.command(0, { type: 'research', buildingId: b1.id, tech: 'bronze_weapons' }).ok, false, 'blocked at Stone Age');
  assert.equal(g.command(0, { type: 'research', buildingId: tc.id, tech: 'bronze_weapons' }).reason, 'wrong building');
  p.age = 'tool';
  assert.equal(g.command(0, { type: 'research', buildingId: b1.id, tech: 'iron_weapons' }).ok, false, 'iron needs Bronze Age / prereq');
  p.age = 'bronze';
  assert.equal(g.command(0, { type: 'research', buildingId: b1.id, tech: 'iron_weapons' }).reason, 'requires', 'prereq bronze_weapons missing');

  assert.ok(g.command(0, { type: 'research', buildingId: b1.id, tech: 'bronze_weapons' }).ok);
  assert.equal(g.command(0, { type: 'research', buildingId: b2.id, tech: 'bronze_weapons' }).reason, 'already researching', 'no concurrent duplicate');
  assert.equal(g.command(0, { type: 'research', buildingId: b1.id, tech: 'bronze_shields' }).reason, 'busy', 'one research per building');
  for (let i = 0; i < secs(40) + 1; i++) g.tick();
  assert.equal(g.command(0, { type: 'research', buildingId: b1.id, tech: 'bronze_weapons' }).reason, 'already researched');

  p.res = { food: 0, wood: 0, gold: 0, stone: 0 };
  assert.equal(g.command(0, { type: 'research', buildingId: b1.id, tech: 'bronze_shields' }).reason, 'resources');
});
