// Headless bot-vs-bot match runner. Used by the test harness and for off-screen bracket matches.
import { createGame } from '../sim/game.js';
import { createBot } from '../ai/bot.js';
import { roundById } from '../rounds/index.js';

export function simulateMatch(roundId, seed, diffs = ['medium', 'medium'], opts = {}) {
  const rules = roundById(roundId), out = { ended: false, winner: null, reason: null, ticks: 0, errors: [], maxRejects: 0, cap: rules.capTicks };
  const g = createGame({ seed, rules }), bots = [createBot(g, 0, diffs[0]), createBot(g, 1, diffs[1])];
  const every = { easy: 30, medium: 15, hard: 10 }, limit = opts.limit || rules.capTicks + 50;
  try {
    while (!g.result && g.time < limit) {
      g.tick();
      for (let i = 0; i < 2; i++) if (g.time % every[diffs[i]] === (i * 3) % every[diffs[i]]) bots[i].think();
      if (g.time % 20 === 0) checkInvariants(g, out.errors);
      if (out.errors.length > 5) break;
    }
  } catch (e) { out.errors.push('exception: ' + (e.stack || e).toString().split('\n').slice(0, 3).join(' | ')); }
  out.ticks = g.time; out.ended = !!g.result; out.winner = g.result?.winner ?? null; out.reason = g.result?.reason ?? null;
  out.maxRejects = Math.max(...bots.map(b => b.maxRejects)); out.scores = g.result?.scores;
  out.final = g.players.map(p => ({ age: p.age, pop: p.pop, kills: p.kills, bdestroyed: p.bdestroyed }));
  out.game = opts.keepGame ? g : undefined;
  return out;
}

function checkInvariants(g, errors) {
  for (const p of g.players) {
    for (const [k, v] of Object.entries(p.res)) { if (!Number.isFinite(v)) errors.push(`NaN resource ${k} at ${g.time}`); else if (v < -1e-6) errors.push(`negative ${k}=${v} at ${g.time}`); }
    if (p.pop > 50) errors.push(`pop ${p.pop} > 50 at ${g.time}`);
  }
  for (const u of g.units.values()) if (!Number.isFinite(u.x) || !Number.isFinite(u.y) || !Number.isFinite(u.hp)) { errors.push(`bad unit ${u.type}#${u.id} at ${g.time}`); break; }
}
