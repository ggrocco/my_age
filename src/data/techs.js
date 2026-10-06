// Researchable upgrades. The *mechanic* (research at a building, global effect) follows AoE1;
// the military tech names echo AoE1's Storage Pit / Government Center tiers, but the exact costs,
// research times and placements are game-tuned approximations (openage's docs do not contain a
// clean AoE1 tech tree — see src/data/README.md). No AI-Future techs for now.
//
// effect shapes (all applied exactly once per unit — at spawn and at completion):
//   { cls: ['inf','cav'], atk: 2 }            -> +atk to units of those classes
//   { cls: ['inf'], marmor: 1, parmor: 1 }    -> +armor
//   { cls: ['archer','siege'], range: 1 }     -> +range
//   { gather: { wood: 1.25 } }                -> multiplies a player's gather rate (not per-unit)
const c = (food = 0, wood = 0, gold = 0, stone = 0) => ({ food, wood, gold, stone });

export const TECHS = {
  // --- Storage Pit: military ---
  bronze_weapons: { name: 'Bronze Weapons', building: 'storage_pit', age: 'tool', cost: c(80, 0, 40), time: 40,
    effect: { cls: ['inf', 'cav'], atk: 2 }, desc: 'Infantry and cavalry deal +2 attack.' },
  iron_weapons: { name: 'Iron Weapons', building: 'storage_pit', age: 'bronze', cost: c(120, 0, 80), time: 50, requires: 'bronze_weapons',
    effect: { cls: ['inf', 'cav'], atk: 2 }, desc: 'Infantry and cavalry deal +2 more attack. Needs Bronze Weapons.' },
  bronze_shields: { name: 'Bronze Shields', building: 'storage_pit', age: 'tool', cost: c(0, 60, 60), time: 40,
    effect: { cls: ['inf'], marmor: 1, parmor: 1 }, desc: 'Infantry gain +1 melee and +1 pierce armor.' },

  // --- Government Center: military ---
  ballistics: { name: 'Ballistics', building: 'government_center', age: 'bronze', cost: c(0, 80, 120), time: 45,
    effect: { cls: ['archer', 'siege'], range: 1 }, desc: 'Archers and siege engines gain +1 range.' },

  // --- Market: economy ---
  woodworking: { name: 'Woodworking', building: 'market', age: 'tool', cost: c(0, 0, 75), time: 30,
    effect: { gather: { wood: 1.25 } }, desc: 'Villagers gather wood 25% faster.' },
  gold_mining: { name: 'Gold Mining', building: 'market', age: 'tool', cost: c(120, 0, 0), time: 30,
    effect: { gather: { gold: 1.25 } }, desc: 'Villagers mine gold 25% faster.' },
};

// Apply a unit effect to one unit. Idempotent per tech: called once when the unit spawns and once
// when a tech completes for existing units, so each unit receives each tech exactly once.
export function applyUnitEffect(u, eff) {
  if (!eff || eff.gather) return;
  if (eff.cls && !eff.cls.includes(u.cls)) return;
  if (eff.atk) u.atk += eff.atk;
  if (eff.marmor) u.marmor += eff.marmor;
  if (eff.parmor) u.parmor += eff.parmor;
  if (eff.range) u.range += eff.range;
}
