// Hover descriptions and cost chips for the command tiles. DOM-free (returns HTML strings) so it is unit-testable.
import { UNITS } from '../data/units.js';
import { BUILDINGS } from '../data/buildings.js';
import { AGES, AGE_COST, ageLabel } from '../data/ages.js';
import { WONDER_TICKS } from '../rounds/index.js';
import { icon } from './icons.js';

export const RES = ['food', 'wood', 'gold', 'stone'];
export const COLORS = { food: '#e0554d', wood: '#a06a35', gold: '#facc15', stone: '#9ca3af' };
const CLASS_LABEL = { civ: 'Worker', inf: 'Infantry', archer: 'Ranged', cav: 'Cavalry', siege: 'Siege' };

// Only claims what the sim actually does (see docs and src/sim); Market has no trade yet, it just counts toward Age-up.
export const DESC = {
  town_center: 'Your base. Trains Villagers, accepts every resource and is where you advance to the next Age.',
  house: 'Raises your population cap. Build more when training stalls at the cap.',
  granary: 'Drop-off point for food. Place it beside berries and farms to shorten trips.',
  storage_pit: 'Drop-off point for wood, gold and stone. Place it beside forests and mines.',
  farm: 'A field that holds 400 food. Villagers work it for a steady food supply.',
  barracks: 'Trains infantry and Slingers. The Future Age adds the Mech Walker.',
  archery_range: 'Trains ranged units: Bowmen, then Combat Drones in the Future Age.',
  stable: 'Trains fast cavalry: Scouts for exploring and Horse Archers for raids.',
  market: 'Counts as one of the 2 buildings needed to leave the Tool Age. Trading is not in the game yet.',
  government_center: 'Trains siege: Catapults and Railguns. Also a drop-off point for every resource.',
  wonder: `In the Wonder Race, keeping one standing for ${Math.round(WONDER_TICKS / 1200)} minutes wins the round.`,
  villager: 'Gathers food, wood, gold and stone and builds every structure. Weak in a fight.',
  clubman: 'Cheap melee infantry that fights well early and falls behind in later Ages.',
  axeman: 'Melee infantry with a heavier swing than the Clubman.',
  slinger: 'Cheap ranged unit that throws stones from a distance. Costs a little stone.',
  bowman: 'Ranged unit with a longer reach than the Slinger. Keep soldiers in front of it.',
  spearman: 'Sturdy melee infantry with a little armor. A good front line in the Tool Age.',
  hoplite: 'Heavily armored infantry that soaks up damage for the units behind it.',
  swordsman: 'The strongest infantry before the Future Age: high health, high damage, good armor.',
  scout: 'Fast cavalry with the widest sight. Explore the map and pick off stray Villagers.',
  horse_archer: 'Fast ranged cavalry. Strike from a distance and retreat before the enemy closes in.',
  catapult: 'Slow siege engine. Its shots also hurt nearby units, but it is fragile up close.',
  drone: 'Fast Future Age skirmisher that fires from long range.',
  mech: 'Future Age walker with 200 health and heavy armor. Slow, tough and hard-hitting.',
  railgun: 'Future Age siege with the longest range and the highest damage. Shots splash nearby units.',
  king: 'Regicide only: if your King falls, the match is lost. Keep him safe.',
  age: 'Research the next Age to unlock stronger units and buildings.',
};

// Cost chips: coloured dot + amount. `short` lists resources the player lacks; `compact` shortens 1000 to 1k.
export const costHtml = (cost, short = [], compact = false) => RES.filter(k => cost[k]).map(k =>
  `<span class="c${short.includes(k) ? ' short' : ''}"><i class="dot" style="background:${COLORS[k]}"></i>${compact && cost[k] >= 1000 ? cost[k] / 1000 + 'k' : cost[k]}${compact ? '' : `<em>${k}</em>`}</span>`).join('');

const cap = s => s[0].toUpperCase() + s.slice(1);
const row = (label, value, wide) => `<div${wide ? ' class="wide"' : ''}><dt>${label}</dt><dd>${value}</dd></div>`;
const names = ids => ids.map(i => (UNITS[i] || BUILDINGS[i]).name).join(', ');

// state: { kind: 'unit'|'building'|'age', id, next?, short?: string[], notes?: string[] }
export function tipHtml({ kind, id, next, short = [], notes = [] }) {
  let title, sub, cost, stats = '', desc = DESC[id], ic = id, cls;
  if (kind === 'unit') {
    const u = UNITS[id]; cls = u.cls; title = u.name; sub = `${CLASS_LABEL[u.cls]} unit, ${ageLabel(u.age)} Age`; cost = u.cost;
    stats = row('HP', u.hp) + row('Attack', u.atk) + row('Armor', u.armor) + row('Range', u.range <= 1 ? 'Melee' : `${u.range} tiles`) + row('Speed', `${u.speed} tiles/s`) + row('Trains in', `${u.trainTime}s`);
  } else if (kind === 'building') {
    const b = BUILDINGS[id]; title = b.name; sub = `Building, ${ageLabel(b.age)} Age`; cost = b.cost;
    stats = row('HP', b.hp) + row('Build time', `${b.buildTime}s`);
    if (b.trains) stats += row('Trains', names(b.trains), true);
    if (b.pop) stats += row('Adds', `+${b.pop} population`, true);
    if (b.drops) stats += row('Drop-off', b.drops.map(cap).join(', '), true);
    if (b.gatherType) stats += row('Holds', `${b.amount} ${b.gatherType}`, true);
  } else {
    const a = AGE_COST[next]; title = `Advance to ${ageLabel(next)} Age`; sub = `Takes ${a.time}s`; cost = a.cost; ic = 'age';
    // Mirrors ageUpProblem (src/sim/commands.js): a Town Center plus min(2, buildings of the current Age, excluding extras like the Farm).
    const need = Math.min(2, Object.entries(BUILDINGS).filter(([bid, d]) => d.age === AGES[AGES.indexOf(next) - 1] && bid !== 'town_center' && !d.extra).length);
    desc += need ? ` Needs a Town Center and ${need} finished building${need > 1 ? 's' : ''} from your current Age.` : ' Needs a Town Center.';
    const unlocks = [...Object.values(BUILDINGS), ...Object.values(UNITS).filter(u => u.trainable !== false)].filter(d => d.age === next).map(d => d.name);
    stats = unlocks.length ? row('Unlocks', unlocks.join(', '), true) : '';
  }
  return `<div class="tip-h"><span class="orb">${icon(ic, cls)}</span><div><h4>${title}</h4><span class="sub">${sub}</span></div></div>`
    + `<p>${desc}</p><dl>${stats}</dl><div class="tip-cost">${costHtml(cost, short)}</div>`
    + notes.map(n => `<p class="note">${n}</p>`).join('');
}
