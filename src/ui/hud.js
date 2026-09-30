import { UNITS } from '../data/units.js';
import { BUILDINGS } from '../data/buildings.js';
import { AGES, AGE_COST, ageIndex, ageLabel } from '../data/ages.js';
import { canAfford, ageUpProblem } from '../sim/commands.js';
import { WONDER_TICKS, RELIC_TICKS } from '../rounds/index.js';
import { icon } from './icons.js';
import { COLORS, RES, costHtml, tipHtml } from './tips.js';

const REASONS = { resources: 'Not enough resources', 'pop cap': 'Population cap reached - build Houses', age: 'Requires a later Age', placement: 'Cannot build there', 'needs buildings': 'Advancing needs 2 buildings of your current Age',
  'queue full': 'Production queue is full', 'no villagers': 'Select villagers first', 'no units': 'Select units first', 'bad target': 'Invalid target', 'already researching': 'Already advancing', 'needs town center': 'Requires a Town Center' };
export const reasonText = r => REASONS[r] || r;
const fmtTime = t => { const s = Math.floor(t / 20); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const tintOf = d => !d.cls ? 't-bld' : d.age === 'future' ? 't-fut' : d.cls === 'civ' ? 't-civ' : d.cls === 'siege' ? 't-siege' : 't-mil';
const shortOf = (p, cost) => RES.filter(k => cost[k] > p.res[k]);

export function createHud(ui) {
  const $ = id => document.getElementById(id), top = $('topbar'), info = $('info'), cmds = $('cmds');
  let cmdKey = '', infoKey = '';
  const hud = { toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(hud._t); hud._t = setTimeout(() => t.classList.remove('show'), 2200); } };
  // Glass command tile: icon orb + name + cost. Disabled tiles use .off / aria-disabled (not [disabled]) so they still receive hover for the tooltip.
  // tile() returns a descriptor: `key` (attributes + name + lock) changes only when the tile set, its target building or a lock state changes (then the panel is rebuilt);
  // otherwise `off` and `small` (cost line) are patched in place so hover/glow animations and focus survive resource ticks.
  const tips = new Map();
  const tile = (attrs, { kind, id, name, cost, tint, cls, ok, lockedAge, short = [], notes = [], next, extra = '', cx = '' }) => {
    tips.set(`${kind}:${id}`, tipHtml({ kind, id, next, short, notes }));
    const lock = lockedAge ? `<span class="lock">${icon('lock')}</span>` : '', small = lockedAge ? ageLabel(lockedAge) + ' age' : costHtml(cost, short, true) + extra;
    return { key: `${attrs}|${name}|${lockedAge ? 'L' : ''}`, off: !ok, small,
      html: `<button class="btn tile ${tint}${ok ? '' : ' off'}${lockedAge ? ' locked' : ''}${cx}" ${attrs} data-tip="${kind}:${id}" aria-describedby="tip" aria-disabled="${!ok}"><span class="orb">${icon(id, cls)}${lock}</span><span class="lbl"><b>${name}</b><small>${small}</small></span></button>` };
  };
  const tipEl = $('tip'); let tipKey = '';
  const hideTip = () => { tipKey = ''; tipEl.classList.remove('show'); };
  const showTip = (b, force) => {
    const html = tips.get(b.dataset.tip); if (!html || ui.touch) return hideTip();
    const was = tipEl.classList.contains('show'); if (!force && was && tipKey === b.dataset.tip) return;
    tipKey = b.dataset.tip; if (tipEl._html !== html) { tipEl.innerHTML = html; tipEl._html = html; }
    const tint = [...b.classList].find(c => c.startsWith('t-')); if (tipEl._tint !== tint) { if (tipEl._tint) tipEl.classList.remove(tipEl._tint); tipEl.classList.add(tint); tipEl._tint = tint; }
    tipEl.classList.toggle('move', was);
    const r = b.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    tipEl.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    tipEl.style.top = (r.top - h - 10 < 8 ? r.bottom + 10 : r.top - h - 10) + 'px';
    tipEl.classList.add('show');
  };
  document.addEventListener('mouseover', e => { const b = e.target.closest?.('#cmds .tile'); if (b) showTip(b); else if (tipKey) hideTip(); });
  document.addEventListener('mouseout', e => { if (!e.relatedTarget) hideTip(); });
  document.addEventListener('focusin', e => { const b = e.target.closest?.('#cmds .tile'); if (b) showTip(b); });
  document.addEventListener('focusout', hideTip);
  cmds.addEventListener('scroll', hideTip, { passive: true });
  hud.update = () => {
    const g = ui.game, p = g.players[0], round = g.rules;
    let obj = round ? round.desc : '';
    const st = g.roundState;
    if (round && round.id === 'wonder') obj = `Wonder countdown - you ${fmtTime(st.hold[0])}/${fmtTime(WONDER_TICKS)} | enemy ${fmtTime(st.hold[1])}/${fmtTime(WONDER_TICKS)}`;
    if (round && round.id === 'relics') obj = `Relics held - you ${st.count ? st.count[0] : 0} | enemy ${st.count ? st.count[1] : 0} of 5 | hold ${fmtTime(st.hold[0])}/${fmtTime(RELIC_TICKS)}`;
    if (round && round.id === 'regicide') obj = `Protect your King (${g.entities.has(st.kings[0]) ? 'alive' : 'DEAD'}). Kill theirs.`;
    const resHtml = ['food', 'wood', 'gold', 'stone'].map(k => `<span class="res"><i class="dot" style="background:${COLORS[k]}"></i>${Math.floor(p.res[k])}</span>`).join('');
    const ageName = ageLabel(p.age);
    let html;
    if (ui.touch) html = resHtml + `<span class="res" title="Population">&#9823;${p.pop}/${p.popCap}</span><span class="res">${ageName}${p.ageUp ? '&hellip;' : ''}</span><span style="flex:1"></span><span class="res">${fmtTime(g.time)}</span><button data-menu="open" aria-label="Menu">&#9776;</button>`;
    else html = resHtml
      + `<span class="res" title="Population">Pop ${p.pop}/${p.popCap}</span><span class="res">${p.ageUp ? 'Advancing... ' : ''}${ageName} Age</span>`
      + `<span class="grow"><b>${round ? round.name : 'Match'}</b> - <span class="obj">${obj}</span></span><span class="res">${fmtTime(g.time)}</span>`
      + [1, 2, 4].map(s => `<button data-speed="${s}" class="${ui.speed === s ? 'on' : ''}">${s}x</button>`).join('') + `<button data-pause="1" class="${ui.paused ? 'on' : ''}">${ui.paused ? 'Resume' : 'Pause'}</button><button data-resign="1" class="${ui.resignArmed ? 'on' : ''}">${ui.resignArmed ? 'Confirm resign?' : 'Resign'}</button>`;
    if (ui.touch) {
      const objEl = $('objective'), otxt = round ? `${round.name}: ${obj}` : ''; if (objEl.textContent !== otxt) objEl.textContent = otxt;
      let idleN = 0; for (const u of g.units.values()) if (u.owner === 0 && u.type === 'villager' && u.order.type === 'idle') idleN++;
      const badge = document.querySelector('#touchbar [data-act=idle] .badge'), bt = idleN ? String(idleN) : ''; if (badge.textContent !== bt) badge.textContent = bt;
      document.querySelector('#touchbar [data-act=box]').classList.toggle('on', !!ui.boxMode);
      $('placebar').classList.toggle('hidden', !ui.placing); document.body.classList.toggle('placing', !!ui.placing);
    }
    if (top._html !== html) { top.innerHTML = html; top._html = html; }
    // info panel
    const sel = [...ui.sel].map(id => g.entities.get(id)).filter(Boolean), one = sel.length === 1 ? sel[0] : null, insp = ui.inspect && g.entities.get(ui.inspect.id);
    let ih = '';
    const bar = e => `<div class="bar"><i style="width:${Math.max(0, e.hp / e.maxHp * 100)}%"></i></div>`;
    const nameOf = e => e.kind === 'unit' ? UNITS[e.type].name : e.kind === 'building' ? BUILDINGS[e.type].name : e.type;
    const describe = e => {
      let s = `<h3>${nameOf(e)}${e.owner === 1 ? ' <small class="lose">(enemy)</small>' : ''}</h3>` + bar(e) + `HP ${Math.ceil(e.hp)}/${e.maxHp}`;
      if (e.kind === 'unit') s += ` &nbsp; Attack ${e.atk} &nbsp; Armor ${e.armor}` + (e.carry?.amount > 0 ? `<br>Carrying ${Math.floor(e.carry.amount)} ${e.carry.type}` : '') + `<br>${e.order.type === 'idle' ? 'Idle' : e.order.type[0].toUpperCase() + e.order.type.slice(1)}`;
      if (e.kind === 'building') s += e.constructed ? (e.queue.length ? `<br>Training: ${e.queue.map(q => UNITS[q.unit].name).join(', ')} (${Math.ceil(e.queue[0].remaining / 20)}s)` : (e.gatherType ? `<br>Food left ${Math.floor(e.amount)}` : '')) : `<br>Under construction ${Math.floor(e.progress * 100)}%`;
      return s;
    };
    if (one) ih = describe(one);
    else if (sel.length) { const c = {}; for (const e of sel) c[nameOf(e)] = (c[nameOf(e)] || 0) + 1; ih = `<h3>${sel.length} selected</h3>` + Object.entries(c).map(([k, v]) => `${v} x ${k}`).join('<br>'); }
    else if (insp) ih = describe(insp);
    else if (ui.inspect && ui.inspect.kind === 'resource') ih = `<h3>${ui.inspect.type}</h3>`;
    else ih = `<h3>${round ? round.name : ''}</h3>${round ? round.desc : ''}<br><br><small>Left-click / drag to select. Right-click to order. WASD pans, wheel zooms.</small>`;
    if (ih !== infoKey) { info.innerHTML = ih; infoKey = ih; }
    // commands
    const own = sel.filter(e => e.owner === 0), vills = own.filter(e => e.type === 'villager'), bld = own.find(e => e.kind === 'building' && e.constructed);
    let key = `${vills.length ? 'V' : ''}${bld ? bld.id + ':' + bld.queue.length : ''}${p.age}${p.ageUp ? 'a' : ''}${['food', 'wood', 'gold', 'stone'].map(k => Math.floor(p.res[k] / 25)).join(',')}${p.pop >= p.popCap ? 'P' : ''}${ui.placing || ''}`;
    if (key !== cmdKey) {
      cmdKey = key; const btns = []; tips.clear();
      const notesFor = (locked, d, short, popFull) => locked ? ['Requires ' + ageLabel(d.age) + ' Age'] : [...(short.length ? [reasonText('resources')] : []), ...(popFull ? [reasonText('pop cap')] : [])];
      if (vills.length) for (const [id, d] of Object.entries(BUILDINGS)) {
        const locked = ageIndex(d.age) > ageIndex(p.age), short = shortOf(p, d.cost), ok = !locked && canAfford(p, d.cost);
        btns.push(tile(`data-build="${id}"`, { kind: 'building', id, name: d.name, cost: d.cost, tint: tintOf(d), ok, lockedAge: locked ? d.age : '', short, notes: notesFor(locked, d, short) }));
      }
      if (bld) {
        for (const u of BUILDINGS[bld.type].trains || []) { const d = UNITS[u], locked = ageIndex(d.age) > ageIndex(p.age), short = shortOf(p, d.cost), popFull = p.pop >= p.popCap, ok = !locked && canAfford(p, d.cost) && !popFull;
          btns.push(tile(`data-train="${u}" data-b="${bld.id}"`, { kind: 'unit', id: u, name: d.name, cost: d.cost, tint: tintOf(d), cls: d.cls, ok, lockedAge: locked ? d.age : '', short, notes: notesFor(locked, d, short, popFull) })); }
        if (bld.type === 'town_center') { const next = AGES[ageIndex(p.age) + 1]; if (next) { const why = ageUpProblem(ui.game, 0), cost = AGE_COST[next].cost;
          btns.push(tile('data-age="1"', { kind: 'age', id: 'age', next, name: 'Advance: ' + ageLabel(next), cost, tint: 't-age', ok: !why, short: shortOf(p, cost), notes: why ? [reasonText(why)] : [], extra: why === 'needs buildings' ? '<span class="c">+2 bldgs</span>' : '', cx: ' age' })); } }
      }
      const struct = btns.map(b => b.key).join('|');
      if (struct !== cmds._struct) { cmds.innerHTML = btns.map(b => b.html).join(''); cmds._struct = struct; }
      else btns.forEach((b, i) => { const el = cmds.children[i], sm = el.querySelector('small'); el.classList.toggle('off', b.off); el.setAttribute('aria-disabled', b.off); if (sm.innerHTML !== b.small) sm.innerHTML = b.small; });
      if (tipKey) { const nb = cmds.querySelector(`[data-tip="${tipKey}"]`); if (nb) showTip(nb, true); else hideTip(); }
    }
    document.body.classList.toggle('has-cmds', cmds.children.length > 0);
  };
  hud.openMenu = () => {
    const m = $('gamemenu'); if (m.classList.contains('hidden')) { ui._wasPaused = ui.paused; ui.paused = true; }
    m.innerHTML = `<div class="card"><h2>Menu</h2><button class="btn" data-menu="close">Resume game</button><div class="row">${[1, 2, 4].map(s => `<button class="btn ${ui.speed === s ? 'on' : ''}" data-speed="${s}">${s}x</button>`).join('')}</div><button class="btn" data-resign="1">${ui.resignArmed ? 'Confirm resign?' : 'Resign'}</button><button class="btn" data-quit="1">${ui.quitArmed ? 'Confirm quit?' : 'Quit to menu'}</button></div>`;
    m.classList.remove('hidden');
  };
  hud.closeMenu = () => { const m = $('gamemenu'); if (m.classList.contains('hidden')) return; m.classList.add('hidden'); ui.paused = !!ui._wasPaused; };
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.classList.contains('off')) return;
    if (b.dataset.menu === 'open') return hud.openMenu();
    if (b.dataset.menu === 'close') return hud.closeMenu();
    if (b.dataset.act) return ui.actions?.[b.dataset.act]?.();
    if (b.dataset.quit) { if (ui.quitArmed) { ui.quitArmed = false; hud.closeMenu(); return ui.quit(); } ui.quitArmed = true; setTimeout(() => { ui.quitArmed = false; }, 3000); return hud.openMenu(); }
    if (b.dataset.speed) ui.setSpeed(+b.dataset.speed);
    else if (b.dataset.pause) ui.togglePause();
    else if (b.dataset.resign) { if (ui.resignArmed) { ui.resignArmed = false; ui.game.command(0, { type: 'resign' }); hud.closeMenu(); } else { ui.resignArmed = true; setTimeout(() => { ui.resignArmed = false; }, 3000); if (!$('gamemenu').classList.contains('hidden')) hud.openMenu(); } }
    else if (b.dataset.build) ui.startPlacing(b.dataset.build);
    else if (b.dataset.train) { const n = e.shiftKey ? 5 : 1; for (let i = 0; i < n; i++) { const r = ui.cmd({ type: 'train', buildingId: +b.dataset.b, unit: b.dataset.train }); if (!r.ok) break; } cmdKey = ''; }
    else if (b.dataset.age) { ui.cmd({ type: 'age' }); cmdKey = ''; }
  });
  return hud;
}
