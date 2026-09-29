import { findPath } from './path.js';
import { BUILDINGS } from '../data/buildings.js';
import { DT, distPoint, centerOf, tileOf, RES_KIND } from './util.js';

const REACH = 1.0, CARRY = 10, RATE = { food: 0.7, wood: 0.6, gold: 0.5, stone: 0.5 };
const IDLE = () => ({ type: 'idle' });
const goalNear = (t, r) => (x, y) => distPoint(x + 0.5, y + 0.5, t) <= r;

// Move along the current path (computing it if needed). 'arrived' | 'moving' | 'wait' | 'fail'
function travel(game, u, goal, to) {
  if (!u.path) {
    if (u.retry > game.time) return 'wait';
    u.path = findPath(game.map, game.blocked, { x: Math.floor(u.x), y: Math.floor(u.y) }, to, goal);
    if (!u.path) { u.retry = game.time + 40; return 'fail'; }
    if (u.path.length === 0) { u.path = null; u.x = Math.floor(u.x) + 0.5; u.y = Math.floor(u.y) + 0.5; return 'arrived'; }
  }
  const w = u.path[0];
  if (game.occAt(w.x, w.y)) { u.path = null; return 'moving'; }
  const tx = w.x + 0.5, ty = w.y + 0.5, dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy), step = u.speed * DT;
  if (d <= step) { u.x = tx; u.y = ty; u.path.shift(); if (!u.path.length) { u.path = null; return 'arrived'; } }
  else { u.x += dx / d * step; u.y += dy / d * step; }
  return 'moving';
}
const stop = u => { u.order = IDLE(); u.path = null; };

export function updateUnit(game, u) {
  if (u.cd > 0) u.cd--;
  const o = u.order;
  switch (o.type) {
    case 'idle': return aggro(game, u);
    case 'move': return doMove(game, u, o);
    case 'gather': return doGather(game, u, o);
    case 'build': return doBuild(game, u, o);
    case 'attack': return doAttack(game, u, o);
    case 'relic': return doRelic(game, u, o);
  }
}

function doMove(game, u, o) {
  const to = { x: Math.floor(o.x), y: Math.floor(o.y) };
  const r = travel(game, u, (x, y) => Math.abs(x - to.x) <= o.slack && Math.abs(y - to.y) <= o.slack, to);
  if (r === 'arrived') return stop(u);
  if (r === 'fail') { if (o.slack < 2) { o.slack = 2; u.retry = 0; } else stop(u); }
}

function nearestResource(game, u, kind, maxDist) {
  let best = null, bd = maxDist;
  const consider = e => { const d = Math.hypot(e.x - u.x, e.y - u.y); if (d < bd) { bd = d; best = e; } };
  for (const r of game.resources.values()) if (RES_KIND[r.type] === kind && r.amount > 0) consider(r);
  if (kind === 'food') for (const b of game.buildings.values()) if (b.owner === u.owner && b.constructed && b.gatherType === 'food' && b.amount > 0) consider(b);
  return best;
}
function nearestDrop(game, u, kind) {
  let best = null, bd = Infinity;
  for (const b of game.buildings.values()) {
    if (b.owner !== u.owner || !b.constructed || !(BUILDINGS[b.type].drops || []).includes(kind)) continue;
    const d = distPoint(u.x, u.y, b); if (d < bd) { bd = d; best = b; }
  }
  return best;
}
const gatherKind = r => r.gatherType || RES_KIND[r.type];

function doGather(game, u, o) {
  let res = game.entities.get(o.res);
  const kind = o.kind;
  if (!res || res.dead || res.amount <= 0 || (res.kind === 'building' && !res.constructed)) {
    if (o.phase === 'work') o.phase = u.carry.amount > 0 ? 'drop' : 'go';
    res = nearestResource(game, u, kind, 12);
    if (!res) { if (u.carry.amount > 0) { o.res = -1; o.phase = 'drop'; } else return stop(u); }
    else { o.res = res.id; u.path = null; }
  }
  if (o.phase === 'go') {
    if (!res) return stop(u);
    if (distPoint(u.x, u.y, res) <= REACH) { o.phase = 'work'; u.path = null; return; }
    const r = travel(game, u, goalNear(res, 0.95), centerOf(res));
    if (r === 'fail') { if (++o.fails > 3) stop(u); else o.res = -1; }
  } else if (o.phase === 'work') {
    const rate = RATE[kind] * DT;
    if (u.carry.type !== kind) u.carry = { type: kind, amount: 0 };
    const take = Math.min(rate, res.amount); res.amount -= take; u.carry.amount += take; game.players[u.owner].gathered += take;
    if (res.amount <= 0) game.depleted(res);
    if (u.carry.amount >= CARRY || res.amount <= 0) { o.phase = 'drop'; u.path = null; }
  } else { // drop
    if (u.carry.amount <= 0) { o.phase = 'go'; return; }
    const d = nearestDrop(game, u, u.carry.type);
    if (!d) return stop(u);
    if (distPoint(u.x, u.y, d) <= REACH) {
      game.players[u.owner].res[u.carry.type] += u.carry.amount; u.carry = { type: null, amount: 0 };
      o.phase = 'go'; u.path = null; return;
    }
    const r = travel(game, u, goalNear(d, 0.95), centerOf(d));
    if (r === 'fail' && ++o.fails > 3) stop(u);
  }
}

