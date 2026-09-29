// Round rules. check(game) returns null or {winner, reason}. Every round has capTicks and a score tiebreak.
export const WONDER_TICKS = 3600, RELIC_TICKS = 3600;

export function scoreOf(game, pid) {
  const p = game.players[pid]; let units = 0, blds = 0;
  for (const u of game.units.values()) if (u.owner === pid) units++;
  for (const b of game.buildings.values()) if (b.owner === pid && !b.gatherType) blds++;
  return p.kills + 3 * p.bdestroyed + p.gathered / 50 + 2 * blds + units / 2;
}
const tiebreak = (game, reason, bonus = [0, 0]) => {
  const s = [scoreOf(game, 0) + bonus[0], scoreOf(game, 1) + bonus[1]];
  return { winner: s[1] > s[0] ? 1 : 0, reason, scores: s };
};
export const isEliminated = (game, pid) => {
  for (const u of game.units.values()) if (u.owner === pid) return false;
  for (const b of game.buildings.values()) if (b.owner === pid && !b.gatherType) return false;
  return true;
};
function conquest(game, capReason, bonus) {
  const d = [isEliminated(game, 0), isEliminated(game, 1)];
  if (d[0] && d[1]) return tiebreak(game, 'mutual destruction');
  if (d[0]) return { winner: 1, reason: 'conquest' };
  if (d[1]) return { winner: 0, reason: 'conquest' };
  return null;
}
const capCheck = (game, cap, bonus) => game.time >= cap ? tiebreak(game, 'time cap', bonus) : null;
const setAll = (game, v) => { for (const p of game.players) p.res = { food: v, wood: v, gold: v, stone: v }; };

export const ROUNDS = [
  { id: 'conquest', name: 'Standard Game', desc: 'Destroy all enemy units and buildings.', capTicks: 30000,
    setup() {}, check(game) { return conquest(game) || capCheck(game, 30000); } },
  { id: 'deathmatch', name: 'Death Match', desc: 'Start with 20000 of every resource. Destroy the enemy.', capTicks: 24000,
    setup(game) { setAll(game, 20000); }, check(game) { return conquest(game) || capCheck(game, 24000); } },
  { id: 'regicide', name: 'Regicide', desc: 'Kill the enemy king. Protect yours.', capTicks: 30000,
    setup(game) {
      game.roundState = { kings: [] };
      for (const [i, s] of game.map.starts.entries()) {
        const tc = [...game.buildings.values()].find(b => b.owner === i), sp = game.findSpawn(tc);
        game.roundState.kings.push(game.spawnUnit('king', i, sp.x, sp.y).id);
      }
    },
    check(game) {
      const dead = game.roundState.kings.map(id => !game.entities.has(id));
      if (dead[0] && dead[1]) return tiebreak(game, 'both kings fell');
      if (dead[0]) return { winner: 1, reason: 'regicide' }; if (dead[1]) return { winner: 0, reason: 'regicide' };
      return conquest(game) || capCheck(game, 30000);
    } },
  { id: 'wonder', name: 'Wonder Race', desc: 'Build a Wonder (Bronze Age) and keep it standing for 3 minutes.', capTicks: 30000,
    setup(game) { setAll(game, 3000); game.roundState = { hold: [0, 0], need: WONDER_TICKS }; },
    check(game) {
      const st = game.roundState, has = [false, false];
      for (const b of game.buildings.values()) if (b.type === 'wonder' && b.constructed) has[b.owner] = true;
      for (const i of [0, 1]) st.hold[i] = has[i] ? st.hold[i] + 1 : 0;
      const w = st.hold.map(h => h >= st.need);
      if (w[0] || w[1]) return w[0] && w[1] ? tiebreak(game, 'wonder') : { winner: w[0] ? 0 : 1, reason: 'wonder' };
      return conquest(game) || capCheck(game, 30000, st.hold.map(h => h / 20));
    } },
  { id: 'relics', name: 'Capture the Relics', desc: 'Hold all 5 relics in your Town Center for 3 minutes.', capTicks: 30000,
    setup(game) { game.roundState = { hold: [0, 0], need: RELIC_TICKS }; for (const s of game.map.relicSpots) game.spawnRelic(s.x, s.y); },
    check(game) {
      const st = game.roundState, count = [0, 0];
      for (const r of game.relics.values()) { const o = game.relicOwner(r); if (o !== null) count[o]++; }
      const total = game.relics.size;
      for (const i of [0, 1]) st.hold[i] = count[i] === total && total > 0 ? st.hold[i] + 1 : 0;
      st.count = count;
      const w = st.hold.map(h => h >= st.need);
      if (w[0] || w[1]) return { winner: w[0] ? 0 : 1, reason: 'relics' };
      return conquest(game) || capCheck(game, 30000, count.map(c => c * 5));
    } },
];
export const roundById = id => ROUNDS.find(r => r.id === id);
