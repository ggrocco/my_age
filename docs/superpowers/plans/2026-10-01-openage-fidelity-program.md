# Improve `my_age` using openage as a design reference

## Context

The request: "analyze the openage repo and improve my game based on it." openage
(SFTtech) is a C++20/Python/Qt engine clone of the Genie engine; its own gameplay
sim is mid-rebuild and **non-functional**, and it shares no language or runtime with
this JS/three.js browser game. So there is **no code to port**. Its transferable
value is *design knowledge*, which this plan draws from four openage docs that were
read directly (not inferred):

- `doc/reverse_engineering/unit_stats/unit_stats_aoe.csv` — authentic AoE1 unit
  stats, "copied from the original game manual of Age of Empires I." Confirms a
  **melee/pierce armor split** (`M. Arm`, `P. Arm`), an **attack-type** column
  (`M`/`P`), reload time, LOS, range and accuracy.
- `doc/reverse_engineering/game_mechanics/damage.md` — the Genie damage formula
  `max(1, max(0, melee_dmg − melee_arm) + max(0, pierce_dmg − pierce_arm) +
  Σ max(0, bonus − resist))`, explicitly covering AoE1.
- `doc/reverse_engineering/scoring.md` — AoE1's real score breakdown
  (military / economy / technology / religion / survival+wonders).
- `market.md` and `rates.md` were checked and are **AoE2-only**; they are *not*
  used as AoE1 sources (see Phase 3 honesty note).

The user chose **all four** improvement directions. They are sequenced below by
dependency and risk (lowest-risk data work first; each phase is independently
shippable and testable). `src/data/README.md` says every current stat is an
"unverified approximation… from memory," so this is squarely "based on openage."

**Cross-cutting rule (from CLAUDE.md):** anything player-visible must be verified in
a real browser via `preview_start` (name `my-age`) with a screenshot + clean
console, in addition to `npm test`. Every adopted deviation from AoE1 must be
recorded in `src/data/README.md` and `progress.md`, following the existing ruling
convention.

---

## Phase 1 — Stat accuracy pass (unit stats only)

Replace the from-memory numbers with values verified against `unit_stats_aoe.csv`.
This runs first because Phases 2–4 build on correct baselines. **Not low-risk** —
it is the biggest balance swing in the program (see below).

**Files:** `src/data/units.js` (`UNITS`); docs `src/data/README.md`, `progress.md`.
`buildings.js`, `ages.js` (`AGE_COST`) and the Slinger have **no CSV source** (the
file contains no buildings, no Slinger, no age costs) — leave them unchanged this
phase.

**Get exact bytes, not WebFetch output.** The numbers seen during planning came
through WebFetch's summarizing model (the `.txt` fetch failed; the `Acc.` column
mirrored `R` on every row, which looks garbled). Execution must pull the raw file
with `curl` and read actual columns:
`curl -s https://raw.githubusercontent.com/SFTtech/openage/master/doc/reverse_engineering/unit_stats/unit_stats_aoe.csv`.
Column order is `Name,Age,HP,Att.,Att.Type,ReloadTime,M.Arm,P.Arm,LOS,R,Acc.,Speed,
Tr.Time,Food,Wood,Stone,Gold,Special`. Two traps: **`LOS` ≠ `R`** (Horse Archer is
LOS 9 / **range 7**; Bowman is LOS 7 / **range 5**, so the game's bowman range 7 is
*wrong*, not right), and the CSV cost order is **Food,Wood,Stone,Gold** whereas the
game's `c()` helper is **food,wood,gold,stone** — do not swap gold/stone.