function doBuild(game, u, o) {
  const b = game.entities.get(o.target);
  if (!b || b.dead) return stop(u);
  if (b.constructed) {
    if (b.gatherType && b.amount > 0) { u.order = { type: 'gather', res: b.id, kind: 'food', phase: 'go', fails: 0 }; u.path = null; }
    else stop(u);
    return;
  }
  if (distPoint(u.x, u.y, b) <= REACH) { b.workers++; u.path = null; return; }
  const r = travel(game, u, goalNear(b, 0.95), centerOf(b));
  if (r === 'fail') { o.fails = (o.fails || 0) + 1; if (o.fails > 3) stop(u); }
}

export function hit(game, u, t) {
  let dmg = Math.max(1, u.atk - (t.armor || 0));
  if (t.kind === 'building' && u.cls !== 'siege') dmg *= 0.5;
  game.damage(t, dmg, u);
  if (u.splash) {
    const c = centerOf(t);
    for (const list of [game.units, game.buildings]) for (const e of [...list.values()]) {
      if (e === t || e.dead || e.owner === u.owner) continue;
      if (distPoint(c.x, c.y, e) <= u.splash) game.damage(e, dmg * 0.5, u);
    }
  }
}

function doAttack(game, u, o) {
  const t = game.entities.get(o.target);
  if (!t || t.dead || t.owner === u.owner || (t.kind !== 'unit' && t.kind !== 'building')) return stop(u);
  if (distPoint(u.x, u.y, t) <= u.range + 0.1) {
    u.path = null;
    if (u.cd === 0) { u.cd = u.cooldown; hit(game, u, t); }
    return;
  }
  const tt = tileOf(t), key = tt.x + ',' + tt.y;
  if (u.path && o.last !== key && (game.time + u.id) % 5 === 0) u.path = null;
  o.last = key;
  const r = travel(game, u, goalNear(t, Math.max(0.9, u.range - 0.5)), tt);
  if (r === 'fail' && ++o.fails > 3) stop(u);
}

function aggro(game, u) {
  if (u.cls === 'civ' || (game.time + u.id) % 5 !== 0) return;
  let best = null, bd = u.sight + 1;
  for (const e of game.units.values()) {
    if (e.owner === u.owner) continue;
    const d = Math.hypot(e.x - u.x, e.y - u.y) - (e.cls === 'civ' ? 0.5 : 0); if (d < bd) { bd = d; best = e; }
  }
  if (!best) for (const e of game.buildings.values()) {
    if (e.owner === u.owner) continue;
    const d = distPoint(u.x, u.y, e) + 2; if (d < bd) { bd = d; best = e; }
  }
  if (best) { u.order = { type: 'attack', target: best.id, fails: 0, auto: true }; u.path = null; }
}

function doRelic(game, u, o) {
  const r = game.relics.get(o.relic);
  if (o.phase === 'go') {
    if (!r || r.holder !== null || r.stored !== null) return stop(u);
    if (Math.hypot(r.x - u.x, r.y - u.y) <= REACH) { r.holder = u.id; u.relic = r.id; o.phase = 'store'; u.path = null; return; }
    const t = { x: Math.floor(r.x), y: Math.floor(r.y) };
    const res = travel(game, u, (x, y) => x === t.x && y === t.y, t);
    if (res === 'fail' && ++o.fails > 3) stop(u);
  } else {
    if (u.relic === null) return stop(u);
    let d = null, bd = Infinity;
    for (const b of game.buildings.values()) {
      if (b.owner !== u.owner || !b.constructed || !(b.type === 'town_center' || b.type === 'government_center')) continue;
      const dd = distPoint(u.x, u.y, b); if (dd < bd) { bd = dd; d = b; }
    }
    if (!d) return stop(u);
    if (bd <= REACH) { const rl = game.relics.get(u.relic); rl.holder = null; rl.stored = d.id; u.relic = null; return stop(u); }
    const res = travel(game, u, goalNear(d, 0.95), centerOf(d));
    if (res === 'fail' && ++o.fails > 3) stop(u);
  }
}
