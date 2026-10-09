# Age of Knockout

A browser RTS in the spirit of Age of Empires I (1997), played as a 32-player knockout bracket of 1v1 matches
against AI. Five rounds, each a different game type: Standard (conquest), Death Match, Regicide, Wonder Race,
Capture the Relics. Lose once and you're out.

## Run

```
npm install
npm start                       # node serve.js, then open http://localhost:8000/
npm test                         # simulation, UI-data, and render-model tests
node test/bot-sim.js 12          # bot-vs-bot termination check, 12 seeds x 5 rounds
```

URL parameters: `?round=1..5` (quick match), `&opp=easy|medium|hard`, `&seed=N`, `&speed=N`,
`&autoplay=1` (a bot plays your side, `&bot=` sets its difficulty), `?autotour=1` (whole tournament on autopilot).
`window.__app` exposes the live game for debugging.

## Rendering

The Three.js view uses warm directional lighting, filtered shadows, sky reflections, textured
wood/stone/metal, wind-blown grass, and reflective water with animated normals and shoreline foam.
High and Ultra add ambient occlusion for depth around buildings, foliage and units.
Buildings use timber and detailed thatch in the Stone/Tool
ages, with tiled roofs and masonry details from Bronze onward. Trees have irregular crowns and roots;
units have articulated equipment, including separate drone, mech, and railgun models for AI Future.
These are original procedural interpretations of an ancient RTS setting, not original Age of Empires assets.

Choose **Settings → Graphics quality** on desktop, or open the top-right menu on a phone.
Changes apply without restarting the match and are saved in this browser. The default is **High**;
try High on an iPhone 17 Pro and Ultra on an M2 Max, then adjust for frame rate and battery use.
These are starting recommendations, not measured performance guarantees on those devices.
Use `&quality=balanced|high|ultra` to override the saved preference when opening a match.

| Preset | Maximum pixel ratio / rendered pixels | Shadow map | Ambient occlusion | Grass clumps |
| --- | --- | --- | --- | --- |
| Balanced | 1.5 / 2 million | 1024 | Off | 2,500 |
| High | 2 / 4 million | 2048 | Half resolution, 12 samples | 8,000 |
| Ultra | 2.5 / 8 million | 4096 | Three-quarter resolution, 24 samples | 14,000 |

No extra assets, network downloads, or build step are needed. Geometry is shared between models and
grass is instanced. Decorative grass respects fog and building/resource footprints. Float render-target
support is checked before enabling sky reflections and ambient occlusion; direct rendering remains available.
`test/render-models.test.js` checks every unit and building age for valid geometry and animation transforms.
`test/graphics-quality.test.js` covers preference handling, pixel budgets and the rendering fallback.
Browser checks are still necessary for shaders, picking, lighting, and visual quality. Try
`?round=1&seed=1` for the starting village and `?round=3&seed=1&touch=1` for the phone layout.

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
