import { createGame } from './sim/game.js';
import { createBot } from './ai/bot.js';
import { ROUNDS, roundById, scoreOf } from './rounds/index.js';
import { createTournament } from './tournament/bracket.js';
import { createView } from './render/view.js';
import { createMinimap } from './render/minimap.js';
import { createHud, reasonText } from './ui/hud.js';
import { createInput } from './ui/input.js';

const params = new URLSearchParams(location.search), AUTO = params.get('autotour') === '1';
const screenEl = document.getElementById('screen'), app = { tournament: null, match: null, ui: null };
window.__app = app;
const EVERY = { easy: 30, medium: 15, hard: 10 };

const ui = app.ui = { game: null, view: null, minimap: null, sel: new Set(), inspect: null, placing: null, speed: +(params.get('speed') || 1), paused: false,
  cmd(c) { const r = ui.game.command(0, c); if (!r.ok) hud.toast(reasonText(r.reason)); return r; },
  setSpeed(s) { ui.speed = s; }, togglePause() { ui.paused = !ui.paused; },
  startPlacing(type) { ui.placing = type; hud.toast('Click to place. Right-click / Esc cancels. Shift keeps placing.'); },
  stopPlacing() { ui.placing = null; ui.view?.showGhost(null); },
  marker(x, y) { ui.view?.marker(x, y); } };
const hud = createHud(ui), input = createInput(ui);

function show(html) { screenEl.innerHTML = html; screenEl.classList.remove('hidden'); if (AUTO) setTimeout(() => screenEl.querySelector('[data-auto]')?.click(), 500); }
function hide() { screenEl.classList.add('hidden'); screenEl.innerHTML = ''; }

function startMatch({ roundId, seed, oppDiff, label, onEnd }) {
  if (app.match) { cancelAnimationFrame(app.match.raf); ui.view?.dispose(); }
  const game = createGame({ seed, rules: roundById(roundId) });
  const vp = document.getElementById('viewport'); vp.innerHTML = '';
  const view = createView(vp, game); view.selection = ui.sel;
  ui.game = game; ui.view = view; ui.sel.clear(); ui.inspect = null; ui.placing = null; ui.paused = false; ui.minimap = createMinimap(document.getElementById('minimap'), game, view);
  const bots = [createBot(game, 1, oppDiff)]; const botDiff = params.get('bot') || 'hard'; // difficulty of the bot that drives player 0 in autoplay/test modes
  if (params.get('autoplay') === '1' || AUTO) bots.unshift(createBot(game, 0, botDiff));
  const diffs = { 0: botDiff, 1: oppDiff };
  const tc = [...game.buildings.values()].find(b => b.owner === 0); view.centerOn(tc.x + 1.5, tc.y + 1.5); view.setZoom(13);
  const m = app.match = { game, view, bots, diffs, acc: 0, last: performance.now(), ended: false, frames: 0, label, onEnd };
  window.addEventListener('resize', view.resize);
  const loop = now => {
    m.raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - m.last) / 1000); m.last = now; m.frames++;
    if (!ui.paused && !game.result) {
      m.acc += dt * ui.speed * 20; let steps = Math.min(Math.floor(m.acc), 300); m.acc -= Math.floor(m.acc);
      for (let i = 0; i < steps && !game.result; i++) { game.tick(); for (const b of m.bots) { const pid = b === m.bots[m.bots.length - 1] ? 1 : 0, ev = EVERY[m.diffs[pid]]; if (game.time % ev === (pid * 3) % ev) b.think(); } }
    }
    input.update(dt); view.sync(); view.frame(dt, now / 1000); hud.update(); if (m.frames % 3 === 0) ui.minimap.draw();
    if (game.result && !m.ended) { m.ended = true; setTimeout(() => showResult(m), AUTO ? 300 : 1200); }
  };
  m.raf = requestAnimationFrame(loop);
  hide();
  return m;
}

const REASON = { resigned: w => w ? 'The enemy resigned.' : 'You resigned.', conquest: w => w ? 'Every enemy unit and building was destroyed.' : 'Your empire was destroyed.', regicide: w => w ? 'You slew the enemy King!' : 'Your King has fallen.', wonder: w => w ? 'Your Wonder stood for three minutes.' : 'The enemy Wonder stood for three minutes.',
  relics: w => w ? 'You held all the relics.' : 'The enemy held all the relics.', 'time cap': w => 'Time ran out; decided on score.', 'mutual destruction': () => 'Both empires fell; decided on score.', 'both kings fell': () => 'Both kings fell; decided on score.' };
