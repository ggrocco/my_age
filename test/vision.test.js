import test from 'node:test'; import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { visibleTo } from '../src/sim/vision.js';
test('far tile hidden, near visible, explored persists', () => {
  const g = createGame({ seed: 1 }); const s = g.map.starts[0];
  assert.equal(visibleTo(g, 0, s.x, s.y), 'visible');
  assert.equal(visibleTo(g, 0, g.map.starts[1].x, g.map.starts[1].y), 'hidden');
  const u = g.spawnUnit('scout', 0, s.x + 8, s.y + 8); u.order = { type: 'move', x: s.x + 10, y: s.y + 10 };
  g.command(0, { type: 'move', ids: [u.id], x: s.x + 20, y: s.y + 20 }); for (let i = 0; i < 200; i++) g.tick();
  assert.equal(visibleTo(g, 0, s.x + 8, s.y + 8) === 'hidden', false);
});
test('enemy in hidden tiles not in visibleEntities', () => {
  const g = createGame({ seed: 1 }); const e = g.spawnUnit('villager', 1, g.map.starts[1].x, g.map.starts[1].y + 4);
  assert.equal(g.visibleEntities(0).includes(e), false);
  assert.equal(g.visibleEntities(1).includes(e), true);
});
