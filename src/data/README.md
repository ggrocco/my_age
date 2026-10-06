# Data tables

Unit **combat and cost stats** (HP, attack, range, train time, cost) are now verified against the
openage project's reverse-engineered AoE1 manual data
(`doc/reverse_engineering/unit_stats/unit_stats_aoe.csv`, "copied from the original game manual of
Age of Empires I"). Building stats, the Slinger, Spearman, age-up costs and all AI-Future content
have **no entry** in that source and remain **unverified approximations** from memory.

Ruling deviations from the spec's content list (recorded in `progress.md`):
- Farm added (food economy needs a renewable source).
- Wonder requires Bronze Age (spec's round setup starts players rich; original needs Iron).
- Catapult trains at the Government Center (no Siege Workshop in the subset).
- King exists only for Regicide (not trainable).

## Deviations from the verified AoE1 unit stats

The stat pass kept the game's own age placements and a few balance choices rather than copying AoE1
exactly:
- **Unit age placements kept.** AoE1's manual puts e.g. the Horse Archer in Age IV (Iron); this game
  keeps it in Bronze, and keeps the Swordsman line in Iron and the Hoplite in Bronze. Only the
  combat/cost numbers were reconciled, not the tech-tree tier.
- **`swordsman` uses AoE1 *Legion* stats (160 HP / 13 atk).** The bronze Hoplite is authentically
  elite (120/17), so the iron unit was mapped to the top of the swordsman line (Legion) to stay
  relevant — tankier where the Hoplite hits harder — instead of becoming a downgrade.
- **Catapult range (9) kept as the one deviation.** AoE1's manual gives range 12; it stays 9 so the
  invented future **Railgun** (range 11) still out-ranges it. Attack (50 → 60) and cost (→ 180 wood /
  80 gold) were corrected to the manual values.
- **Swordsman cost kept at 60 food / 40 gold.** It uses AoE1 Legion's HP/attack/train time, but
  Legion's own cost (35 food / 15 gold) assumes the full AoE1 upgrade investment; the higher cost is
  kept so a 160-HP unit isn't dirt cheap before techs exist.
- **Spearman and Slinger are not AoE1 units** (no manual entry); left at their from-memory values.
- **Unit sight** largely kept at the from-memory values rather than AoE1 LOS, to avoid destabilising
  vision/aggro; only Scout (10 → 8) and the ranged units were nudged toward their LOS.
- **Reload times not reconciled.** The sim uses per-class attack cooldowns (archer 40 / siege 80 /
  other 30 ticks), not AoE1's per-unit reload times (e.g. Bowman 1.4 s = 28 ticks, Scout 0.9 s = 18,
  Catapult 5 s = 100). Kept class-based to preserve the cooldown model and its test; a known fidelity gap.

## Combat model (melee/pierce armor + attack type)

Units now carry `atkType` (`melee`/`pierce`), `marmor` (melee armor) and `parmor` (pierce armor)
instead of a single `armor`, matching the openage AoE1 damage model
(`doc/reverse_engineering/game_mechanics/damage.md`). Values come from the CSV's `Att. Type`,
`M. Arm` and `P. Arm` columns (e.g. Hoplite melee armor 5, Horse Archer pierce armor 2, and AoE1 siege
`Att. Type = M`, so Catapult deals *melee* damage). Damage is
`max(1, max(0, atk − matchingArmor) + bonusVsClass)`.

Deviations / designed choices (not 1:1 from the manual):
- **Buildings carry melee armor 3 / pierce armor 8**, replacing the old flat "buildings take 0.5×
  from non-siege" rule. Effect: archers (pierce) barely scratch buildings; melee and siege damage
  them normally. The uniform value is a game simplification (AoE1 varies armor per building/tower).
- **Spearman gets +8 attack vs cavalry.** The Spearman is not an AoE1 unit, so this anti-cavalry
  bonus is a game-design choice (it gives the game's own counter unit a role), recorded here.
- **Scout gets +5 attack vs infantry.** Sourced from AoE1's Cavalry line, whose manual entry reads
  "+5 attack vs. infantry" (the Scout is this game's only `cav`-class melee unit).
- The invented Future units get designed armor split values (Mech 5/3, Drone 0/1, Railgun 0/0) and
  attack types (Railgun = pierce), with no AoE1 source.

## Technologies (`techs.js`)

Researchable upgrades were added so the Market and Government Center (which previously only counted
toward age-up) have a purpose. The *mechanic* — research at a building, apply a global effect — is the
AoE1 model; the military tech names echo AoE1's Storage Pit / Government Center tiers. **openage's docs
do not contain a clean AoE1 tech tree**, so the specific costs, research times and placements are
game-tuned designed approximations, not sourced values:
- Storage Pit: **Bronze Weapons** (+2 attack, infantry/cavalry), **Iron Weapons** (+2 more, requires
  Bronze Weapons), **Bronze Shields** (+1 melee & +1 pierce armor, infantry).
- Government Center: **Ballistics** (+1 range, archers & siege).
- Market: **Woodworking** (+25% wood gather), **Gold Mining** (+25% gold gather).

Costs are deliberately mixed across resources (not gold-only) so researching does not starve age-ups.
Effects apply once per unit (at spawn and when a tech completes for already-built units).

## Invented content (AI Future)

The **AI Future age** (the 5th age, after Iron) and the units **Combat Drone**, **Mech Walker** and
**Railgun** are invented for this game; they do not exist in the original Age of Empires I. Drones are
trained at the Archery Range, Mech Walkers at the Barracks and Railguns at the Government Center.
Their costs and stats are guesses like the rest of the table, as is the age-up cost (1200 food,
1200 gold, 300 stone, 60 s).