function showResult(m) {
  const r = m.game.result, won = r.winner === 0, p = m.game.players;
  const stats = `Time ${Math.floor(m.game.time / 1200)}m ${Math.floor(m.game.time / 20) % 60}s &middot; your kills ${p[0].kills}, buildings destroyed ${p[0].bdestroyed} &middot; score ${scoreOf(m.game, 0).toFixed(0)} vs ${scoreOf(m.game, 1).toFixed(0)}`;
  show(`<div class="card"><h1 class="${won ? 'win' : 'lose'}">${won ? 'Victory' : 'Defeat'}</h1><p>${(REASON[r.reason] || (() => r.reason))(won)}</p><p><small>${stats}</small></p><button class="btn" data-auto id="cont">${m.onEnd ? 'Continue' : 'Back to menu'}</button></div>`);
  document.getElementById('cont').onclick = () => { if (m.onEnd) m.onEnd(won); else menu(); };
}

// ---- tournament flow
function bracketHtml(t) {
  const cols = ROUNDS.map((r, i) => {
    let ms = '';
    if (i < t.history.length) ms = t.history[i].results.map(x => `<div class="m ${x.human ? 'cur' : ''}"><span class="${x.winner === x.a ? 'w' : ''} ${x.a === 'You' ? 'you' : ''}">${x.a}</span><span class="${x.winner === x.b ? 'w' : ''} ${x.b === 'You' ? 'you' : ''}">${x.b}</span></div>`).join('');
    else if (i === t.roundIndex && !t.over) { for (let k = 0; k < t.alive.length; k += 2) ms += `<div class="m ${k === 0 ? 'cur' : ''}"><span class="${t.alive[k].id === 0 ? 'you' : ''}">${t.alive[k].name}</span><span>${t.alive[k + 1].name}</span></div>`; }
    else ms = `<div class="m"><span>${32 >> (i + 1) === 1 ? 'Final' : (32 >> i) / 2 + ' matches'}</span></div>`;
    return `<div class="col"><h4>Round ${i + 1}<br>${r.name}</h4>${ms}</div>`;
  });
  return `<div class="bracket">${cols.join('')}</div>`;
}
function bracketScreen() {
  const t = app.tournament, r = t.round, o = t.opponent;
  show(`<div class="card"><h2>Round ${t.roundIndex + 1} of 5 &mdash; ${r.name}</h2><p>${r.desc}</p><p>Opponent: <b>${o.name}</b> (${o.difficulty})</p>${bracketHtml(t)}<button class="btn" data-auto id="go">Begin Round</button></div>`);
  document.getElementById('go').onclick = () => startMatch({ roundId: r.id, seed: t.seed * 10 + t.roundIndex + 1, oppDiff: o.difficulty, onEnd: won => afterMatch(won) });
}
async function afterMatch(won) {
  const t = app.tournament;
  show(`<div class="card"><h2>${won ? 'Round won' : 'Round lost'}</h2><p>Simulating the rest of the bracket&hellip;</p><div class="prog"><i id="pbar"></i></div><p id="ptxt"></p></div>`);
  await t.resolveAsync(won, { onProgress: (d, n) => { document.getElementById('pbar').style.width = (d / n * 100) + '%'; document.getElementById('ptxt').textContent = `${d} / ${n} matches`; } });
  if (!t.over) return bracketScreen();
  const champ = !!t.champion;
  show(`<div class="card"><h1 class="${champ ? 'win' : 'lose'}">${champ ? 'Champion!' : 'Eliminated'}</h1><p>${champ ? 'You won all five rounds and the knockout crown.' : `You fell in round ${t.lostIn + 1} (${ROUNDS[t.lostIn].name}).`}</p>${bracketHtml(t)}<button class="btn" data-auto id="again">Back to menu</button></div>`);
  document.getElementById('again').onclick = menu;
}
function startTournament() { app.tournament = createTournament(+(params.get('seed') || 1)); bracketScreen(); }

function menu() {
  show(`<div class="card"><h1>Age of Knockout</h1><h2>A five-round elimination tournament in the spirit of Age of Empires (1997)</h2>
  <p>Thirty-two rulers enter; you face one AI empire per round, each round a different game type. Lose once and you are out.</p>
  <div class="keys"><b>Left click / drag</b><span>select units and buildings (double-click: all of a type)</span><b>Right click</b><span>move, gather, build, attack, or pick up relics</span>
  <b>WASD / arrows, wheel</b><span>pan, zoom</span><b>. (period), H</b><span>next idle villager, jump to Town Center</span><b>Space, Esc</b><span>pause, cancel</span></div>
  <button class="btn" data-auto id="start">Begin Tournament</button><br>
  ${ROUNDS.map((r, i) => `<button class="btn quick" data-i="${i}" style="font-size:14px;padding:5px 12px">Quick: ${r.name}</button>`).join('')}</div>`);
  document.getElementById('start').onclick = startTournament;
  for (const b of document.querySelectorAll('.quick')) b.onclick = () => startMatch({ roundId: ROUNDS[+b.dataset.i].id, seed: 1, oppDiff: 'medium' });
}

if (params.get('round')) startMatch({ roundId: ROUNDS[+params.get('round') - 1].id, seed: +(params.get('seed') || 1), oppDiff: params.get('opp') || 'medium' });
else menu();
