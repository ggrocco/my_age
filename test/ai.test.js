import test from 'node:test'; import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { createBot } from '../src/ai/bot.js';
import { roundById } from '../src/rounds/index.js';
import { ageIndex } from '../src/data/ages.js';
test('bot builds an economy and army in 10 minutes without command spam', () => {
  const g = createGame({ seed: 4, rules: roundById('conquest') }); const b = createBot(g, 0, 'medium'), o = createBot(g, 1, 'easy');
  for (let i = 0; i < 12000 && !g.result; i++) { g.tick(); if (i % 15 === 0) b.think(); if (i % 30 === 0) o.think(); }
  const mine = [...g.units.values()].filter(u => u.owner === 0), bl = [...g.buildings.values()].filter(x => x.owner === 0);
  console.log('   vills', mine.filter(u => u.type === 'villager').length, 'army', mine.filter(u => u.cls !== 'civ').length, 'houses', bl.filter(x => x.type === 'house').length, 'age', g.players[0].age, 'maxRejects', b.maxRejects, 'res', JSON.stringify(g.players[0].res), 'result', JSON.stringify(g.result));
  assert.ok(mine.filter(u => u.type === 'villager').length >= 15 || g.result);
  assert.ok(bl.filter(x => x.type === 'house').length >= 2 || g.result);
  assert.ok(ageIndex(g.players[0].age) >= 1); assert.ok(g.players[0].kills + mine.filter(u => u.cls !== 'civ').length >= 5);
  assert.ok(b.maxRejects <= 20, 'rejects ' + b.maxRejects);
});
