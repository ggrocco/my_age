import test from 'node:test'; import assert from 'node:assert/strict';
import { UNITS } from '../src/data/units.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { AGES, AGE_COST, AGE_NAME } from '../src/data/ages.js';
const costOk = c => Object.values(c).every(v => v >= 0);
test('units valid', () => {
  for (const [id, u] of Object.entries(UNITS)) {
    assert.ok(costOk(u.cost), id); assert.ok(AGES.includes(u.age), id); assert.ok(u.hp > 0 && u.speed > 0, id);
  }
});
test('buildings valid and trains exist', () => {
  for (const [id, b] of Object.entries(BUILDINGS)) {
    assert.ok(costOk(b.cost), id); assert.ok(AGES.includes(b.age), id);
    for (const t of b.trains || []) assert.ok(UNITS[t], `${id} trains ${t}`);
  }
});
test('every trainable unit has a building; ages have costs', () => {
  const trainable = new Set(Object.values(BUILDINGS).flatMap(b => b.trains || []));
  for (const [id, u] of Object.entries(UNITS)) if (u.trainable !== false) assert.ok(trainable.has(id), id);
  for (const a of AGES.slice(1)) assert.ok(AGE_COST[a]);
});
test('AI Future age exists with cost and display name', () => {
  assert.deepEqual(AGES, ['stone', 'tool', 'bronze', 'iron', 'future']);
  assert.ok(AGE_COST.future && AGE_COST.future.time > 0);
  assert.equal(AGE_NAME.future, 'AI Future');
  for (const a of AGES) assert.ok(AGE_NAME[a], a);
});
test('future units: class, age and training building', () => {
  const want = { drone: ['archer', 'archery_range'], mech: ['inf', 'barracks'], railgun: ['siege', 'government_center'] };
  for (const [id, [cls, bld]] of Object.entries(want)) {
    assert.equal(UNITS[id].age, 'future', id); assert.equal(UNITS[id].cls, cls, id);
    assert.ok(BUILDINGS[bld].trains.includes(id), `${bld} trains ${id}`);
  }
  assert.ok(UNITS.railgun.splash > 0 && UNITS.railgun.range > UNITS.catapult.range);
});