**Representative discrepancies to reconcile** (game → AoE1 manual, verify against the
curl'd CSV): Clubman atk 5 → 3; Axeman atk 7 → 5, cost 50/20 → 50 food; Hoplite
hp 75/atk 9 → **120 / 17**; Horse Archer hp 50/atk 5/range 6 → 60 / 7 / **range 7**;
Catapult/Stone Thrower range and reload. The game "swordsman" maps to AoE1's
**Long Swordsman** (not Short/Broad) — confirm hp/atk from the full CSV.

**Armor sequencing (design decision):** armor is **not** touched in Phase 1. Today a
single `armor` applies against every attack, so AoE1's split values can't be
represented (Hoplite M.Arm 5 / P.Arm 0 would make it near-immune to arrows; Horse
Archer 0/2 is inexpressible). The melee/pierce split + attack type is adopted in
Phase 2; Phase 1 leaves each unit's existing `armor` as-is.

**Known balance knock-ons to handle, not ignore:**
- Hoplite 75/9 → 120/17 makes the Bronze Hoplite outclass the Iron "swordsman"
  (100/12). Revisit the bot's `bestUnit` preference order in `src/ai/bot.js`.
- The CSV `Age` column (I–IV) disagrees with the game (e.g. Horse Archer is IV/Iron
  in AoE1, Bronze here). **Keep the game's age placements**; only reconcile the
  combat/cost stats. Record this as a deliberate deviation.
- Keep all invented content unchanged: Farm, Wonder@Bronze, Catapult@Gov Center,
  King, the `future` age and Drone/Mech/Railgun (no AoE1 source).

**Verify:** `npm test` (esp. `data.test.js`, `build.test.js`, `combat.test.js`,
`econ.test.js`); rerun `node test/bot-sim.js 12` to confirm all five rounds still
terminate; expect tuned timings (e.g. the regicide 12000-tick window) to need
re-tuning, not just to stay green; browser check that tiles/tooltips show new
numbers.

---

## Phase 2 — Attack/armor-class counters (combat depth)

Adopt the AoE1 damage model from `damage.md`: split the single `armor` into
**melee + pierce armor**, give each unit an **attack type**, and (optionally) a
small **bonus-vs-class** table. This is the signature AoE combat mechanic and uses
the `cls` field (civ/inf/archer/cav/siege) that combat currently ignores.

**Files:** `src/data/units.js` + `buildings.js` (new fields), `src/sim/orders.js`
(`hit()`, `doAttack`, `aggro`), possibly `src/sim/game.js` (`damage`), `src/ai/bot.js`
(`bestUnit` counter-picking), `src/ui` tile/tooltip rendering, and tests.

**Data model change:**
- Units: replace `armor` with `marmor` (melee) and `parmor` (pierce); add
  `atkType: 'melee' | 'pierce'` (archers/horse-archer/drone/railgun = pierce; rest
  = melee); optional `bonus: { cav: N, archer: N, ... }` keyed by `cls`.
- Buildings: give `marmor`/`parmor` so the existing "buildings take 0.5× from
  non-siege" rule is replaced by authentic high pierce armor (archers weak vs
  buildings, siege strong) — record this as a deviation decision.

**Damage formula** in `hit()` (replacing `dmg = max(1, atk - armor)`), matching
`damage.md`'s per-term clamp so a negative base can't cancel the bonus:
`base = atkType === 'pierce' ? atk - target.parmor : atk - target.marmor;`
`bonus = attacker.bonus?.[target.cls] || 0;`
`dmg = max(1, max(0, base) + bonus);` — preserve the min-1 floor and the splash
0.5× / no-friendly-fire behaviour.

