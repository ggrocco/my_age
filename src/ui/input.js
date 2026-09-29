import { BUILDINGS } from '../data/buildings.js';
import { canPlace, canAfford } from '../sim/commands.js';

// Mouse + keyboard (desktop) and touch (phone) input. Both paths share selectAt/orderAt so behaviour matches.
export function createInput(ui) {
  const el = document.getElementById('viewport'), keys = new Set(), drag = { on: false, x: 0, y: 0, moved: false }, box = document.getElementById('dragbox');
  let mouse = { x: 0, y: 0 }, lastClick = { t: 0, id: -1 }, shiftDown = false;
  const g = () => ui.game;
  const selectedUnitIds = () => [...ui.sel].filter(id => g().entities.get(id)?.kind === 'unit');
  const setSel = ids => { ui.sel.clear(); for (const i of ids) ui.sel.add(i); ui.inspect = null; };
  const onScreen = u => { const p = ui.view.project(u.x, u.y), r = el.getBoundingClientRect(); return p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom; };
  const tileForPlacing = (cx, cy) => { const p = ui.view.pickGround(cx, cy); if (!p) return null; const s = BUILDINGS[ui.placing].size; return { x: Math.round(p.x - s / 2), y: Math.round(p.y - s / 2) }; };

  // ----- shared logic -----
  // Left-click / tap on an own entity: select, double-click selects all of that type on screen.
  function selectOwn(ent, additive) {
    const now = performance.now();
    if (additive) { if (ui.sel.has(ent.id)) ui.sel.delete(ent.id); else ui.sel.add(ent.id); }
    else if (ent.kind === 'unit' && now - lastClick.t < 350 && lastClick.id === ent.id) setSel(g().visibleEntities(0).filter(u => u.owner === 0 && u.type === ent.type && onScreen(u)).map(u => u.id));
    else setSel([ent.id]);
    lastClick = { t: now, id: ent.id };
  }
  // Right-click / tap-with-selection: the context order for whatever is under the pointer.
  function orderAt(t, gp, ids) {
    const vids = ids.filter(id => g().entities.get(id).type === 'villager');
    if (t && (t.kind === 'unit' || t.kind === 'building') && t.owner === 1) return ui.cmd({ type: 'attack', ids, targetId: t.id });
    if (t && t.kind === 'resource') return ui.cmd({ type: 'gather', ids: vids, resourceId: t.id });
    if (t && t.kind === 'building' && t.owner === 0 && t.gatherType && t.constructed) return ui.cmd({ type: 'gather', ids: vids, resourceId: t.id });
    if (t && t.kind === 'building' && t.owner === 0 && !t.constructed) return ui.cmd({ type: 'construct', ids: vids, targetId: t.id });
    if (t && t.kind === 'relic') return ui.cmd({ type: 'relic', ids, relicId: t.id });
    if (gp) return ui.cmd({ type: 'move', ids, x: gp.x, y: gp.y });
    return null;
  }
  function boxSelect(x0, y0, x1, y1, additive) {
    const [xa, xb] = [Math.min(x0, x1), Math.max(x0, x1)], [ya, yb] = [Math.min(y0, y1), Math.max(y0, y1)];
    const inBox = e => { const c = e.kind === 'building' ? { x: e.x + e.size / 2, y: e.y + e.size / 2 } : e, p = ui.view.project(c.x, c.y); return p.x >= xa && p.x <= xb && p.y >= ya && p.y <= yb; };
    const mine = g().visibleEntities(0).filter(e => e.owner === 0 && inBox(e));
    const units = mine.filter(e => e.kind === 'unit'), pick = units.length ? units : mine.filter(e => e.kind === 'building').slice(0, 1);
    if (additive) for (const u of pick) ui.sel.add(u.id); else setSel(pick.map(u => u.id));
  }
  function place(tile) {
    if (!tile) return;
    const vills = selectedUnitIds().filter(id => g().entities.get(id).type === 'villager');
    const r = ui.cmd({ type: 'build', ids: vills, building: ui.placing, x: tile.x, y: tile.y });
    if (r.ok && !(shiftDown && !ui.touch)) ui.stopPlacing();
  }
  const idleVillagers = () => g().visibleEntities(0).filter(u => u.owner === 0 && u.type === 'villager' && u.order.type === 'idle');
  ui.actions = {
    idle() { const idle = idleVillagers(); if (!idle.length) return ui.toast?.('No idle villagers'); ui.idleIdx = (ui.idleIdx || 0) % idle.length; const u = idle[ui.idleIdx++]; setSel([u.id]); ui.view.centerOn(u.x, u.y); },
    home() { const tc = [...g().buildings.values()].find(b => b.owner === 0 && b.type === 'town_center'); if (tc) { ui.view.centerOn(tc.x + 1.5, tc.y + 1.5); setSel([tc.id]); } },
    box() { ui.boxMode = !ui.boxMode; },
    clear() { ui.stopPlacing(); ui.boxMode = false; setSel([]); },
    'place-ok'() { if (ui.placing && ui.placeTile) place(ui.placeTile); },
    'place-cancel'() { ui.stopPlacing(); },
  };

  // ----- mouse (desktop) -----
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
    if (ui.placing) return place(tileForPlacing(e.clientX, e.clientY));
    if (drag.moved) return boxSelect(drag.x, drag.y, e.clientX, e.clientY, shiftDown);
    const ent = ui.view.pickEntity(e.clientX, e.clientY);
    if (!ent) return setSel([]);
    if (ent.owner === 0 && (ent.kind === 'unit' || ent.kind === 'building')) selectOwn(ent, e.shiftKey);
    else { setSel([]); ui.inspect = ent; }
  });
  window.addEventListener('keydown', e => { shiftDown = e.shiftKey; keys.add(e.key.toLowerCase()); onKey(e); });
  window.addEventListener('keyup', e => { shiftDown = e.shiftKey; keys.delete(e.key.toLowerCase()); });
  el.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (ui.placing) return ui.stopPlacing();
    const ids = selectedUnitIds(); if (!ids.length) return;
    const r = orderAt(ui.view.pickEntity(e.clientX, e.clientY), ui.view.pickGround(e.clientX, e.clientY), ids);
    const gp = ui.view.pickGround(e.clientX, e.clientY); if (r && r.ok && gp) ui.marker(gp.x, gp.y);
  });
  el.addEventListener('wheel', e => { e.preventDefault(); ui.view.setZoom(ui.view.zoom * (e.deltaY > 0 ? 1.1 : 0.9)); }, { passive: false });
  function onKey(e) {
    if (!ui.game) return;
    if (e.key === 'Escape') { ui.stopPlacing(); setSel([]); }
    else if (e.key === '.') ui.actions.idle();
    else if (e.key.toLowerCase() === 'h') ui.actions.home();
    else if (e.key === ' ') { e.preventDefault(); ui.togglePause(); }
    else if (e.key === '+' || e.key === '=') ui.view.setZoom(ui.view.zoom * 0.9); else if (e.key === '-') ui.view.setZoom(ui.view.zoom * 1.1);
  }

  // ----- minimap (mouse + touch) -----
  const mm = document.getElementById('minimap');
  const mmPoint = (cx, cy) => { const r = mm.getBoundingClientRect(); return ui.minimap.toWorld((cx - r.left) * mm.width / r.width, (cy - r.top) * mm.height / r.height); };
  mm.addEventListener('mousedown', e => { if (!ui.game) return; const w = mmPoint(e.clientX, e.clientY); if (e.button === 0) ui.view.centerOn(w.x, w.y); else if (e.button === 2) { const ids = selectedUnitIds(); if (ids.length) ui.cmd({ type: 'move', ids, x: w.x, y: w.y }); } });
  mm.addEventListener('contextmenu', e => e.preventDefault());
  const mmTouch = e => { e.preventDefault(); if (!ui.game) return; const t = e.touches[0] || e.changedTouches[0]; const w = mmPoint(t.clientX, t.clientY); ui.view.centerOn(w.x, w.y); };
  mm.addEventListener('touchstart', mmTouch, { passive: false }); mm.addEventListener('touchmove', mmTouch, { passive: false });

  // ----- touch (phone) -----
  // 1 finger: tap = select / order, drag = pan (or box-select in box mode). 2 fingers: pinch-zoom + pan.
  const TT = { start: null, last: null, moved: false, pinch: null };
  const pts = e => [...e.touches].map(t => ({ x: t.clientX, y: t.clientY }));
  function panBy(prev, cur) { // keep the world point under the finger fixed
    const v = ui.view, a = v.pickGround(prev.x, prev.y), b = v.pickGround(cur.x, cur.y);
    if (a && b) { v.pan(a.x - b.x, a.y - b.y); v.refreshCamera(); }
  }
  function setPlaceTile(x, y) { const t = tileForPlacing(x, y); if (t) ui.placeTile = t; }
  function tap(x, y) {
    if (ui.placing) return setPlaceTile(x, y);
    const ent = ui.view.pickEntity(x, y), gp = ui.view.pickGround(x, y), ids = selectedUnitIds();
    const own = ent && ent.owner === 0 && (ent.kind === 'unit' || ent.kind === 'building');
    const helps = own && ent.kind === 'building' && ids.some(id => g().entities.get(id).type === 'villager') && (!ent.constructed || (ent.gatherType && ent.constructed));
    if (own && !helps) return selectOwn(ent, false);
    if (ids.length) { const r = orderAt(ent, gp, ids); if (r && r.ok && gp) ui.marker(gp.x, gp.y); return; }
    setSel([]); if (ent) ui.inspect = ent;
  }
  el.addEventListener('touchstart', e => {
    e.preventDefault(); if (!ui.game) return;
    const p = pts(e);
    if (p.length >= 2) { TT.moved = true; box.classList.add('hidden'); const [a, b] = p; TT.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), c: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }; TT.last = null; return; }
    TT.start = { ...p[0], t: performance.now() }; TT.last = p[0]; TT.moved = false; TT.pinch = null;
    if (ui.placing) setPlaceTile(p[0].x, p[0].y);
  }, { passive: false });
  el.addEventListener('touchmove', e => {
    e.preventDefault(); if (!ui.game) return;
    const p = pts(e);
    if (p.length >= 2 && TT.pinch) {
      const [a, b] = p, d = Math.hypot(a.x - b.x, a.y - b.y), c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (d > 8 && TT.pinch.d > 8) { ui.view.setZoom(ui.view.zoom * TT.pinch.d / d); ui.view.refreshCamera(); }
      panBy(TT.pinch.c, c); TT.pinch = { d, c }; return;
    }
    if (p.length !== 1 || !TT.start) return;
    const cur = p[0];
    if (!TT.moved && Math.hypot(cur.x - TT.start.x, cur.y - TT.start.y) > 10) TT.moved = true;
    if (!TT.moved) return;
    if (ui.placing) setPlaceTile(cur.x, cur.y);
    else if (ui.boxMode) { box.classList.remove('hidden'); Object.assign(box.style, { left: Math.min(TT.start.x, cur.x) + 'px', top: Math.min(TT.start.y, cur.y) + 'px', width: Math.abs(cur.x - TT.start.x) + 'px', height: Math.abs(cur.y - TT.start.y) + 'px' }); }
    else panBy(TT.last, cur);
    TT.last = cur;
  }, { passive: false });
  const touchEnd = e => {
    e.preventDefault(); box.classList.add('hidden');
    if (e.touches.length > 0) { TT.pinch = null; TT.moved = true; TT.start = null; return; } // one finger of a gesture lifted
    if (TT.start && ui.game) {
      const s = TT.start, l = TT.last || s;
      if (!TT.moved && performance.now() - s.t < 500) tap(s.x, s.y);
      else if (TT.moved && ui.boxMode && !ui.placing) boxSelect(s.x, s.y, l.x, l.y, false);
    }
    TT.start = null; TT.pinch = null; TT.moved = false;
  };
  el.addEventListener('touchend', touchEnd, { passive: false });
  el.addEventListener('touchcancel', e => { e.preventDefault(); box.classList.add('hidden'); TT.start = null; TT.pinch = null; TT.moved = false; }, { passive: false });
  // stop iOS from zooming / scrolling the page underneath the game
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault());

  return { update(dt) {
    if (!ui.game) return;
    const s = 22 * dt * (ui.view.zoom / 14);
    let dx = 0, dz = 0;
    if (keys.has('a') || keys.has('arrowleft')) { dx -= 1; dz += 1; } if (keys.has('d') || keys.has('arrowright')) { dx += 1; dz -= 1; }
    if (keys.has('w') || keys.has('arrowup')) { dx -= 1; dz -= 1; } if (keys.has('s') || keys.has('arrowdown')) { dx += 1; dz += 1; }
    if (dx || dz) ui.view.pan(dx * s * 0.7, dz * s * 0.7);
    if (ui.placing) { const t = ui.touch ? ui.placeTile : tileForPlacing(mouse.x, mouse.y); if (t) { const ok = canPlace(g(), 0, ui.placing, t.x, t.y) && canAfford(g().players[0], BUILDINGS[ui.placing].cost); ui.view.showGhost(ui.placing, t.x, t.y, ok); } }
  } };
}
