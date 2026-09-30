# Age of Knockout

A browser RTS in the spirit of Age of Empires I (1997), played as a 32-player knockout bracket of 1v1 matches
against AI. Five rounds, each a different game type: Standard (conquest), Death Match, Regicide, Wonder Race,
Capture the Relics. Lose once and you're out.

## Run

```
npm install
npm start                       # node serve.js, then open http://localhost:8000/
npm test                         # 49 unit/integration tests
node test/bot-sim.js 12          # bot-vs-bot termination check, 12 seeds x 5 rounds
```

URL parameters: `?round=1..5` (quick match), `&opp=easy|medium|hard`, `&seed=N`, `&speed=N`,
`&autoplay=1` (a bot plays your side, `&bot=` sets its difficulty), `?autotour=1` (whole tournament on autopilot).
`window.__app` exposes the live game for debugging.

## Controls (phone / touch)

Tap your unit or building to select it; with a selection, tap a target to order it (ground = move, enemy = attack, tree/mine/farm = gather, unfinished building = help build, relic = pick up). One finger drags the map, two fingers pinch-zoom and pan. Round buttons: next idle villager (badge = count), Town Center, box-select mode, deselect. Building placement: tap or drag to position the ghost, then press Place. The menu button (top right) has pause, speed, resign and quit. Both orientations are supported; use `?touch=1` to force the touch layout on a desktop browser. Not yet tested on a real iPhone.

## Controls (desktop)

Left click / drag select (double-click: all of a type) - right click move / gather / build / attack / fetch relic -
WASD or arrows pan, wheel zooms - `.` next idle villager, `H` Town Center, Space pause, Esc cancel -
click the minimap to jump. Select villagers to get the build menu, select a building to train / advance Age.

## Layout

`src/sim` deterministic simulation (no DOM, seeded RNG, 20 ticks/s) - `src/data` unit/building tables
(**unverified approximations**, see `src/data/README.md`) - `src/ai` bot - `src/rounds` game types and win checks -
`src/tournament` bracket and headless match runner - `src/render`, `src/ui`, `src/main.js` Three.js view, HUD, input.

## Status

See the final report in the session that built this; in short: rules, AI and bracket are bot-tested; the
renderer/UI was checked with screenshots and scripted events; feel, balance and fidelity to the original were
not judged by a human.
