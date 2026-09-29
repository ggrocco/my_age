import { UNITS } from '../data/units.js';
import { BUILDINGS } from '../data/buildings.js';
import { AGES, AGE_COST, ageIndex } from '../data/ages.js';
import { secs, RES_KIND } from './util.js';

const fail = reason => ({ ok: false, reason });
const OK = { ok: true };
const RES = ['food', 'wood', 'gold', 'stone'];
export const canAfford = (p, cost) => RES.every(k => p.res[k] >= (cost[k] || 0));
const pay = (p, cost) => { for (const k of RES) p.res[k] -= cost[k] || 0; };
const ownUnits = (game, pid, ids) => (ids || []).map(i => game.entities.get(i)).filter(e => e && e.kind === 'unit' && e.owner === pid && !e.dead);

export function canPlace(game, pid, type, x, y) {
  const def = BUILDINGS[type], n = game.map.size, p = game.players[pid];
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  if (x < 1 || y < 1 || x + def.size > n - 1 || y + def.size > n - 1) return false;
  for (let j = y; j < y + def.size; j++) for (let i = x; i < x + def.size; i++) {
    if (game.map.tiles[j * n + i] === 1 || game.occAt(i, j) || !p.explored[j * n + i]) return false;
  }
  return true;
}

export function ageUpProblem(game, pid) {
  const p = game.players[pid];
  if (p.ageUp) return 'already researching';
  const next = AGES[ageIndex(p.age) + 1]; if (!next) return 'max age';
  const owned = new Set(), avail = new Set();
  for (const [id, d] of Object.entries(BUILDINGS)) if (d.age === p.age && id !== 'town_center' && !d.extra) avail.add(id);
  let hasTC = false;
  for (const b of game.buildings.values()) if (b.owner === pid && b.constructed) { if (b.type === 'town_center') hasTC = true; if (avail.has(b.type)) owned.add(b.type); }
  if (!hasTC) return 'needs town center';
  if (owned.size < Math.min(2, avail.size)) return 'needs buildings';
  if (!canAfford(p, AGE_COST[next].cost)) return 'resources';
  return null;
}

export function execute(game, pid, cmd) {
  const p = game.players[pid];
  if (!p || game.result) return fail('no game');
  switch (cmd.type) {
    case 'move': {
      const us = ownUnits(game, pid, cmd.ids); if (!us.length) return fail('no units');
      if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y)) return fail('bad target');
      for (const u of us) { u.order = { type: 'move', x: cmd.x, y: cmd.y, slack: 0 }; u.path = null; u.retry = 0; }
      return OK;
    }
    case 'gather': {
      const us = ownUnits(game, pid, cmd.ids).filter(u => u.type === 'villager'), r = game.entities.get(cmd.resourceId);
      if (!us.length) return fail('no villagers');
      const ok = r && !r.dead && r.amount > 0 && (r.kind === 'resource' || (r.kind === 'building' && r.owner === pid && r.constructed && r.gatherType));
      if (!ok) return fail('bad resource');
      const kind = r.gatherType || RES_KIND[r.type];
      for (const u of us) { u.order = { type: 'gather', res: r.id, kind, phase: 'go', fails: 0 }; u.path = null; u.retry = 0; if (u.carry.type !== kind) u.carry = { type: null, amount: 0 }; }
      return OK;
    }
    case 'build': {
      const def = BUILDINGS[cmd.building], us = ownUnits(game, pid, cmd.ids).filter(u => u.type === 'villager');
      if (!def) return fail('unknown building'); if (!us.length) return fail('no villagers');
      if (ageIndex(def.age) > ageIndex(p.age)) return fail('age');
      if (!canPlace(game, pid, cmd.building, cmd.x, cmd.y)) return fail('placement');
      if (!canAfford(p, def.cost)) return fail('resources');
      pay(p, def.cost);
      const b = game.addBuilding(cmd.building, pid, cmd.x, cmd.y, false);
      for (const u of us) { u.order = { type: 'build', target: b.id, fails: 0 }; u.path = null; u.retry = 0; }
      return OK;
    }
    case 'train': {
      const b = game.entities.get(cmd.buildingId), def = UNITS[cmd.unit];
      if (!b || b.kind !== 'building' || b.owner !== pid || !b.constructed || !def) return fail('bad building');
      if (!(BUILDINGS[b.type].trains || []).includes(cmd.unit)) return fail('cannot train');
      if (ageIndex(def.age) > ageIndex(p.age)) return fail('age');
      if (b.queue.length >= 5) return fail('queue full');
      if (p.pop >= p.popCap) return fail('pop cap');
      if (!canAfford(p, def.cost)) return fail('resources');
      pay(p, def.cost); b.queue.push({ unit: cmd.unit, remaining: secs(def.trainTime) }); p.pop++;
      return OK;
    }
    case 'age': {
      const why = ageUpProblem(game, pid); if (why) return fail(why);
      const next = AGES[ageIndex(p.age) + 1], info = AGE_COST[next];
      pay(p, info.cost); p.ageUp = { to: next, remaining: secs(info.time) };
      return OK;
    }
    case 'attack': {
      const us = ownUnits(game, pid, cmd.ids), t = game.entities.get(cmd.targetId);
      if (!us.length) return fail('no units'); if (!t || t.dead || t.owner === pid || (t.kind !== 'unit' && t.kind !== 'building')) return fail('bad target');
      for (const u of us) { u.order = { type: 'attack', target: t.id, fails: 0 }; u.path = null; u.retry = 0; }
      return OK;
    }
    case 'relic': {
      const us = ownUnits(game, pid, cmd.ids).filter(u => u.type !== 'catapult' && u.relic === null), r = game.relics.get(cmd.relicId);
      if (!us.length) return fail('no carriers'); if (!r || r.holder !== null || r.stored !== null) return fail('relic unavailable');
      const u = us[0]; u.order = { type: 'relic', relic: r.id, phase: 'go', fails: 0 }; u.path = null; u.retry = 0;
      return OK;
    }
  }
  return fail('unknown command');
}
