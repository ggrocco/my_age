# AI Future Age + New Units Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fifth age, `future` (display name "AI Future"), with three new units (Combat Drone, Mech Walker, Railgun), fully playable by the player and the bot, with sim/bot/HUD tests passing.

**Architecture:** Data-driven. `AGES` gains `'future'`; three unit entries and `trains` lists are added; the sim already reads ages and units from data, so the only sim edits are replacing hardcoded `'catapult'` checks with `cls === 'siege'`. The bot's unit preference list is extended. HUD uses a display-name map. Rendering is untouched here (new units temporarily use the existing humanoid / catapult fallbacks in `models.js`); plans 2 and 3 replace them.

**Tech Stack:** Node `node:test` (ESM), plain JS sim in `src/sim`, Three.js renderer (not touched).

**Spec:** `docs/superpowers/specs/2026-09-29-per-age-3d-and-ai-future-design.md` (section 1, "Age system and new units"; Testing section).

## Global Constraints
- Age order is exactly: `stone`, `tool`, `bronze`, `iron`, `future`.
- Display name of the new age is `AI Future`.
- New units are `age: 'future'` and trained at existing buildings only: Combat Drone at Archery Range, Mech Walker at Barracks, Railgun at Government Center. No new buildings.
- Sim stays deterministic and DOM-free; stats and costs are unverified approximations (`src/data/README.md` convention).
- `npm test` (currently 49 passing) and `node test/bot-sim.js 12` must still pass at the end.
- Unit ids (exact): `drone`, `mech`, `railgun`. Classes: `drone` → `'archer'`, `mech` → `'inf'`, `railgun` → `'siege'`.

## Review Focus
- Iron Age player advancing to `future` with no iron-age buildings must be allowed (Task 1 test).
- Railgun must not be able to pick up relics, like the catapult (Task 2 test).
- Player already at max age (`future`) gets `max age` on another advance, not a crash (Task 2 test).
- Bot must not spam-train siege: at most 2 siege units alive, whichever type (Task 3 test).
- Bot at `future` age with only future-age units available still trains something and never sends an invalid `train` (Task 3 test).
- HUD label for the new age shows "AI Future", not "Future" (Task 4 test).

---

### Task 1: Data — age, units, trains

**Files:**
- Modify: `src/data/ages.js`
- Modify: `src/data/units.js`
- Modify: `src/data/buildings.js` (barracks, archery_range, government_center `trains`)
- Test: `test/data.test.js`

**Interfaces:**
- Produces: `AGES` including `'future'`; `AGE_COST.future`; `AGE_NAME` (`Record<age, string>`); `UNITS.drone|mech|railgun`; `BUILDINGS.barracks.trains` includes `'mech'`, `archery_range.trains` includes `'drone'`, `government_center.trains` includes `'railgun'`.

- [ ] **Step 1: Write the failing tests** — append to `test/data.test.js`:

```js
import { AGE_NAME } from '../src/data/ages.js';
test('AI Future age exists with cost and display name', () => {
  assert.deepEqual(AGES, ['stone', 'tool', 'bronze', 'iron', 'future']);
  assert.ok(AGE_COST.future && AGE_COST.future.time > 0);
  assert.equal(AGE_NAME.future, 'AI Future');
  for (const a of AGES) assert.ok(AGE_NAME[a], a);
});
test('future units: class, age and training building', () => {
  const want = { drone: ['archer', 'archery_range'], mech: ['inf', 'barracks'], railgun: ['siege', 'government_center'] };
  for (const [id, [cls, bld]] of Object.entries(want)) {
    assert.equal(UNITS[id].age, 'future', id); assert.equal(UNITS[id].cls, cls, id);
    assert.ok(BUILDINGS[bld].trains.includes(id), `${bld} trains ${id}`);
  }
  assert.ok(UNITS.railgun.splash > 0 && UNITS.railgun.range > UNITS.catapult.range);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/data.test.js`
Expected: FAIL (`AGE_NAME` is not exported / `AGES` mismatch).

- [ ] **Step 3: Implement.** In `src/data/ages.js` replace the file contents with:

```js
export const AGES = ['stone', 'tool', 'bronze', 'iron', 'future'];
export const AGE_NAME = { stone: 'Stone', tool: 'Tool', bronze: 'Bronze', iron: 'Iron', future: 'AI Future' };
// Cost to advance INTO the age; seconds of research.
export const AGE_COST = {
  tool: { cost: { food: 500, wood: 0, gold: 0, stone: 0 }, time: 30 },
  bronze: { cost: { food: 800, wood: 0, gold: 400, stone: 0 }, time: 40 },
  iron: { cost: { food: 1000, wood: 0, gold: 800, stone: 0 }, time: 50 },
  future: { cost: { food: 1200, wood: 0, gold: 1200, stone: 0 }, time: 60 },
};
export const ageIndex = a => AGES.indexOf(a);
```

