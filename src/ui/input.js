import { BUILDINGS } from '../data/buildings.js';
import { canPlace, canAfford } from '../sim/commands.js';

export function createInput(ui) {
  const el = document.getElementById('viewport'), keys = new Set(), drag = { on: false, x: 0, y: 0, moved: false }, box = document.getElementById('dragbox');
  let mouse = { x: 0, y: 0 }, lastClick = { t: 0, id: -1 };
  const g = () => ui.game;
  const selectedUnitIds = () => [...ui.sel].filter(id => g().entities.get(id)?.kind === 'unit');
  const setSel = ids => { ui.sel.clear(); for (const i of ids) ui.sel.add(i); ui.inspect = null; };

  function tileForPlacing(cx, cy) {
    const p = ui.view.pickGround(cx, cy); if (!p) return null; const s = BUILDINGS[ui.placing].size;
    return { x: Math.round(p.x - s / 2), y: Math.round(p.y - s / 2) };
  }
  el.addEventListener('mousedown', e => { if (e.button !== 0) return; drag.on = true; drag.x = e.clientX; drag.y = e.clientY; drag.moved = false; });
  window.addEventListener('mousemove', e => {
    mouse = { x: e.clientX, y: e.clientY };
    if (drag.on) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) drag.moved = true;
      if (drag.moved && !ui.placing) { box.classList.remove('hidden'); Object.assign(box.style, { left: Math.min(drag.x, e.clientX) + 'px', top: Math.min(drag.y, e.clientY) + 'px', width: Math.abs(e.clientX - drag.x) + 'px', height: Math.abs(e.clientY - drag.y) + 'px' }); }
    }
  });
  window.addEventListener('mouseup', e => {
    if (e.button !== 0 || !drag.on) return; drag.on = false; box.classList.add('hidden');
    if (!el.contains(e.target)) return;
    if (ui.placing) return place(e);
    if (drag.moved) return boxSelect(drag.x, drag.y, e.clientX, e.clientY);
    click(e);
  });
  function click(e) {
    const ent = ui.view.pickEntity(e.clientX, e.clientY);
    if (!ent) { setSel([]); return; }
    if (ent.kind === 'unit' && ent.owner === 0 || ent.kind === 'building' && ent.owner === 0) {
      const now = performance.now();
      if (e.shiftKey) { if (ui.sel.has(ent.id)) ui.sel.delete(ent.id); else ui.sel.add(ent.id); }
      else if (ent.kind === 'unit' && now - lastClick.t < 350 && lastClick.id === ent.id) {
        const same = g().visibleEntities(0).filter(u => u.owner === 0 && u.type === ent.type && onScreen(u)); setSel(same.map(u => u.id));
      } else setSel([ent.id]);
      lastClick = { t: now, id: ent.id };
    } else { setSel([]); ui.inspect = ent; }
  }
  const onScreen = u => { const p = ui.view.project(u.x, u.y), r = el.getBoundingClientRect(); return p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom; };
  function boxSelect(x0, y0, x1, y1) {
    const [xa, xb] = [Math.min(x0, x1), Math.max(x0, x1)], [ya, yb] = [Math.min(y0, y1), Math.max(y0, y1)];
    const inBox = e => { const c = e.kind === 'building' ? { x: e.x + e.size / 2, y: e.y + e.size / 2 } : e, p = ui.view.project(c.x, c.y); return p.x >= xa && p.x <= xb && p.y >= ya && p.y <= yb; };
    const mine = g().visibleEntities(0).filter(e => e.owner === 0 && inBox(e));
    const units = mine.filter(e => e.kind === 'unit'); const pick = units.length ? units : mine.filter(e => e.kind === 'building').slice(0, 1);
    if (e_shift()) for (const u of pick) ui.sel.add(u.id); else setSel(pick.map(u => u.id));
  }
  let shiftDown = false; const e_shift = () => shiftDown;
  window.addEventListener('keydown', e => { shiftDown = e.shiftKey; keys.add(e.key.toLowerCase()); onKey(e); });
  window.addEventListener('keyup', e => { shiftDown = e.shiftKey; keys.delete(e.key.toLowerCase()); });
  function place(e) {
    const t = tileForPlacing(e.clientX, e.clientY); if (!t) return;
    const vills = selectedUnitIds().filter(id => g().entities.get(id).type === 'villager');
    const r = ui.cmd({ type: 'build', ids: vills, building: ui.placing, x: t.x, y: t.y });
    if (r.ok && !shiftDown) ui.stopPlacing();
  }
  el.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (ui.placing) return ui.stopPlacing();
    const ids = selectedUnitIds(); if (!ids.length) return;
    const t = ui.view.pickEntity(e.clientX, e.clientY), gp = ui.view.pickGround(e.clientX, e.clientY);
    const vids = ids.filter(id => g().entities.get(id).type === 'villager');
    let r = null;
    if (t && (t.kind === 'unit' || t.kind === 'building') && t.owner === 1) r = ui.cmd({ type: 'attack', ids, targetId: t.id });
    else if (t && t.kind === 'resource') r = ui.cmd({ type: 'gather', ids: vids, resourceId: t.id });
    else if (t && t.kind === 'building' && t.owner === 0 && t.gatherType && t.constructed) r = ui.cmd({ type: 'gather', ids: vids, resourceId: t.id });
    else if (t && t.kind === 'building' && t.owner === 0 && !t.constructed) r = ui.cmd({ type: 'construct', ids: vids, targetId: t.id });
    else if (t && t.kind === 'relic') r = ui.cmd({ type: 'relic', ids, relicId: t.id });
    else if (gp) r = ui.cmd({ type: 'move', ids, x: gp.x, y: gp.y });
    if (r && r.ok && gp) ui.marker(gp.x, gp.y);
  });
  el.addEventListener('wheel', e => { e.preventDefault(); ui.view.setZoom(ui.view.zoom * (e.deltaY > 0 ? 1.1 : 0.9)); }, { passive: false });
  function onKey(e) {
    if (e.key === 'Escape') { ui.stopPlacing(); setSel([]); }
    else if (e.key === '.') { const idle = g().visibleEntities(0).filter(u => u.owner === 0 && u.type === 'villager' && u.order.type === 'idle'); if (idle.length) { ui.idleIdx = (ui.idleIdx || 0) % idle.length; const u = idle[ui.idleIdx++]; setSel([u.id]); ui.view.centerOn(u.x, u.y); } }
    else if (e.key.toLowerCase() === 'h') { const tc = [...g().buildings.values()].find(b => b.owner === 0 && b.type === 'town_center'); if (tc) { ui.view.centerOn(tc.x + 1.5, tc.y + 1.5); setSel([tc.id]); } }
    else if (e.key === ' ') { e.preventDefault(); ui.togglePause(); }
    else if (e.key === '+' || e.key === '=') ui.view.setZoom(ui.view.zoom * 0.9); else if (e.key === '-') ui.view.setZoom(ui.view.zoom * 1.1);
  }
  const mm = document.getElementById('minimap');
  mm.addEventListener('mousedown', e => { const r = mm.getBoundingClientRect(), w = ui.minimap.toWorld((e.clientX - r.left) * mm.width / r.width, (e.clientY - r.top) * mm.height / r.height); if (e.button === 0) ui.view.centerOn(w.x, w.y); else if (e.button === 2) { const ids = selectedUnitIds(); if (ids.length) ui.cmd({ type: 'move', ids, x: w.x, y: w.y }); } });
  mm.addEventListener('contextmenu', e => e.preventDefault());
  return { update(dt) {
    const s = 22 * dt * (ui.view.zoom / 14);
    let dx = 0, dz = 0;
    if (keys.has('a') || keys.has('arrowleft')) { dx -= 1; dz += 1; } if (keys.has('d') || keys.has('arrowright')) { dx += 1; dz -= 1; }
    if (keys.has('w') || keys.has('arrowup')) { dx -= 1; dz -= 1; } if (keys.has('s') || keys.has('arrowdown')) { dx += 1; dz += 1; }
    if (dx || dz) ui.view.pan(dx * s * 0.7, dz * s * 0.7);
    if (ui.placing) { const t = tileForPlacing(mouse.x, mouse.y); if (t) { const ok = canPlace(g(), 0, ui.placing, t.x, t.y) && canAfford(g().players[0], BUILDINGS[ui.placing].cost); ui.view.showGhost(ui.placing, t.x, t.y, ok); } }
  } };
}