**Bot counter-picking (required, per `progress.md`'s "weak/noisy difficulty" gap):**
a static `bestUnit` preference list will make the bot *worse* under counters. Extend
`bestUnit` (and/or `orderArmy`) to weight unit choice against the enemy army's
dominant `cls` (e.g. prefer melee/high-pierce-armor units when the enemy is archer-
heavy). Keep the siege cap at 2.

**Tooltips:** `ui-tiles.test.js` asserts every unit has a description; update
descriptions/tiles to mention attack type and notable bonuses so the test and the
HUD stay truthful.

**Verify:** extend `combat.test.js` with counter cases (pierce vs pierce-armor,
melee vs melee-armor, bonus-vs-class, building armor); `npm test`; rerun
`node test/bot-sim.js 12` **and** `matches.test.js` (combat changes shift cap-hit /
termination rates); browser: stage two armies via `window.__app.match.game` and
confirm counters resolve as expected with a clean console + screenshot.

---

## Phase 3 — Tech / upgrade system (strategic depth; gives Market & Gov Center a purpose)

Market and Government Center currently only count toward age-up. Add researchable
upgrades that apply global modifiers to a player's units — the core AoE1 economy/
military progression.

**Honesty note:** the openage docs read here do **not** cleanly document the AoE1
tech tree (`market.md`/`rates.md` are AoE2; `research.md` returned unrelated
content). So this phase grounds the *mechanic* in the AoE1 unit-upgrade tiers
visible in the CSV (e.g. Bowman→Improved→Composite attack/range tiers; Swordsman
line) and otherwise treats specific tech names/costs/placements as **designed
approximations**, recorded in `README.md`/`progress.md` exactly like the existing
invented-content rulings — not attributed to openage.

**Files:** `src/data/` new `techs.js` (tech table: id, building, age, cost,
research time, effect); `src/sim/commands.js` (`execute` — new `research` command,
afford/age/building gating mirroring `train`); `src/sim/game.js` (per-player
`techs` set + an effect-application step read by `hit()`/gather/`recount`);
`src/ai/bot.js` (research priorities in `think()`); `src/ui` (research buttons on
Storage Pit / Market / Government Center + tooltips); tests.

**Scope (representative, kept small for a first cut):**
- Military: a melee-attack tier and a melee/pierce-armor tier (Storage Pit).
- Economy: a wood/gold gather-rate tier and a farm-food tier (Market).
- One Government Center tech (e.g. +LOS or +siege) to give it identity.
- Effects are flat global modifiers applied when damage/gather/pop is computed, so
  they compose with Phase 2's formula.

**Verify:** new `techs.test.js` (research gating, affordability, effect actually
changes a unit's output); `npm test`; `node test/bot-sim.js 12`; browser: research
a tech through the real HUD on each building and confirm the stat change on a unit.

---

## Phase 4 — AoE1 scoring alignment (small, self-contained)

Rework `scoreOf` to mirror `scoring.md`'s AoE1 breakdown so close matches resolve at
the time cap the way the original game would, and so Phase 3's techs feed a real
technology-score term.

**Files:** `src/rounds/index.js` (`scoreOf`, used by `tiebreak`/`capCheck`);
`src/sim/game.js` (add a per-player `losses` counter for generalship — currently
only `kills`/`bdestroyed`/`gathered` exist); tests.

**Current:** `kills + 3*bdestroyed + gathered/50 + 2*buildings + units/2`.
**Target (from `scoring.md`, scaled to this game's quantities):** military
(kills, buildings destroyed, generalship = kills−losses — needs the new `losses`
counter), economy (resources gathered, villager count, % explored), technology
(techs researched ×2 — real only once Phase 3 lands), and religion mapped onto this
game's **relics** (AoE1 gives 10/artifact + 50 for all; relics already tracked).
Keep deterministic tie resolution (lower player index wins exact ties).

**Do not double-count:** `scoreOf` must stay distinct from the per-round cap
bonuses (`wonder` hold/20, `relics` count×5) — reconcile so a relic/wonder isn't
rewarded by both. Note that AoE1's +100 "survived to game end" is a no-op here
(at the time cap both players are alive, else conquest already ended it), so drop it
or document why it's inert.

**Verify:** update `rounds.test.js` scoring assertions; `npm test`; confirm every
round still returns a winner at cap and bot-vs-bot matches still terminate
(`node test/bot-sim.js 12`).

---

## Sequencing & integration

Do the phases in order on a feature branch; each is a shippable increment with its
own tests green before starting the next (Phase 1 is shippable because it leaves
armor untouched). Phase 1 sets baselines; Phase 2 needs Phase 1's stats and adds the
armor split; Phase 3's modifiers plug into Phase 2's damage/gather paths; Phase 4
reads Phase 3's tech counts. After each phase, run the full `npm test` suite, rerun
`node test/bot-sim.js 12`, and do the browser check for anything player-visible.
Record every AoE1 deviation in `src/data/README.md` and `progress.md`.

**Re-verify the tournament seed.** `progress.md` notes tournament seed 6 was chosen
*because* the hard bot wins all 5 rounds; every phase changes match outcomes, so
after each phase re-confirm (or re-pick) that seed and update any seed-dependent test
fixtures and tuned tick windows accordingly.

## End-to-end verification (whole program)

1. `npm test` — all suites green (data, build, combat, econ, rounds, ai, matches,
   tournament, ui-tiles, plus new `techs.test.js` and extended `combat.test.js`).
2. `node test/bot-sim.js 12` — all five rounds terminate across seeds.
3. `preview_start` (`my-age`) → `http://localhost:8000/?round=1&opp=hard&seed=1`:
   screenshot a battle showing counters, research a tech through the HUD, confirm a
   clean console (CLAUDE.md requires a real-browser check of player-visible changes).
4. `?autotour=1` reaches a champion/eliminated screen with no console errors.
