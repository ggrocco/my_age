# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

No build step, bundler or linter. Plain ES modules; three.js is resolved by the import map in `index.html` straight from `node_modules`.

```
npm install
npm start                                   # node serve.js, then open http://localhost:8000/
npm test                                    # node --test test/*.test.js
node --test test/econ.test.js               # single test file
node --test --test-name-pattern="<name>" test/*.test.js   # single test
node test/bot-sim.js 12                     # bot-vs-bot termination check (12 seeds x 5 rounds)
docker compose up -d --build                # nginx image, served on :8080
```

Useful URL params: `?round=1..5&opp=easy|medium|hard&seed=N&speed=N`, `&autoplay=1` (bot plays your side), `?autotour=1` (whole tournament on autopilot), `?touch=1` (force phone layout). `window.__app` exposes the live game.

## Architecture

A 32-player knockout bracket of 1v1 AoE1-style RTS matches vs AI; five rounds, each a different win condition.

- `src/sim` — the game itself: **deterministic, no DOM, seeded RNG, 20 ticks/s**. `createGame` (game.js) owns all state (entities/units/buildings/resources/relics Maps, occupancy grid); the player and the bot both act only through `commands.js` `execute`, and per-unit behaviour lives in `orders.js`. Keep it DOM-free and deterministic so the headless runner and tests work.
- `src/rounds/index.js` — per-round rules: `check(game)` returns null or `{winner, reason}`; every round has a tick cap plus a score tiebreak (`scoreOf`), so matches always terminate.
- `src/ai/bot.js` — the bot (easy/medium/hard); it is given the enemy start location. Also drives `?autoplay`.
- `src/tournament` — bracket and a headless match runner (`sim.js`), used by tests and `test/bot-sim.js`.
- `src/render`, `src/ui`, `src/main.js` — Three.js view (procedural, vertex-colour-baked models in `render/models.js`), HUD, desktop + touch input, tournament flow. Reads sim state; never mutates it except via commands.
- `src/data` — unit/building/age tables. Values are **unverified approximations** of AoE1 (see `src/data/README.md`); deviations from the original (Farm added, Wonder needs Bronze, Catapult at Government Center, no Temple/Priest) are recorded there and in `progress.md`.

Tests cover the sim, rounds, bot and bracket headlessly (Node test runner); the renderer/UI has no automated tests and was only checked via screenshots/emulation.

## Testing in the browser (required)

`npm test` is headless and never touches `src/render`, `src/ui`, `src/main.js`, `styles.css` or `index.html`. **Always verify your change in a real browser before calling it done** — not just when it is "UI work". A sim/data change that adds or alters something the player can see or click (a unit, building, age, HUD label, round rule) also needs a browser check that it appears and works. Run `npm test` too, but it is not a substitute.

How:

1. Start the server with `preview_start` (name `my-age`, defined in `.claude/launch.json`: `node serve.js 8000`). Don't run it via Bash.
2. Drive the page with the built-in browser tools (`mcp__Claude_Browser__*`), not the Chrome extension unless asked: `navigate` to `http://localhost:8000/?...`, `computer` screenshot, `read_console_messages` (must be free of errors), `javascript_tool` for state.
3. Screenshot the actual thing you changed, look at it, and check the console. If nothing on screen changed, suspect a stale module cache and hard-reload before debugging.
4. In your final message, say what you verified in the browser and what you could not.

Shortcuts (URL params are listed under Commands; `window.__app.match.game` is the live sim):

- Skip the menus: `?round=3&opp=easy&seed=1`. Fast-forward with `&speed=8`; `&autoplay=1` lets the bot play your side to reach later ages and bigger armies.
- Jump to state instead of playing there, from `javascript_tool`: `const p = __app.match.game.players[0]; p.age = 'future'; p.res = {food: 9999, wood: 9999, gold: 9999, stone: 9999};` then use the real UI (train, build, age-up button) and read the HUD.
- Phone layout: `?touch=1` plus `resize_window` to 402x874 and 874x402; touch input needs dispatched `TouchEvent`s. Reset the viewport with preset `desktop` afterwards.
- Whole flow: `?autotour=1` should reach a champion/eliminated screen with no console errors.

## Deployment

`Dockerfile` copies only `index.html`, `styles.css`, `src/` and the two three.js folders the import map references (`node_modules/three/build`, `.../examples/jsm`) into nginx. If `index.html`'s import map or static assets change, update the Dockerfile `COPY` lines.

## Project docs

Design specs and plans live in `docs/superpowers/{specs,plans}`; `progress.md` is the running ledger of rulings, known gaps and deferred minor issues — check it before assuming something is a bug.
