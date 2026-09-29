# AoE1-style Knockout Tournament Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser Three.js game: a 5-round knockout bracket of 1v1 AoE1-style RTS matches vs AI.

**Architecture:** A deterministic headless sim (`src/sim`, fixed 50 ms tick, seeded RNG, no DOM) driven by commands. AI and human both issue the same commands. Rounds are rule objects layered on the sim. Three.js renderer and DOM UI only read sim state and enqueue commands. A Node harness runs bot-vs-bot matches to prove each round terminates.

**Tech Stack:** Plain ES modules, Node >= 20 (`node:test`), Three.js (npm, served statically via import map), `python3 -m http.server` for browser runs. No bundler.

**Spec:** `docs/superpowers/specs/2026-09-29-aoe1-knockout-design.md`

## Global Constraints

- Tick = 50 ms (20 ticks/s); `src/sim/**` must not import DOM or three.
- All randomness through `src/sim/rng.js` (seeded mulberry32). No `Math.random` in `src/sim`, `src/ai`, `src/rounds`.
- Content limited to the spec subset (units, buildings, 4 Ages, 4 resources, 5 rounds).
- Every round has a hard tick cap and score-based tiebreak; no match may run forever.
- Population cap 50 per player.
- Costs/stats are approximations and must be labelled unverified in `src/data/README.md`.
- No external art or audio; all visuals are generated from primitives.

## Review Focus

- Unit ordered to an unreachable tile (walled in / water): must not loop forever or crash; it stops.
- Both players eliminated on the same tick: round must still resolve (tiebreak by score, then player id).
- Player with zero villagers and zero resources cannot recover: match must still end at the cap, not stall.
- Training with insufficient resources or at pop cap: command rejected, resources unchanged.
- Building placed on occupied/out-of-bounds tiles or in fog-blocked area: rejected, no resources spent.
- Wonder/relic timers must pause or reset correctly if the holder is destroyed mid-countdown.

---

### Task 1: Scaffold, RNG, data tables

**Files:**
- Create: `package.json`, `src/sim/rng.js`, `src/data/units.js`, `src/data/buildings.js`, `src/data/ages.js`, `src/data/README.md`, `test/rng.test.js`, `test/data.test.js`

**Interfaces:**
- Produces: `makeRng(seed) -> {next():number in [0,1), int(n):number}`; `UNITS[id] = {hp, atk, range, speed, cost:{food,wood,gold,stone}, trainTime, age, from}`; `BUILDINGS[id] = {hp, cost, size, buildTime, age, trains:[unitIds]}`; `AGES = ['stone','tool','bronze','iron']`, `AGE_COST[age]`.

- [ ] **Step 1:** `npm init -y`, set `"type":"module"`, script `"test":"node --test test/"`, `npm i three`.
- [ ] **Step 2:** Write failing tests: same seed gives same 5 values, different seeds differ; every unit/building has non-negative costs and a valid age; every building's `trains` ids exist in `UNITS`.
- [ ] **Step 3:** Run `npm test`, expect FAIL (modules missing).
- [ ] **Step 4:** Implement rng and data tables for the spec subset; write the unverified-numbers note in the data README.
- [ ] **Step 5:** Run `npm test`, expect PASS.

### Task 2: Map generation and A* pathfinding

**Files:** Create `src/sim/map.js`, `src/sim/path.js`, `test/map.test.js`, `test/path.test.js`

**Interfaces:**
- Consumes: `makeRng`
- Produces: `generateMap(seed, size=64) -> {size, tiles:Uint8Array (0 grass,1 water,2 forest), resources:[{id,type,x,y,amount}], starts:[{x,y},{x,y}]}`; `findPath(map, blocked:(x,y)=>bool, from, to) -> [{x,y}] | null`.

