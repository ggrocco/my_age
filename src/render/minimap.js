import { OWNER_COLOR } from './view.js';
// Diamond (isometric) minimap. Sim (x,y) -> canvas via rotation so it matches the main view orientation.
export function createMinimap(canvas, game, view) {
  const N = game.map.size, ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, sc = W / (2 * N) * 0.98;
  const toCanvas = (x, y) => ({ x: W / 2 + (x - y) * sc, y: H / 2 + (x + y - N) * sc * 0.5 });
  const toWorld = (cx, cy) => { const a = (cx - W / 2) / sc, b = (cy - H / 2) / (sc * 0.5) + N; return { x: (a + b) / 2, y: (b - a) / 2 }; };
  const hex = c => '#' + c.toString(16).padStart(6, '0');
  const terrain = document.createElement('canvas'); terrain.width = W; terrain.height = H; const tctx = terrain.getContext('2d');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const p = toCanvas(x + 0.5, y + 0.5); tctx.fillStyle = game.map.tiles[y * N + x] === 1 ? '#2b5f8c' : '#4a7a35'; tctx.fillRect(p.x - sc, p.y - sc * 0.5, sc * 2 + 0.5, sc + 0.5); }
  const RC = { tree: '#1f4d1f', berry: '#b0208f', gold: '#facc15', stone: '#9ca3af' };
  const mm = { draw() {
    ctx.fillStyle = '#0a0d09'; ctx.fillRect(0, 0, W, H); ctx.drawImage(terrain, 0, 0);
    const pl = game.players[0];
    for (const r of game.knownResources(0)) { const p = toCanvas(r.x, r.y); ctx.fillStyle = RC[r.type]; ctx.fillRect(p.x - 1, p.y - 1, 2, 2); }
    for (const e of game.visibleEntities(0)) {
      if (e.kind === 'relic') { const p = toCanvas(e.x, e.y); ctx.fillStyle = '#fde047'; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); continue; }
      const c = e.kind === 'building' ? { x: e.x + e.size / 2, y: e.y + e.size / 2 } : e, p = toCanvas(c.x, c.y), s = e.kind === 'building' ? 4 : 2.5;
      ctx.fillStyle = hex(OWNER_COLOR[e.owner]); ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    // fog shading
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    for (let y = 0; y < N; y += 1) for (let x = 0; x < N; x += 1) { const i = y * N + x; if (pl.visible[i]) continue; const p = toCanvas(x + 0.5, y + 0.5); ctx.fillStyle = pl.explored[i] ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.88)'; ctx.fillRect(p.x - sc, p.y - sc * 0.5, sc * 2, sc); }
    const f = view.focus, a = view.zoom * (view.dom.clientWidth / view.dom.clientHeight), b = view.zoom;
    const c = toCanvas(f.x, f.z), w = a * sc * 0.7, h = b * sc * 0.75;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(c.x - w, c.y - h, w * 2, h * 2);
  }, toWorld };
  return mm;
}
