# Per-Age 3D Upgrade and AI Future Age — Design Spec

Date: 2026-09-29
Status: Draft, awaiting user review

## Goal
Improve the quality of all 3D in the game and make every age look distinct, from Stone Age to a new
fifth age, **AI Future**: Stone → Tool → Bronze → Iron → AI Future. Buildings re-skin as their owner
advances (as in AoE1). The AI Future age adds light gameplay: three units, no new buildings.

## Confirmed decisions (from brainstorming)
- New age scope: **visual + light gameplay** (not visuals-only, not a full new age).
- Assets: **procedural models for everything, plus an optional glTF override loader.** No downloads by
  Claude; the user picks and downloads any `.glb` files. No art derived from Age of Empires.
- Phone performance (iPhone layout) must not regress; models stay merged (few draw calls each).

## Non-goals
- New AI Future buildings, techs, or a new resource; balance beyond "plausible and testable".
- Changes to the bracket, round rules, or fog-of-war logic.
- Skeletal animation from imported models (imported models are static; procedural ones keep animating).

## Current state (facts)
- `src/data/ages.js`: `AGES = ['stone','tool','bronze','iron']`, `AGE_COST` per age.
- `src/render/models.js`: procedural low-poly builders (`B` merge class, `limbs`, `horse`, `catapult`,
  `buildingGeos`, nature). Models are cached per type/owner and are **not** age dependent.
- Player age lives in `game.players[i].age`; `ageUpProblem` needs a Town Center plus up to two buildings
  of the *current* age (iron has none, so it never blocks).
- Bot (`src/ai/bot.js`) advances until `AGES.length - 1` and picks units from data, so a 5th age is
  picked up if data and unit choice are extended.

## Design

### 1. Age system and new units (sim + data + bot)
- `AGES` gains `'future'`; `AGE_COST.future` (approx. food 1200, gold 1200, stone 300; 60 s). Values are
  unverified approximations, like the rest of the data tables.
- Three units, all `age: 'future'`, trained at existing buildings:
  | Unit | Class | Trained at | Role |
  |---|---|---|---|
  | Combat Drone | archer (hovers) | Archery Range | fast ranged |
  | Mech Walker | inf | Barracks | heavy infantry |
  | Railgun | siege | Government Center | very long range, splash |
- `BUILDINGS.*.trains` updated; HUD lists them via existing data-driven menus.
- Bot: army selection prefers the highest-age units it can afford; advancing to `future` follows the
  existing `AGES.length - 1` loop. Bot-sim termination test (`test/bot-sim.js`) must still pass.
- Age tables and unit stats are the only sim changes; determinism is preserved.

### 2. Style system (render)
- New module `src/render/styles.js`: one style object per age (palette, material roughness/metalness,
  emissive accent color, sky/ground tint). Pure data, no Three.js state.
- Builders in `models.js` take `(type, owner, age)`; the cache key becomes `type:owner:age`.
- To keep `models.js` from growing further, per-age building geometry moves to
  `src/render/buildings.js` and humanoid/unit geometry to `src/render/units.js`; `models.js` keeps
  `buildModel`, `animate`, caching and the merge helper `B`.
- A model is rebuilt (swap of cached geometry on the entity's group) when its owner's age changes.
  Unit models change only for villagers (age-based outfit); combat units are tied to their unit age.

### 3. Building visuals per age
Town Center, House, Granary, Storage Pit, Farm, Barracks, Archery Range, Stable, Market, Government
Center, Wonder each get a variant per age (11 buildings × 5 ages):
- **Stone:** hide, thatch, logs. **Tool:** timber, stone. **Bronze:** brick, columns.
  **Iron:** fortified stone, battlements. **AI Future:** glass, brushed metal, holograms, neon trim.
- Under-construction scaffolding is kept (color per age; future uses a light-frame look).
- Footprint (`size`) and hit areas do not change, so pathing and placement are unaffected.

### 4. Unit visuals
- Humanoids: better proportions, layered armor, more detailed weapons and shields per unit.
- Villagers: outfit by owner age (hides → cloth → leather/metal → future suit).
- Improved horse and catapult; new models for Combat Drone (hover bob, thruster glow), Mech Walker
  (leg-swing walk, arm cannon), Railgun (rotating barrel, recoil on fire).
- New animation cases added to `animate()`.

### 5. Rendering quality
- Lighting: hemisphere + directional light, soft shadows; per-age sky/ground tint via `styles.js`.
- Emissive glow: a second merged mesh with `MeshBasicMaterial` (vertex colors) for lit parts, so glow
  costs one extra draw call per model at most.
- Nature/terrain: more varied trees, rocks, ground detail; future-age tint only affects the sky/lighting,
  not the map layout.
- Age-up effect: brief flash and ring at the building/Town Center; models swap under the flash.

### 6. Optional glTF override
- Files: `assets/models/<age>/<type>.glb` (units: `assets/models/<age>/<unitType>.glb`).
- `buildModel` first checks a manifest (`assets/models/manifest.json`, generated/edited by hand, lists
  existing files). Missing entry, missing file, or load error → procedural model. The game works with
  zero files.
- Loaded via three.js `GLTFLoader`, normalized: scaled to the building footprint or unit height, placed
  on ground, mesh material named `team` recolored per owner.
- Static only; no rig animation. Procedural animated parts are not applied to imported models.
- Size check: console warning above a triangle budget (default 5k per model).
- `assets/CREDITS.md`: required entry (source, author, license) for each file; no model is added without
  one, and nothing derived from Age of Empires art.

## Testing
- Unit tests: `data.test.js` extended for the 5th age and new units (costs, age gating, `trains`);
  `econ`/`combat` tests for the new units; `bot-sim` termination across seeds with the 5th age.
- New style test: every age has a complete style entry; every building type has a model for every age
  (builders don't throw, non-empty geometry).
- glTF loader test: missing manifest/file falls back to procedural.
- Visual check: screenshots per age (building sheet and unit sheet) plus phone viewport (portrait and
  landscape) of the AI Future age, saved under `shots/`.
- Performance check: draw-call count and frame rate in the phone layout compared to before.

## Delivery plan (three implementation plans)
1. **Age system + new units**: data, sim, bot, tests, HUD lists.
2. **Buildings + environment per age**: `styles.js`, `buildings.js`, lighting, glow, age-up effect.
3. **Units + glTF loader**: `units.js`, new unit models and animation, override loader, credits file.

## Risks
- Visual work is judged by eye; screenshots are the only automated evidence and feel is not verified.
- Bot balance with the new units is untested by a human; only termination is checked.
- Rebuilding models on age-up must not leak geometries (dispose old when unused).
