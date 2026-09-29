import { UNITS } from '../data/units.js';
import { BUILDINGS } from '../data/buildings.js';
import { AGES, AGE_COST, ageIndex } from '../data/ages.js';
import { canAfford, ageUpProblem } from '../sim/commands.js';
import { WONDER_TICKS, RELIC_TICKS } from '../rounds/index.js';

const REASONS = { resources: 'Not enough resources', 'pop cap': 'Population cap reached - build Houses', age: 'Requires a later Age', placement: 'Cannot build there', 'needs buildings': 'Advancing needs 2 buildings of your current Age',
  'queue full': 'Production queue is full', 'no villagers': 'Select villagers first', 'no units': 'Select units first', 'bad target': 'Invalid target', 'already researching': 'Already advancing', 'needs town center': 'Requires a Town Center' };
export const reasonText = r => REASONS[r] || r;
const COLORS = { food: '#e0554d', wood: '#a06a35', gold: '#facc15', stone: '#9ca3af' };
const fmtTime = t => { const s = Math.floor(t / 20); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const costStr = c => ['food', 'wood', 'gold', 'stone'].filter(k => c[k]).map(k => c[k] + k[0].toUpperCase()).join(' ');

export function createHud(ui) {
  const $ = id => document.getElementById(id), top = $('topbar'), info = $('info'), cmds = $('cmds');
  let cmdKey = '', infoKey = '';
  const hud = { toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(hud._t); hud._t = setTimeout(() => t.classList.remove('show'), 2200); } };
  hud.update = () => {
    const g = ui.game, p = g.players[0], round = g.rules;
    let obj = round ? round.desc : '';
    const st = g.roundState;
    if (round && round.id === 'wonder') obj = `Wonder countdown - you ${fmtTime(st.hold[0])}/${fmtTime(WONDER_TICKS)} | enemy ${fmtTime(st.hold[1])}/${fmtTime(WONDER_TICKS)}`;
    if (round && round.id === 'relics') obj = `Relics held - you ${st.count ? st.count[0] : 0} | enemy ${st.count ? st.count[1] : 0} of 5 | hold ${fmtTime(st.hold[0])}/${fmtTime(RELIC_TICKS)}`;
    if (round && round.id === 'regicide') obj = `Protect your King (${g.entities.has(st.kings[0]) ? 'alive' : 'DEAD'}). Kill theirs.`;
    const html = ['food', 'wood', 'gold', 'stone'].map(k => `<span class="res"><i class="dot" style="background:${COLORS[k]}"></i>${Math.floor(p.res[k])}</span>`).join('')
      + `<span class="res" title="Population">Pop ${p.pop}/${p.popCap}</span><span class="res">${p.ageUp ? 'Advancing... ' : ''}${AGES[ageIndex(p.age)][0].toUpperCase() + p.age.slice(1)} Age</span>`
      + `<span class="grow"><b>${round ? round.name : 'Match'}</b> - <span class="obj">${obj}</span></span><span class="res">${fmtTime(g.time)}</span>`
      + [1, 2, 4].map(s => `<button data-speed="${s}" class="${ui.speed === s ? 'on' : ''}">${s}x</button>`).join('') + `<button data-pause="1" class="${ui.paused ? 'on' : ''}">${ui.paused ? 'Resume' : 'Pause'}</button><button data-resign="1" class="${ui.resignArmed ? 'on' : ''}">${ui.resignArmed ? 'Confirm resign?' : 'Resign'}</button>`;
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
      cmdKey = key; const btns = [];
      if (vills.length) for (const [id, d] of Object.entries(BUILDINGS)) {
        const locked = ageIndex(d.age) > ageIndex(p.age), ok = !locked && canAfford(p, d.cost);
        btns.push(`<button class="btn" data-build="${id}" ${ok ? '' : 'disabled'} title="${locked ? 'Requires ' + d.age + ' age' : ''}">${d.name}<small>${locked ? d.age + ' age' : costStr(d.cost)}</small></button>`);
      }
      if (bld) {
        for (const u of BUILDINGS[bld.type].trains || []) { const d = UNITS[u], locked = ageIndex(d.age) > ageIndex(p.age), ok = !locked && canAfford(p, d.cost) && p.pop < p.popCap;
          btns.push(`<button class="btn" data-train="${u}" data-b="${bld.id}" ${ok ? '' : 'disabled'} title="${locked ? 'Requires ' + d.age + ' age' : ''}">${d.name}<small>${locked ? d.age + ' age' : costStr(d.cost)}</small></button>`); }
        if (bld.type === 'town_center') { const next = AGES[ageIndex(p.age) + 1]; if (next) { const why = ageUpProblem(ui.game, 0); btns.push(`<button class="btn age" data-age="1" ${why ? 'disabled' : ''} title="${why || ''}">Advance: ${next[0].toUpperCase() + next.slice(1)}<small>${costStr(AGE_COST[next].cost)}${why === 'needs buildings' ? ' + 2 bldgs' : ''}</small></button>`); } }
      }
      cmds.innerHTML = btns.join('');
    }
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.speed) ui.setSpeed(+b.dataset.speed);
    else if (b.dataset.pause) ui.togglePause();
    else if (b.dataset.resign) { if (ui.resignArmed) { ui.resignArmed = false; ui.game.command(0, { type: 'resign' }); } else { ui.resignArmed = true; setTimeout(() => { ui.resignArmed = false; }, 3000); } }
    else if (b.dataset.build) ui.startPlacing(b.dataset.build);
    else if (b.dataset.train) { const n = e.shiftKey ? 5 : 1; for (let i = 0; i < n; i++) { const r = ui.cmd({ type: 'train', buildingId: +b.dataset.b, unit: b.dataset.train }); if (!r.ok) break; } cmdKey = ''; }
    else if (b.dataset.age) { ui.cmd({ type: 'age' }); cmdKey = ''; }
  });
  return hud;
}