- [ ] **Step 1:** Failing tests: same seed gives identical map; both start areas are walkable and mutually connected; each start has trees, food and gold/stone within 15 tiles; `findPath` returns a path around a wall, returns null when the target is enclosed, and returns `[]` when from equals to.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement generation (water patches placed so connectivity is verified; regenerate with the next seed if the check fails) and A* (8-neighbour, no corner cutting, iteration cap to guarantee termination).
- [ ] **Step 4:** Run, expect PASS.

### Task 3: Sim core: entities, commands, movement, gathering

**Files:** Create `src/sim/game.js`, `src/sim/commands.js`, `test/econ.test.js`

**Interfaces:**
- Consumes: map, path, data.
- Produces: `createGame({seed, players:2, rules}) -> game`; `game.tick()`; `game.command(playerId, cmd)` where cmd is one of `{type:'move',ids,x,y}`, `{type:'gather',ids,resourceId}`, `{type:'build',ids,building,x,y}`, `{type:'train',buildingId,unit}`, `{type:'attack',ids,targetId}`, `{type:'age'}`; returns `{ok:boolean, reason?:string}`; `game.state` with `tick`, `players[i].res`, `players[i].age`, `entities` (Map id to entity with `kind,owner,x,y,hp,order`).

- [ ] **Step 1:** Failing tests: a villager ordered to a tree walks, gathers wood, returns to the Town Center, and player wood increases; a move to an unreachable tile ends in an idle unit with no exception; the game is deterministic (two runs with the same seed and commands give identical `JSON.stringify(state)` at tick 500).
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement the tick loop (orders to movement along the path with repath limit, gather to carry cap of 10 then drop-off at the nearest Town Center/Granary/Storage Pit, resource depletion).
- [ ] **Step 4:** Run, expect PASS.

### Task 4: Buildings, training, Ages, population

**Files:** Modify `src/sim/game.js`, `src/sim/commands.js`; Create `test/build.test.js`

- [ ] **Step 1:** Failing tests: build order deducts cost and constructs over time; a placement on an occupied or out-of-bounds tile is rejected and nothing is spent; training at pop cap or with insufficient resources is rejected with resources unchanged; a House raises the pop cap; the `age` command needs the cost plus the required building and unlocks Tool-Age units only after completion; a unit above the current age is rejected.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement build, construction progress by number of builders, the training queue, pop cap (10 from TC, +4 per House, hard cap 50), and age-up timer.
- [ ] **Step 4:** Run, expect PASS.

### Task 5: Combat

**Files:** Modify `src/sim/game.js`; Create `test/combat.test.js`

- [ ] **Step 1:** Failing tests: melee unit chases and kills an idle target; a ranged unit attacks at range without moving; dead entities are removed and their owner's counts update; a unit auto-engages an enemy within 6 tiles when idle; buildings can be destroyed; a Catapult deals splash damage to buildings.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement targeting, attack cooldowns, damage with simple armor, auto-aggro, and death cleanup.
- [ ] **Step 4:** Run, expect PASS.

### Task 6: Fog of war

**Files:** Create `src/sim/vision.js`, `test/vision.test.js`

**Produces:** `visibleTo(game, playerId, x, y) -> 'hidden'|'explored'|'visible'`; per-player explored bitset updated each tick.

- [ ] **Step 1:** Failing tests: a tile far from all owned entities is hidden; after a unit walks past, it is explored; enemy entities in hidden tiles are excluded from `game.visibleEntities(playerId)`.
- [ ] **Step 2 to 4:** Run FAIL, implement (radius sight per entity), run PASS.

### Task 7: Rounds and time caps

**Files:** Create `src/rounds/index.js`, `conquest.js`, `deathmatch.js`, `regicide.js`, `wonder.js`, `relics.js`, `test/rounds.test.js`

**Interfaces:**
- Produces: `ROUNDS = [ {id, name, setup(game), check(game) -> null | {winner, reason}, capTicks} ]`. `check` must return a winner at or before `capTicks` by score (kills, buildings, resources), ties broken by lower player id.

