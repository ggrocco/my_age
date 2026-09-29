import test from 'node:test'; import assert from 'node:assert/strict';
import { generateMap } from '../src/sim/map.js';
import { findPath } from '../src/sim/path.js';
const blockedOf = m => (x, y) => m.tiles[y * m.size + x] === 1 || m.resources.some(r => Math.floor(r.x) === x && Math.floor(r.y) === y);
test('deterministic', () => {
  assert.deepEqual(generateMap(5).resources, generateMap(5).resources);
});
test('starts connected and resource rich', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const m = generateMap(seed);
    assert.ok(findPath(m, blockedOf(m), m.starts[0], m.starts[1]) !== null, 'seed ' + seed);
    for (const s of m.starts) for (const type of ['tree', 'berry', 'gold', 'stone']) {
      assert.ok(m.resources.some(r => r.type === type && Math.hypot(r.x - s.x, r.y - s.y) < 16), `${seed} ${type}`);
    }
    assert.equal(m.relicSpots.length, 5);
  }
});
test('path around wall, enclosed null, same tile empty', () => {
  const m = { size: 10, tiles: new Uint8Array(100) };
  const wall = (x, y) => x === 5 && y < 9;
  const p = findPath(m, wall, { x: 2, y: 2 }, { x: 8, y: 2 });
  assert.ok(p && p.length > 6 && p.at(-1).x === 8 && p.every(s => !wall(s.x, s.y)));
  const box = (x, y) => Math.abs(x - 8) <= 1 && Math.abs(y - 2) <= 1 && !(x === 8 && y === 2) ;
  assert.equal(findPath(m, box, { x: 2, y: 2 }, { x: 8, y: 2 }), null);
  assert.deepEqual(findPath(m, wall, { x: 2, y: 2 }, { x: 2, y: 2 }), []);
});
