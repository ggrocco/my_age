import { generateMap } from './map.js';
import { UNITS } from '../data/units.js';
import { BUILDINGS } from '../data/buildings.js';
import { AGES } from '../data/ages.js';
import { updateUnit } from './orders.js';
import { execute } from './commands.js';
import { updateVision } from './vision.js';
import { secs, rectOf, centerOf } from './util.js';

export function createGame({ seed = 1, rules = null, size = 64 } = {}) {
  const map = generateMap(seed, size), n = map.size, occ = new Int32Array(n * n);
  const game = {
    seed, map, rules, time: 0, result: null, nextId: 1,
    entities: new Map(), units: new Map(), buildings: new Map(), resources: new Map(), relics: new Map(),
    players: [0, 1].map(id => ({ id, res: { food: 200, wood: 200, gold: 100, stone: 100 }, age: 'stone', ageUp: null,
      explored: new Uint8Array(n * n), visible: new Uint8Array(n * n), kills: 0, bdestroyed: 0, gathered: 0, pop: 0, popCap: 0, defeated: false })),
    occAt: (x, y) => (x < 0 || y < 0 || x >= n || y >= n) ? 1 : occ[y * n + x],
    blocked: (x, y) => occ[y * n + x] !== 0,
  };
  const mark = (e, v) => { const r = rectOf(e); for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) occ[y * n + x] = v; };

  game.addResource = r => { const e = { ...r, kind: 'resource', id: game.nextId++, dead: false }; game.entities.set(e.id, e); game.resources.set(e.id, e); mark(e, e.id); return e; };
  game.addBuilding = (type, owner, x, y, constructed) => {
    const d = BUILDINGS[type];
    const e = { id: game.nextId++, kind: 'building', type, owner, x, y, size: d.size, maxHp: d.hp, hp: constructed ? d.hp : 1, constructed, progress: constructed ? 1 : 0,
      queue: [], workers: 0, sight: d.sight, armor: 0, dead: false, gatherType: d.gatherType || null, amount: d.amount || 0 };
    game.entities.set(e.id, e); game.buildings.set(e.id, e); mark(e, e.id); return e;
  };
  game.spawnUnit = (type, owner, x, y) => {
    const d = UNITS[type];
    const u = { id: game.nextId++, kind: 'unit', type, owner, x, y, hp: d.hp, maxHp: d.hp, atk: d.atk, armor: d.armor, range: d.range, speed: d.speed, sight: d.sight,
      cls: d.cls, splash: d.splash || 0, cooldown: d.cls === 'archer' ? 40 : d.cls === 'siege' ? 80 : 30, cd: 0, order: { type: 'idle' }, path: null, retry: 0,
      carry: { type: null, amount: 0 }, relic: null, dead: false };
    game.entities.set(u.id, u); game.units.set(u.id, u); return u;
  };
  game.spawnRelic = (x, y) => { const r = { id: game.nextId++, kind: 'relic', x, y, holder: null, stored: null, dead: false }; game.entities.set(r.id, r); game.relics.set(r.id, r); return r; };
  game.relicOwner = r => r.holder !== null ? game.entities.get(r.holder)?.owner ?? null : r.stored !== null ? game.entities.get(r.stored)?.owner ?? null : null;

  const dropRelics = (e, x, y) => {
    for (const r of game.relics.values()) if ((e.kind === 'unit' && r.holder === e.id) || (e.kind === 'building' && r.stored === e.id)) { r.holder = null; r.stored = null; r.x = x; r.y = y; }
    if (e.kind === 'unit') e.relic = null;
  };
  game.remove = e => {
    if (e.dead) return; e.dead = true;
    game.entities.delete(e.id); game.units.delete(e.id); game.buildings.delete(e.id); game.resources.delete(e.id);
    if (e.kind === 'building' || e.kind === 'resource') mark(e, 0);
    const c = centerOf(e); dropRelics(e, e.kind === 'building' ? Math.min(n - 1, Math.floor(c.x) + 0.5) : c.x, e.kind === 'building' ? Math.min(n - 1, e.y + e.size + 0.5) : c.y);
  };
  game.depleted = r => { if (r.kind === 'resource') game.remove(r); else if (r.gatherType) game.remove(r); };
  game.damage = (e, amount, attacker) => {
    if (e.dead) return; e.hp -= amount;
    if (e.hp <= 0) {
      if (attacker) { const p = game.players[attacker.owner]; if (e.kind === 'building') p.bdestroyed++; else p.kills += e.cls === 'civ' ? 1 : 2; }
      game.remove(e);
    }
  };
  game.findSpawn = b => {
    for (let ring = 1; ring <= 3; ring++) for (let i = -ring; i < b.size + ring; i++) for (const [x, y] of [[b.x + i, b.y + b.size - 1 + ring], [b.x + i, b.y - ring], [b.x - ring, b.y + i], [b.x + b.size - 1 + ring, b.y + i]]) {
      if (x >= 0 && y >= 0 && x < n && y < n && map.tiles[y * n + x] !== 1 && !occ[y * n + x]) return { x: x + 0.5, y: y + 0.5 };
    }
    return { x: b.x + 0.5, y: b.y + 0.5 };
  };
  game.recount = () => {
    for (const p of game.players) { p.pop = 0; p.popCap = 0; }
    for (const u of game.units.values()) game.players[u.owner].pop++;
    for (const b of game.buildings.values()) { const p = game.players[b.owner]; p.pop += b.queue.length; if (b.constructed) p.popCap += BUILDINGS[b.type].pop || 0; }
    for (const p of game.players) p.popCap = Math.min(50, p.popCap);
  };
  game.command = (pid, cmd) => execute(game, pid, cmd);
  game.visibleEntities = pid => {
    const p = game.players[pid], out = [];
    for (const list of [game.units, game.buildings]) for (const e of list.values()) {
      if (e.owner === pid) { out.push(e); continue; }
      const c = centerOf(e); if (p.visible[Math.floor(c.y) * n + Math.floor(c.x)]) out.push(e);
    }
    for (const r of game.relics.values()) if (p.visible[Math.floor(r.y) * n + Math.floor(r.x)]) out.push(r);
    return out;
  };
  game.knownResources = pid => [...game.resources.values()].filter(r => game.players[pid].explored[Math.floor(r.y) * n + Math.floor(r.x)]);

  game.tick = () => {
    if (game.result) return;
    game.time++;
    for (const u of [...game.units.values()]) if (!u.dead) updateUnit(game, u);
    for (const b of [...game.buildings.values()]) if (!b.dead) updateBuilding(game, b);
    for (const p of game.players) if (p.ageUp && --p.ageUp.remaining <= 0) { p.age = p.ageUp.to; p.ageUp = null; }
    for (const r of game.relics.values()) if (r.holder !== null) { const h = game.entities.get(r.holder); if (h) { r.x = h.x; r.y = h.y; } }
    game.recount();
    if (game.time % 4 === 0) updateVision(game);
    if (game.rules) { const res = game.rules.check(game); if (res) game.result = res; }
  };
  game.snapshot = () => ({ time: game.time, players: game.players.map(p => ({ res: p.res, age: p.age, kills: p.kills, pop: p.pop })),
    entities: [...game.entities.values()].filter(e => e.kind !== 'resource').map(e => ({ id: e.id, type: e.type, owner: e.owner, x: +e.x.toFixed(3), y: +e.y.toFixed(3), hp: +(e.hp ?? 0).toFixed(2) })) });

  // initial state
  for (const r of map.resources) game.addResource(r);
  for (const [i, s] of map.starts.entries()) {
    const tc = game.addBuilding('town_center', i, s.x - 1, s.y - 1, true);
    for (let k = 0; k < 3; k++) { const sp = game.findSpawn(tc); const u = game.spawnUnit('villager', i, sp.x, sp.y); }
  }
  game.recount(); updateVision(game);
  if (rules && rules.setup) rules.setup(game);
  game.recount(); updateVision(game);
  return game;
}

function updateBuilding(game, b) {
  if (b.gatherType && b.amount <= 0) return game.remove(b);
  if (!b.constructed) {
    const w = b.workers; b.workers = 0;
    if (w > 0) {
      b.progress += Math.pow(w, 0.7) / secs(BUILDINGS[b.type].buildTime); b.hp = Math.max(b.hp, b.maxHp * Math.min(1, b.progress));
      if (b.progress >= 1) { b.constructed = true; b.hp = b.maxHp; b.progress = 1; }
    }
    return;
  }
  if (b.queue.length && --b.queue[0].remaining <= 0) {
    const q = b.queue.shift(), sp = game.findSpawn(b); game.spawnUnit(q.unit, b.owner, sp.x, sp.y);
  }
}