In `src/data/units.js`, add before the `king` line:

```js
  drone:        { name: 'Combat Drone', hp: 45, atk: 6, armor: 1, range: 7, speed: 3.0, cost: c(60, 0, 80), trainTime: 28, age: 'future', sight: 9, cls: 'archer' },
  mech:         { name: 'Mech Walker', hp: 200, atk: 20, armor: 5, range: 0.9, speed: 1.5, cost: c(120, 0, 90), trainTime: 36, age: 'future', sight: 6, cls: 'inf' },
  railgun:      { name: 'Railgun', hp: 90, atk: 80, armor: 0, range: 11, speed: 1.0, cost: c(0, 120, 150), trainTime: 55, age: 'future', sight: 9, cls: 'siege', splash: 1.2 },
```

In `src/data/buildings.js` set: barracks `trains: [..., 'swordsman', 'mech']`; archery_range `trains: ['bowman', 'drone']`; government_center `trains: ['catapult', 'railgun']`.

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: all pass (49 existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/data test/data.test.js
git commit -m "feat: AI Future age data and Combat Drone, Mech Walker, Railgun units"
```

---

### Task 2: Sim — siege by class, age-up to future

**Files:**
- Modify: `src/sim/commands.js:100` (`relic` command)
- Test: `test/build.test.js` (append)

**Interfaces:**
- Consumes: Task 1 data.
- Produces: relic carriers exclude any `cls === 'siege'` unit.

- [ ] **Step 1: Write the failing tests** — append to `test/build.test.js`:

```js
test('iron age can advance to AI Future; then max age', () => {
  const g = createGame({ seed: 1 }); const p = g.players[0]; p.age = 'iron'; p.res = { food: 5000, wood: 5000, gold: 5000, stone: 5000 };
  const r = g.command(0, { type: 'age' }); assert.equal(r.ok, true, r.reason);
  for (let i = 0; i < 1300; i++) g.tick();
  assert.equal(p.age, 'future');
  assert.equal(g.command(0, { type: 'age' }).ok, false);
});
test('future units are age-gated and trainable at their buildings', () => {
  const g = createGame({ seed: 1 }); const p = g.players[0]; p.res = { food: 5000, wood: 5000, gold: 5000, stone: 5000 };
  const t = tc(g, 0), ar = g.addBuilding('archery_range', 0, t.x + 8, t.y, true), gc = g.addBuilding('government_center', 0, t.x, t.y + 8, true), bk = g.addBuilding('barracks', 0, t.x - 8, t.y, true);
  p.age = 'iron'; assert.equal(g.command(0, { type: 'train', buildingId: ar.id, unit: 'drone' }).ok, false, 'drone needs future');
  p.age = 'future';
  for (const [b, u] of [[ar, 'drone'], [bk, 'mech'], [gc, 'railgun']]) assert.equal(g.command(0, { type: 'train', buildingId: b.id, unit: u }).ok, true, u);
});
test('railgun cannot carry relics', () => {
  const g = createGame({ seed: 1 }); const r = g.spawnRelic(20.5, 20.5), u = g.spawnUnit('railgun', 0, 20.5, 20.5);
  assert.equal(g.command(0, { type: 'relic', ids: [u.id], relicId: r.id }).ok, false);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/build.test.js`
Expected: FAIL on "railgun cannot carry relics" (currently only `catapult` is excluded).

- [ ] **Step 3: Implement.** In `src/sim/commands.js` line 100, change `u.type !== 'catapult'` to `u.cls !== 'siege'`.

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/sim/commands.js test/build.test.js
git commit -m "feat: siege class cannot carry relics; test age-up to AI Future and unit gating"
```

---

### Task 3: Bot — use future units, cap siege by class

**Files:**
- Modify: `src/ai/bot.js:118,128-133,183,192`
- Test: `test/ai.test.js` (append)

**Interfaces:**
- Consumes: Task 1 unit ids and `cls` values.
- Produces: `bestUnit(trains)` prefers `mech`, `railgun`, `drone` at `future` age; siege count limited to 2 by `cls === 'siege'`.

- [ ] **Step 1: Write the failing test** — append to `test/ai.test.js`:

```js
test('bot at AI Future age trains future units and caps siege at 2', () => {
  const g = createGame({ seed: 4, rules: roundById('conquest') }); const b = createBot(g, 0, 'hard');
  const p = g.players[0]; p.age = 'future'; p.res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 };
  const t = [...g.buildings.values()].find(x => x.owner === 0 && x.type === 'town_center');
  g.addBuilding('barracks', 0, t.x - 8, t.y, true); g.addBuilding('archery_range', 0, t.x + 8, t.y, true); g.addBuilding('government_center', 0, t.x, t.y + 8, true);
  for (let i = 0; i < 6000; i++) { g.tick(); if (i % 15 === 0) { p.res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 }; p.popCap = 60; b.think(); } }
  const mine = [...g.units.values()].filter(u => u.owner === 0);
  assert.ok(mine.some(u => ['mech', 'drone', 'railgun'].includes(u.type)), 'trained a future unit');
  assert.ok(mine.filter(u => u.cls === 'siege').length <= 2, 'siege cap');
  assert.ok(b.maxRejects <= 20, 'rejects ' + b.maxRejects);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/ai.test.js`
Expected: FAIL (`bestUnit` never picks future units).

- [ ] **Step 3: Implement.** In `src/ai/bot.js`:

Replace line 118 with:
```js
        if (UNITS[u].cls === 'siege' && army.filter(a => a.cls === 'siege').length + done.reduce((n, x) => n + x.queue.filter(q => UNITS[q.unit].cls === 'siege').length, 0) >= 2) continue;
```
Replace `bestUnit` (lines 127-134) with:
```js
  const SIEGE = ['railgun', 'catapult'];
  function bestUnit(trains) {
    const pref = ['mech', 'railgun', 'swordsman', 'hoplite', 'catapult', 'drone', 'horse_archer', 'axeman', 'bowman', 'spearman', 'clubman', 'slinger'];
    const ok = pref.filter(u => trains.includes(u) && ageIndex(UNITS[u].age) <= ageIndex(me.age));
    if (!ok.length) return null;
    const siege = ok.find(u => SIEGE.includes(u));
    if (siege && game.time % 3 === 0) return siege;
    return ok.find(u => !SIEGE.includes(u)) || siege;
  }
```
Replace `a.type !== 'catapult'` (line 183) with `a.cls !== 'siege'`. Replace line 192 (`u.type !== 'catapult' || true`) with `const combat = army;`.

- [ ] **Step 4: Run to verify pass**

Run: `npm test && node test/bot-sim.js 12`
Expected: all tests pass; bot-sim prints `ALL MATCHES ENDED CLEANLY`.

- [ ] **Step 5: Commit**

```bash
git add src/ai/bot.js test/ai.test.js
git commit -m "feat: bot trains AI Future units; siege capped by class"
```

---

### Task 4: HUD — "AI Future" display name

**Files:**
- Modify: `src/ui/hud.js:3,26,64,65,69,70`
- Test: `test/data.test.js` already covers `AGE_NAME`; add a pure-function test for the label helper.

**Interfaces:**
- Consumes: `AGE_NAME` from Task 1.
- Produces: `ageLabel(age)` exported from `src/data/ages.js` returning `AGE_NAME[age]`.

- [ ] **Step 1: Write the failing test** — append to `test/data.test.js`:

```js
import { ageLabel } from '../src/data/ages.js';
test('ageLabel returns display names', () => { assert.equal(ageLabel('future'), 'AI Future'); assert.equal(ageLabel('iron'), 'Iron'); });
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/data.test.js`
Expected: FAIL (`ageLabel` not exported).

- [ ] **Step 3: Implement.** Append to `src/data/ages.js`: `export const ageLabel = a => AGE_NAME[a] || a;`

In `src/ui/hud.js`: import `ageLabel` alongside `AGES, AGE_COST, ageIndex`. Line 26: `const ageName = ageLabel(p.age);`. In the build/train button titles (lines 64, 65, 69) replace `d.age + ' age'` / `'Requires ' + d.age + ' age'` with `ageLabel(d.age) + ' age'` / `'Requires ' + ageLabel(d.age) + ' age'`. Line 70: replace `next[0].toUpperCase() + next.slice(1)` with `ageLabel(next)`. Desktop bar (line 30) already appends " Age" giving "AI Future Age".

- [ ] **Step 4: Run to verify pass, then check in browser**

Run: `npm test`
Expected: all pass. Then `python3 -m http.server 8000` and open `http://localhost:8000/?round=1&autoplay=0`; with a Town Center selected the Advance button in Iron age reads "Advance: AI Future".

- [ ] **Step 5: Commit**

```bash
git add src/data/ages.js src/ui/hud.js test/data.test.js
git commit -m "feat: HUD shows AI Future age name"
```

---

## Self-Review (done)
- Spec section 1 coverage: age + cost (Task 1), three units + training buildings (Task 1), bot support (Task 3), HUD lists (Task 4; unit lists are data-driven), determinism kept (no sim structure change), bot-sim termination (Task 3 step 4).
- Placeholders: none. Names consistent: `AGE_NAME`, `ageLabel`, `drone|mech|railgun`.
- Plans 2 (buildings/environment) and 3 (units/glTF) are separate documents, written after this plan ships.
