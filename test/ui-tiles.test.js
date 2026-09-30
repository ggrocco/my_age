import test from 'node:test'; import assert from 'node:assert/strict';
import { UNITS } from '../src/data/units.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { AGES } from '../src/data/ages.js';
import { ICONS, icon } from '../src/ui/icons.js';
import { DESC, costHtml, tipHtml } from '../src/ui/tips.js';

const ids = [...Object.keys(UNITS), ...Object.keys(BUILDINGS)];

test('every unit, building and the age button has its own svg icon', () => {
  for (const id of [...ids, 'age', 'lock']) {
    const s = ICONS[id];
    assert.ok(s, `icon for ${id}`);
    assert.match(s, /^<svg[^>]*viewBox="0 0 24 24"/, id); assert.ok(s.endsWith('</svg>'), id);
  }
});
test('icon() falls back by unit class, then to a generic glyph', () => {
  assert.equal(icon('made_up_unit', 'siege'), ICONS.catapult);
  assert.equal(icon('made_up_unit', 'archer'), ICONS.bowman);
  assert.equal(icon('made_up_thing'), ICONS.unknown);
  assert.equal(icon('barracks', 'inf'), ICONS.barracks);
});
test('every unit, building and the age button has a short description', () => {
  for (const id of [...ids, 'age']) { assert.ok(DESC[id], `description for ${id}`); assert.ok(DESC[id].length >= 20 && DESC[id].length <= 200, `${id} length`); }
});
test('costHtml skips zero costs, shortens thousands and flags shortfalls', () => {
  const h = costHtml({ food: 0, wood: 1000, gold: 75, stone: 0 }, ['gold'], true);
  assert.match(h, />1k</); assert.match(h, /75/); assert.doesNotMatch(h, /food/);
  assert.match(h, /class="c short"><i[^>]*><\/i>75/); assert.doesNotMatch(h, /class="c short"><i[^>]*><\/i>1k/);
  assert.match(costHtml({ wood: 1000 }, [], false), />1000</);
  assert.equal(costHtml({}, [], true), '');
});
test('unit tip: name, description, stats, cost and notes', () => {
  const h = tipHtml({ kind: 'unit', id: 'catapult', short: ['gold'], notes: ['Requires Iron Age'] });
  for (const s of ['Catapult', DESC.catapult, 'HP', '75', 'Attack', '50', 'Range', '9', 'Requires Iron Age', 'short']) assert.ok(h.includes(s), s);
  assert.match(tipHtml({ kind: 'unit', id: 'clubman' }), /Melee/);
});
test('building tip lists what it trains and the build time', () => {
  const h = tipHtml({ kind: 'building', id: 'barracks' });
  for (const s of ['Barracks', 'Clubman', 'Mech Walker', `${BUILDINGS.barracks.buildTime}s`, `${BUILDINGS.barracks.hp}`]) assert.ok(h.includes(s), s);
  assert.ok(tipHtml({ kind: 'building', id: 'house' }).includes('+4 population'));
});
test('age tip names the next age and what it unlocks', () => {
  const h = tipHtml({ kind: 'age', id: 'age', next: 'tool' });
  for (const s of ['Tool', 'Archery Range', 'Bowman', 'Scout', '30s']) assert.ok(h.includes(s), s);
  assert.ok(!h.includes('Clubman'));
});
test('age tip states the same building requirement as ageUpProblem', () => {
  const need = a => Math.min(2, Object.entries(BUILDINGS).filter(([id, d]) => d.age === AGES[AGES.indexOf(a) - 1] && id !== 'town_center' && !d.extra).length);
  assert.equal(need('future'), 0, 'iron age has no buildings of its own to require');
  assert.doesNotMatch(tipHtml({ kind: 'age', id: 'age', next: 'future' }), /finished building/);
  for (const a of ['tool', 'bronze', 'iron']) { assert.equal(need(a), 2, a); assert.match(tipHtml({ kind: 'age', id: 'age', next: a }), /2 finished buildings/, a); }
});
test('every tip renders without throwing and never leaks "undefined"', () => {
  for (const id of Object.keys(UNITS)) assert.doesNotMatch(tipHtml({ kind: 'unit', id }), /undefined|NaN/, id);
  for (const id of Object.keys(BUILDINGS)) assert.doesNotMatch(tipHtml({ kind: 'building', id }), /undefined|NaN/, id);
  for (const a of AGES.slice(1)) assert.doesNotMatch(tipHtml({ kind: 'age', id: 'age', next: a }), /undefined|NaN/, a);
});
