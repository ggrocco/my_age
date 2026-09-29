// A* on a tile grid. 8-neighbour, no corner cutting. Returns tiles after `from` up to the goal,
// [] if already there, null if unreachable. isGoal lets callers stop next to a blocked target.
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(n) { const a = this.a; a.push(n); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && a[l].f < a[m].f) m = l; if (r < a.length && a[r].f < a[m].f) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
}
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const MAX_EXPAND = 6000;
export function findPath(map, blocked, from, to, isGoal) {
  const n = map.size;
  const goal = isGoal || ((x, y) => x === to.x && y === to.y);
  if (goal(from.x, from.y)) return [];
  const free = (x, y) => x >= 0 && y >= 0 && x < n && y < n && map.tiles[y * n + x] !== 1 && !blocked(x, y);
  if (!isGoal && !free(to.x, to.y)) return null;
  const g = new Float32Array(n * n).fill(Infinity), prev = new Int32Array(n * n).fill(-1), closed = new Uint8Array(n * n);
  const h = (x, y) => { const dx = Math.abs(x - to.x), dy = Math.abs(y - to.y); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  const open = new Heap(); const s = from.y * n + from.x; g[s] = 0; open.push({ i: s, f: h(from.x, from.y) });
  let expanded = 0;
  while (open.size && expanded++ < MAX_EXPAND) {
    const { i } = open.pop(); if (closed[i]) continue; closed[i] = 1;
    const x = i % n, y = (i / n) | 0;
    if (goal(x, y)) { const out = []; for (let k = i; k !== s; k = prev[k]) out.push({ x: k % n, y: (k / n) | 0 }); return out.reverse(); }
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!free(nx, ny)) continue;
      if (dx && dy && (!free(x + dx, y) || !free(x, y + dy))) continue;
      const j = ny * n + nx, ng = g[i] + (dx && dy ? 1.414 : 1);
      if (ng < g[j]) { g[j] = ng; prev[j] = i; open.push({ i: j, f: ng + h(nx, ny) }); }
    }
  }
  return null;
}
