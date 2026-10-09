# Age of Knockout

A browser RTS in the spirit of Age of Empires I (1997), played as a 32-player knockout bracket of 1v1 matches
against AI. Five rounds, each a different game type: Standard (conquest), Death Match, Regicide, Wonder Race,
Capture the Relics. Lose once and you're out.

## Run

```
npm install
npm start                       # node serve.js, then open http://localhost:8000/
npm test                         # unit/integration tests (sim, rounds, bot, bracket)
node test/bot-sim.js 12          # bot-vs-bot termination check, 12 seeds x 5 rounds
```

## Deploy (Docker)

```
docker compose up -d --build     # nginx image on http://localhost:8080/ (AOE_PORT=9000 to change)
```

The image is static files only (`index.html`, `styles.css`, `src/`, the two three.js folders the import map
uses) behind nginx, with a healthcheck. Plain `docker build -t aoe-knockout .` builds the same image.

## CI (Jenkins)

`Jenkinsfile` runs the unit tests (JUnit report), `test/bot-sim.js 12`, then builds the nginx image and
smoke-tests it (page, CSS, JS and both three.js import-map paths served with the right content type). Everything
runs in Docker, so the agent needs only the docker CLI with a reachable daemon (e.g. Jenkins in a container with
`/var/run/docker.sock` mounted and the docker CLI installed) and the JUnit plugin. Nothing is pushed or deployed.
Same tests without Jenkins:

```
docker build --target test -t aoe-knockout-test . && docker run --rm aoe-knockout-test
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
