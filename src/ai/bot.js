// Scripted build-order AI. Issues only game.command calls and reads game.visibleEntities/knownResources.
import { UNITS } from '../data/units.js';
import { BUILDINGS } from '../data/buildings.js';
import { AGES, ageIndex } from '../data/ages.js';
import { canPlace, canAfford, ageUpProblem } from '../sim/commands.js';
import { RES_KIND, centerOf, distPoint } from '../sim/util.js';

const DIFF = {
  easy:   { every: 30, villagers: 12, wave: 12, attackAt: 10000, army: 16 },
  medium: { every: 15, villagers: 20, wave: 14, attackAt: 8000, army: 28 },
  hard:   { every: 10, villagers: 26, wave: 18, attackAt: 8000, army: 36 },
};
const SHARE = { food: 0.35, wood: 0.35, gold: 0.2, stone: 0.1 };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function createBot(game, pid, difficulty = 'medium') {
  const D = DIFF[difficulty], me = game.players[pid], enemy = 1 - pid, enemyStart = game.map.starts[enemy];
  const sweep = [enemyStart, ...[[16, 16], [48, 16], [16, 48], [48, 48], [32, 32], [32, 10], [32, 54], [10, 32], [54, 32]].map(([x, y]) => ({ x, y }))];
  const bot = { saving: false, why: {}, rejects: 0, maxRejects: 0, issued: 0, waveActive: false, sweepIdx: 0, think };

  // In the Wonder round, keep the wonder's cost untouched until it is placed.
  const reserved = () => (game.rules && game.rules.id === 'wonder' && !mine('buildings').some(b => b.type === 'wonder')) ? BUILDINGS.wonder.cost : null;
  const canPay = cost => { const r = reserved(); return canAfford(me, r ? Object.fromEntries(['food', 'wood', 'gold', 'stone'].map(k => [k, (cost[k] || 0) + (r[k] || 0)])) : cost); };

  function cmd(c) {
    const r = game.command(pid, c); bot.issued++;
    if (r.ok) bot.rejects = 0; else { const k = c.type + ':' + (c.building || c.unit || '') + ':' + r.reason; bot.why[k] = (bot.why[k] || 0) + 1; bot.rejects++; bot.maxRejects = Math.max(bot.maxRejects, bot.rejects); }
    return r.ok;
  }
  const mine = kind => [...game[kind].values()].filter(e => e.owner === pid);
  const count = type => mine('buildings').filter(b => b.type === type).length;

  function spotNear(type, around, margin = true) {
    const def = BUILDINGS[type], c = around;
    for (let r = 3; r < 16; r++) for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = Math.floor(c.x) + dx, y = Math.floor(c.y) + dy;
      if (!canPlace(game, pid, type, x, y)) continue;
      if (margin && r < 12) { let clear = true;
        for (let j = y - 1; j <= y + def.size && clear; j++) for (let i = x - 1; i <= x + def.size; i++) if (game.occAt(i, j)) { clear = false; break; }
        if (!clear) continue; }
      return { x, y };
    }
    return null;
  }
  function pickBuilder(vills, near) {
    let best = null, bd = Infinity;
    for (const v of vills) { if (v.order.type === 'build') continue; const d = dist(v, near) + (v.order.type === 'idle' ? -5 : 0); if (d < bd) { bd = d; best = v; } }
    return best;
  }
  function tryBuild(type, vills, around, nBuilders = 1) {
    const def = BUILDINGS[type];
    if (ageIndex(def.age) > ageIndex(me.age) || !(type === 'wonder' ? canAfford(me, def.cost) : canPay(def.cost))) return false;
    const sp = spotNear(type, around); if (!sp) return false;
    const chosen = [...vills].filter(v => v.order.type !== 'build').sort((a, b) => dist(a, sp) - dist(b, sp)).slice(0, nBuilders);
    if (!chosen.length) return false;
    return cmd({ type: 'build', ids: chosen.map(v => v.id), building: type, x: sp.x, y: sp.y });
  }

  function think() {
    if (game.result) return;
    const tc = mine('buildings').find(b => b.type === 'town_center' && b.constructed), anyBase = tc || mine('buildings').find(b => b.constructed);
    const units = mine('units'), vills = units.filter(u => u.type === 'villager');
    const army = units.filter(u => u.cls !== 'civ' && u.type !== 'king');
    const roundId = game.rules ? game.rules.id : 'conquest';
    if (!anyBase && !vills.length && !army.length) return;
    const home = anyBase ? centerOf(anyBase) : (units[0] || game.map.starts[pid]);
    const buildings = mine('buildings'), done = buildings.filter(b => b.constructed);
    const vis = game.visibleEntities(pid), enemies = vis.filter(e => e.owner === enemy && (e.kind === 'unit' || e.kind === 'building'));

    // --- economy: villagers
    const queuedVills = done.reduce((n, b) => n + b.queue.filter(q => q.unit === 'villager').length, 0);
    if (tc && !(bot.saving && vills.length >= 14) && vills.length + queuedVills < D.villagers && tc.queue.length < 2 && canAfford(me, UNITS.villager.cost) && me.pop < me.popCap) cmd({ type: 'train', buildingId: tc.id, unit: 'villager' });

    // --- houses
    const housesBuilding = buildings.filter(b => b.type === 'house' && !b.constructed).length;
    if (me.popCap < 50 && me.pop + 3 >= me.popCap && housesBuilding < (roundId === 'deathmatch' ? 3 : 1) && vills.length) tryBuild('house', vills, home);

    // --- buildings & age
    const free = vills.filter(v => v.order.type !== 'build');
    if (vills.length >= 5 && count('barracks') < 1) tryBuild('barracks', free, home);
    if (vills.length >= 7 && count('storage_pit') < 1 && count('granary') < 1) tryBuild('storage_pit', free, home);
    const dm = roundId === 'deathmatch'; // rich start: mass production buildings instead of a slow economy
    if (dm && vills.length >= 5) {
      if (count('barracks') < 4) tryBuild('barracks', free, home);
      else if (ageIndex(me.age) >= 1 && count('archery_range') < 2) tryBuild('archery_range', free, home);
      else if (ageIndex(me.age) >= 1 && count('stable') < 2) tryBuild('stable', free, home);
    }
    if (difficulty === 'hard' && vills.length >= 14 && count('barracks') < 2) tryBuild('barracks', free, home);
    bot.saving = false;
    if (!me.ageUp && vills.length >= (roundId === 'wonder' ? 5 : Math.min(9, D.villagers * 0.5)) && ageIndex(me.age) < AGES.length - 1) {
      const why = ageUpProblem(game, pid);
      if (!why) cmd({ type: 'age' }); else if (why === 'resources' && ageIndex(me.age) === 0) bot.saving = true;
    }
    if (ageIndex(me.age) >= 1) {
      if (count('archery_range') < 1) tryBuild('archery_range', free, home);
      if (count('stable') < 1) tryBuild('stable', free, home);
    }
    if (ageIndex(me.age) >= 2 && count('government_center') < 1 && roundId !== 'wonder') tryBuild('government_center', free, home);
    if (roundId === 'wonder' && ageIndex(me.age) >= 2 && count('wonder') < 1 && vills.length >= 8) tryBuild('wonder', free, home, Math.min(10, free.length));
    if (roundId === 'wonder') { // everyone helps build the wonder
      const w = buildings.find(b => b.type === 'wonder' && !b.constructed);
      const helpers = w ? free.filter(v => v.order.type !== 'build').slice(0, 12).map(v => v.id) : [];
      if (helpers.length) cmd({ type: 'construct', ids: helpers, targetId: w.id });
    }

    // --- idle villagers -> resources
    const idle = vills.filter(v => v.order.type === 'idle');
    if (idle.length) assign(idle, vills, tc, home, done);

    // --- military production
    const armyCap = roundId === 'deathmatch' ? 44 : D.army;
    const armyCount = army.length + done.reduce((n, b) => n + b.queue.filter(q => UNITS[q.unit].cls !== 'civ').length, 0);
    if (!bot.saving && armyCount < armyCap && (vills.length >= D.villagers * 0.6 || roundId === 'deathmatch' || roundId === 'wonder')) {
      for (const b of done) {
        const trains = BUILDINGS[b.type].trains || []; if (b.type === 'town_center' || b.queue.length >= (roundId === 'deathmatch' ? 4 : 2)) continue;
        const u = bestUnit(trains); if (!u || !canPay(UNITS[u].cost) || me.pop >= me.popCap) continue;
        if (UNITS[u].cls === 'siege' && army.filter(a => a.cls === 'siege').length + done.reduce((n, x) => n + x.queue.filter(q => UNITS[q.unit].cls === 'siege').length, 0) >= 2) continue;
        cmd({ type: 'train', buildingId: b.id, unit: u });
      }
    }

    // --- military orders
    orderArmy(army, enemies, home, roundId, vis);
  }

  const SIEGE = ['railgun', 'catapult'];
  function bestUnit(trains) {
    const pref = ['mech', 'railgun', 'swordsman', 'hoplite', 'catapult', 'drone', 'horse_archer', 'axeman', 'bowman', 'spearman', 'clubman', 'slinger'];
    const ok = pref.filter(u => trains.includes(u) && ageIndex(UNITS[u].age) <= ageIndex(me.age));
    if (!ok.length) return null;
    const siege = ok.find(u => SIEGE.includes(u));
    if (siege && game.time % 3 === 0) return siege;
    return ok.find(u => !SIEGE.includes(u)) || siege;
  }

  function dropDist(kind, p, done) {
    let best = Infinity;
    for (const b of done) if ((BUILDINGS[b.type].drops || []).includes(kind)) best = Math.min(best, distPoint(p.x, p.y, b));
    return best;
  }
  function assign(idle, vills, tc, home, done) {
    const cnt = { food: 0, wood: 0, gold: 0, stone: 0 };
    for (const v of vills) if (v.order.type === 'gather') cnt[v.order.kind]++;
    const known = game.knownResources(pid);
    const early = vills.length < 12 || ageIndex(me.age) === 0;
    for (const v of idle) {
      const total = vills.length || 1;
      let kind = 'wood', bestDef = -Infinity;
      for (const k of ['food', 'wood', 'gold', 'stone']) {
        const share = early ? (k === 'food' ? 0.5 : k === 'wood' ? 0.5 : k === 'gold' ? 0 : 0) : SHARE[k];
        if (game.rules && game.rules.id === 'deathmatch' && (k === 'gold' || k === 'stone')) continue;
        const def = share * total - cnt[k]; if (def > bestDef) { bestDef = def; kind = k; }
      }
      // find the closest resource of this kind near a dropsite
      let res = null, bs = Infinity;
      for (const r of known) if (RES_KIND[r.type] === kind && r.amount > 0) { const s = dist(r, v) + 1.5 * Math.min(dropDist(kind, r, done), 25); if (s < bs) { bs = s; res = r; } }
      if (kind === 'food') { // prefer farms once berries are far away
        const farms = done.filter(b => b.gatherType === 'food' && b.amount > 0);
        const nearestFarm = farms.sort((a, b) => dist(a, v) - dist(b, v))[0];
        if (!res || dist(res, home) > 12) {
          if (nearestFarm && farms.length * 2 > cnt.food) res = nearestFarm;
          else if (me.res.wood >= 60 && tryBuild('farm', [v], home)) { cnt.food++; continue; }
        }
      }
      if (!res) { if (kind !== 'wood') { cnt[kind] = 99; } continue; }
      // far from any dropsite -> build one there first
      if (res.kind === 'resource' && dropDist(kind, res, done) > 10) {
        const type = kind === 'food' ? 'granary' : 'storage_pit', sp = spotNear(type, res, false);
        if (sp && !mine('buildings').some(b => !b.constructed && b.type === type) && canAfford(me, BUILDINGS[type].cost) && cmd({ type: 'build', ids: [v.id], building: type, x: sp.x, y: sp.y })) continue;
      }
      if (cmd({ type: 'gather', ids: [v.id], resourceId: res.id })) cnt[kind]++;
    }
  }

  function orderArmy(army, enemies, home, roundId, vis) {
    if (!army.length) return;
    const threats = enemies.filter(e => e.kind === 'unit' && e.cls !== 'civ' && dist(e, home) < 14);
    const idle = army.filter(u => u.order.type === 'idle');
    // relics: send the nearest free soldier to each loose relic (idle or mid-wave), one per relic
    if (roundId === 'relics') {
      const assigned = new Set(army.filter(a => a.order.type === 'relic').map(a => a.order.relic));
      for (const r of game.relics.values()) {
        if (r.holder !== null || r.stored !== null || assigned.has(r.id)) continue;
        const u = army.filter(a => a.relic === null && a.cls !== 'siege' && a.order.type !== 'relic').sort((a, b) => dist(a, r) - dist(b, r))[0];
        if (u && dist(u, r) < 40) { cmd({ type: 'relic', ids: [u.id], relicId: r.id }); assigned.add(r.id); }
      }
    }
    if (threats.length) {
      const t = threats.sort((a, b) => dist(a, home) - dist(b, home))[0];
      for (const u of idle) cmd({ type: 'attack', ids: [u.id], targetId: t.id });
      return;
    }
    const combat = army;
    const rush = roundId === 'wonder'; // contest the Wonder while it is being built
    // Death Match: whoever attacks piecemeal loses to defenders, so wait for a big army (bigger for harder bots)
    const dmWave = { easy: 24, medium: 32, hard: 38 }[difficulty];
    const needWave = rush ? 5 : roundId === 'deathmatch' ? dmWave : D.wave, needTime = rush ? 3600 : roundId === 'deathmatch' ? 6000 : D.attackAt;
    if (!bot.waveActive && game.time >= needTime && combat.length >= needWave) bot.waveActive = true;
    if (bot.waveActive && combat.length < 3) bot.waveActive = false;
    if (!bot.waveActive) return;
    const cx = combat.reduce((s, u) => s + u.x, 0) / combat.length, cy = combat.reduce((s, u) => s + u.y, 0) / combat.length, c = { x: cx, y: cy };
    let target = null;
    const king = roundId === 'regicide' ? enemies.find(e => e.type === 'king') : null;
    const wonder = roundId === 'wonder' ? enemies.find(e => e.type === 'wonder') : null;
    let vault = null;
    if (roundId === 'relics') { const ids = new Set([...game.relics.values()].filter(r => r.stored !== null && game.relicOwner(r) === enemy).map(r => r.stored)); vault = enemies.find(e => ids.has(e.id)); }
    if (king) target = king; else if (wonder) target = wonder; else if (vault) target = vault;
    if (!target) target = enemies.filter(e => e.kind === 'unit' && e.cls !== 'civ').sort((a, b) => dist(a, c) - dist(b, c))[0]
      || enemies.filter(e => e.kind === 'building').sort((a, b) => dist(a, c) - dist(b, c))[0]
      || enemies.filter(e => e.kind === 'unit').sort((a, b) => dist(a, c) - dist(b, c))[0];
    for (const u of idle) {
      if (u.relic !== null) continue;
      if (target) cmd({ type: 'attack', ids: [u.id], targetId: target.id });
      else {
        let wp = sweep[bot.sweepIdx % sweep.length];
        if (dist(u, wp) < 4) { bot.sweepIdx++; wp = sweep[bot.sweepIdx % sweep.length]; }
        cmd({ type: 'move', ids: [u.id], x: wp.x + 0.5, y: wp.y + 0.5 });
      }
    }
  }
  return bot;
}
