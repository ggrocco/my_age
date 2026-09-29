import { makeRng } from './rng.js';
import { findPath } from './path.js';
// 180-degree rotationally symmetric map so both players get identical terrain and resources.
export function generateMap(seed, size = 64) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const m = build(seed + attempt * 1000, size);
    const blocked = (x, y) => m.resources.some(r => Math.floor(r.x) === x && Math.floor(r.y) === y);
    if (findPath(m, blocked, m.starts[0], m.starts[1]) !== null) return m;
  }
  throw new Error('map generation failed for seed ' + seed);
}
function build(seed, size) {
  const rng = makeRng(seed), tiles = new Uint8Array(size * size), rot = (x, y) => ({ x: size - 1 - x, y: size - 1 - y });
  const s0 = { x: 10, y: 14 + rng.int(size - 28) }, s1 = rot(s0.x, s0.y);
  const far = (x, y) => Math.hypot(x - s0.x, y - s0.y) > 13 && Math.hypot(x - s1.x, y - s1.y) > 13 && Math.hypot(x - size / 2, y - size / 2) > 9;
  for (let b = 0; b < 3 + rng.int(3); b++) {
    const cx = rng.int(size), cy = rng.int(size), r = 2 + rng.int(4);
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (Math.hypot(x - cx, y - cy) > r || x < 0 || y < 0 || x >= size || y >= size) continue;
      if (!far(x, y)) continue; const q = rot(x, y); if (!far(q.x, q.y)) continue;
      tiles[y * size + x] = 1; tiles[q.y * size + q.x] = 1;
    }
  }
  const resources = [], taken = new Set(), key = (x, y) => y * size + x; let nid = 0;
  const ok = (x, y) => x >= 1 && y >= 1 && x < size - 1 && y < size - 1 && !tiles[key(x, y)] && !taken.has(key(x, y));
  const place = (type, x, y, amount, mirror = true) => {
    const pts = mirror ? [[x, y], [size - 1 - x, size - 1 - y]] : [[x, y]];
    for (const [px, py] of pts) if (ok(px, py)) { taken.add(key(px, py)); resources.push({ id: 'r' + nid++, type, x: px + 0.5, y: py + 0.5, amount }); }
  };
  const AMOUNT = { tree: 100, berry: 200, gold: 800, stone: 600 };
  const ring = (type, count, rMin, rMax) => {
    for (let k = 0, placed = 0; placed < count && k < 200; k++) {
      const a = rng.next() * Math.PI * 2, r = rMin + rng.next() * (rMax - rMin);
      const x = Math.round(s0.x + Math.cos(a) * r), y = Math.round(s0.y + Math.sin(a) * r);
      if (Math.abs(x - s0.x) <= 2 && Math.abs(y - s0.y) <= 2) continue;
      const before = resources.length; place(type, x, y, AMOUNT[type]); if (resources.length > before) placed++;
    }
  };
  ring('berry', 6, 6, 8); ring('gold', 4, 9, 13); ring('stone', 3, 9, 13);
  for (let c = 0; c < 2; c++) { // a tree clump near start + scattered forests
    const a = rng.next() * Math.PI * 2, cx = s0.x + Math.cos(a) * 9, cy = s0.y + Math.sin(a) * 9;
    for (let k = 0; k < 14; k++) place('tree', Math.round(cx + (rng.next() - 0.5) * 6), Math.round(cy + (rng.next() - 0.5) * 6), AMOUNT.tree);
  }
  for (let f = 0; f < 8; f++) {
    const cx = rng.int(size), cy = rng.int(size);
    for (let k = 0; k < 10; k++) { const x = Math.round(cx + (rng.next() - 0.5) * 7), y = Math.round(cy + (rng.next() - 0.5) * 7); if (far(x, y)) place('tree', x, y, AMOUNT.tree); }
  }
  const c = size / 2 | 0;
  const relicSpots = [[c, c], [c - 4, c - 6], [c + 4, c + 6], [c - 6, c + 4], [c + 6, c - 4]].map(([x, y]) => ({ x: x + 0.5, y: y + 0.5 }));
  for (const r of relicSpots) tiles[Math.floor(r.y) * size + Math.floor(r.x)] = 0;
  const relicKeys = new Set(relicSpots.map(r => key(Math.floor(r.x), Math.floor(r.y))));
  return { size, tiles, resources: resources.filter(r => !relicKeys.has(key(Math.floor(r.x), Math.floor(r.y)))), starts: [s0, s1], relicSpots };
}
