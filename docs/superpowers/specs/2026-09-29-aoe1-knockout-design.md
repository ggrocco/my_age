# AoE1-style Knockout Tournament — Design Spec

Date: 2026-09-29
Status: Draft, awaiting user review

## Goal
A browser game (Three.js) that plays like the original Age of Empires (1997): isometric RTS with
gathering, building, Age progression, unit combat, fog of war, AI opponents. Structured as a
knockout bracket of 1v1 matches; each round is a different real AoE1 game type. The loser of each
match is eliminated; the player must win every round to win the tournament.

## Non-goals (stated up front)
- Original art/sound/campaign/multiplayer. Art is placeholder low-poly generated in code.
- Full tech tree or multiple civilizations: one civ, a subset of units/buildings/techs.
- Exact original balance. Costs/stats are approximations from memory and are NOT verified
  against the real game.

## Architecture
Deterministic simulation core, separate from rendering.
- Fixed tick (50 ms = 20 ticks/s), seeded RNG, no DOM/Three.js imports in `sim/`.
- Runs unchanged in browser and Node (headless bot-vs-bot tests).
- Renderer reads sim state each frame and interpolates; input UI issues commands into the sim.

### Modules
| Module | Responsibility | Depends on |
|---|---|---|
| `sim/map` | Tile grid, terrain, resource placement, seeded generation | rng |
| `sim/path` | A* pathfinding on tile grid | map |
| `sim/entities` | Units, buildings, resources, orders, movement, combat | map, path, data |
| `sim/economy` | Gathering, drop-off, costs, population cap | entities |
| `sim/ages` | Age advancement, unlock gating | data |
| `sim/vision` | Fog of war / explored state per player | map, entities |
| `data/` | Unit, building, age, cost tables | none |
| `ai/` | Build-order AI (easy/medium/hard) issuing commands like a player | sim commands only |
| `rounds/` | Game-type rules: setup, win check, time-cap tiebreak | sim |
| `tournament/` | Bracket, advancement, off-screen bracket matches via AI-vs-AI | rounds, ai |
| `render/` | Three.js ortho isometric view, sprites, minimap, fog | sim (read-only) |
| `ui/` | Resource bar, command panel, selection, orders, menus | sim commands |
| `test/` | Headless runner asserting each round ends with a valid result | sim, ai, rounds |

## Content (subset)
- Units: Villager, Clubman, Axeman, Bowman, Spearman, Slinger, Hoplite, Swordsman, Scout,
  Horse Archer, Catapult.
- Buildings: Town Center, House, Granary, Storage Pit, Barracks, Archery Range, Stable,
  Market, Government Center, Wonder.
- Ages: Stone, Tool, Bronze, Iron.
- Resources: food, wood, gold, stone.

## Rounds (bracket of 1v1)
| Round | Game type | Win condition |
|---|---|---|
| R1 | Standard (conquest) | Destroy all enemy units/buildings |
| R2 | Death Match | Conquest, start with large resources |
| R3 | Regicide | Kill the enemy king |
| R4 | Wonder Race | Build a Wonder and survive its countdown |
| R5 | Capture the Relics (final) | Hold all relics for the countdown |

Every round has a hard time cap. At the cap the winner is decided by score
(units killed, resources, buildings), so no match can stall. Other bracket matches are
AI-vs-AI simulated off-screen.

## AI
Scripted build-order opponent: gather, house, expand, age up, train army, attack.
Three difficulty levels (gather-rate/decision-delay differences). Uses the same commands as
the human player (no cheating on rules, except optional resource handicap on hard).

## Testing
1. Headless: for every round type, run N seeded AI-vs-AI matches in Node; assert the match
   terminates before the cap+margin with a valid winner, no exceptions, no NaN state, and
   population/resource invariants hold.
2. Browser: launch each round in real Chrome, take screenshots, check the console for errors.
3. Final report separates: what bots verified / what screenshots verified / what only a human
   can judge (game feel, controls, balance, fun) / what is missing.

## Risks
- Scope: full AoE1 is very large; this is a vertical slice.
- Pathfinding and combat cost with many units (perf) — cap population (~50/player).
- AI quality: bots prove rounds end, not that matches are good.
- Balance numbers unverified.

## Delivery
Static site: `index.html` + ES modules, Three.js loaded from a CDN or vendored. Open via a
local static server. No backend.
