import { centerOf } from './util.js';
export function updateVision(game) {
  const n = game.map.size;
  for (const p of game.players) p.visible.fill(0);
  for (const list of [game.units, game.buildings]) for (const e of list.values()) {
    const vis = game.players[e.owner].visible, c = centerOf(e), r = Math.ceil(e.sight + (e.size ? e.size / 2 : 0));
    const cx = Math.floor(c.x), cy = Math.floor(c.y);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= n || y >= n) continue;
      vis[y * n + x] = 1;
    }
  }
  for (const p of game.players) for (let i = 0; i < p.visible.length; i++) if (p.visible[i]) p.explored[i] = 1;
}
export function visibleTo(game, pid, x, y) {
  const n = game.map.size, p = game.players[pid], i = Math.floor(y) * n + Math.floor(x);
  return p.visible[i] ? 'visible' : p.explored[i] ? 'explored' : 'hidden';
}