- [ ] **Step 1:** Failing tests, scripted with no AI: conquest ends when a player has no units or buildings; deathmatch setup grants at least 20000 of each resource; regicide ends when the king dies; wonder ends when a Wonder survives 2 minutes of countdown, and the countdown resets if the Wonder is destroyed; relics ends when one player holds all relics for 3 minutes, and the countdown resets if a carrier dies; at `capTicks` a winner is always returned; when both players are eliminated on the same tick, a winner is still returned.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement the rounds and the shared `scoreOf(game, p)`.
- [ ] **Step 4:** Run, expect PASS.

### Task 8: AI opponent

**Files:** Create `src/ai/bot.js`, `test/ai.test.js`

**Interfaces:**
- Produces: `createBot(game, playerId, difficulty:'easy'|'medium'|'hard') -> {think()}` called every 10 ticks; uses only `game.command` and `game.visibleEntities`.

- [ ] **Step 1:** Failing test: in a 3000-tick conquest match, a bot player has at least 15 villagers, at least 2 houses, reaches Tool Age, and has trained at least 5 military units; it never issues a rejected command more than 20 times in a row (no spam loop).
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement a state machine: economy, then age-up, then military, then attack waves; the difficulty scales the think delay and the wave size. Handle round-specific goals (build a Wonder, fetch relics, kill the king).
- [ ] **Step 4:** Run, expect PASS.

### Task 9: Tournament and headless bot runner

**Files:** Create `src/tournament/bracket.js`, `test/bot-sim.js`, `test/tournament.test.js`

**Interfaces:**
- Produces: `createTournament(seed) -> {rounds, current, advance(winner), isOver(), champion}`; `simulateMatch(roundId, seed, {p0:'medium', p1:'medium'}) -> {ended:boolean, winner, reason, ticks, errors:[]}`.

- [ ] **Step 1:** Failing tests: for each of the 5 rounds and each of 5 seeds, `simulateMatch` has `ended === true`, `errors` empty, no NaN in any player resource, `ticks <= capTicks + 50`; the bracket advances correctly and a loss ends the human's run.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement the bracket and the runner, with per-tick invariants checked (no NaN, pop <= 50, resources >= 0).
- [ ] **Step 4:** Run `node test/bot-sim.js` and record the per-round results table; fix any non-terminating or erroring round before continuing.

### Task 10: Renderer and UI

**Files:** Create `index.html`, `src/render/view.js`, `src/render/minimap.js`, `src/ui/hud.js`, `src/ui/input.js`, `src/main.js`, `styles.css`

- [ ] **Step 1:** Import map to the three module. Orthographic isometric camera with edge/WASD pan and wheel zoom.
- [ ] **Step 2:** Instanced tiles, primitive-built units and buildings coloured by owner, a fog mask, and a minimap canvas.
- [ ] **Step 3:** HUD: resource bar, age, pop, selection panel, command buttons (build, train, age up), and a bracket screen between rounds. Input: click and box select, right-click context orders.
- [ ] **Step 4:** Serve with `python3 -m http.server 8000`, open in Chrome, and confirm zero console errors on load.

### Task 11: Browser verification and honest report

- [ ] **Step 1:** For each of the 5 rounds, load with `?round=N&autoplay=1` (bots on both sides, sped up), wait for the end, and take screenshots at start, mid and end. Check the console for errors.
- [ ] **Step 2:** Look at every screenshot; fix rendering defects found.
- [ ] **Step 3:** Write the final report with four lists: verified by headless bots, verified by screenshots only, needs a human (feel, controls, balance, fun), and missing.

---

## Self-review notes
- Spec coverage: architecture, content subset, 5 rounds, AI difficulties, caps and tiebreak, headless and browser testing are each covered by a task. The Node tests cover the sim, AI and rounds. There is no test for renderer correctness beyond screenshots and console checks.
- Known thin spots: Task 10 gives steps but no code because it is visual and verified by screenshots. Exact balance numbers are decided during Task 1 and are unverified.
