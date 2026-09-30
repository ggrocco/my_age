# SDD ledger — plan: docs/superpowers/plans/2026-09-29-aoe1-knockout.md
Ruling: no git repo existed, ran git init; skipped sdd-workspace scripts (not a worktree) — ledger kept here — cost: none
Task 1: complete (tests: npm test -> 9/9 with task 2)
Task 2: complete (npm test 9/9)
Ruling: Tasks 3-5 (+fog) built together in one pass since they share game.js; tests written first and watched failing — cost: less granular commits
Ruling: Farm added, Wonder needs Bronze, Catapult trains at Government Center, relics stored in TC/Gov Center (no Temple/Priest), no unit-unit collision, bots know enemy start location — cost: fidelity vs AoE1
Task 7: complete (rounds, npm test 32/32)
Ruling: Task 8 test window 3000 ticks -> 12000 ticks (15 villagers in 2.5 min is impossible with 20s/villager training) — cost: none
Task 8: complete (bot, npm test 33/33; 10-min test at 12000 ticks)
Task 9 (runner): bot-vs-bot 60/60 clean at 12 seeds; found+fixed: villager-train at non-TC after TC loss; difficulty inversion (hard lost to easy 4/20) -> retuned, now medium>easy 18/20, hard>medium 13/20
Task 9: complete (bracket, npm test 43/43). Advisor fixes: construct cmd, relic AI (relics win 10/20), wonder reserve+rush age, passive king, matches.test.js. Hard>=easy now in all rounds except easy/hard side bias.
Known honest gaps: Wonder Race = build race in bot play (nobody destroys wonder); deathmatch hits time cap ~10-20%
Task 10: complete (renderer/UI; found+fixed camera never updating, minimap getImageData, defeat heading color, favicon, farm HP bar height [not re-screenshotted])
Task 11: browser pass done: 5 rounds x start/mid/result screenshots read; full tournament chain (autotour seed 6: champion, seeds 1-4: eliminated) no page errors; UI events via synthetic dispatch on visible devtools page
Ruling: bot-vs-bot difficulty ordering is weak/noisy (hard bot wins ~2 of 5 rounds vs tournament opponents; deathmatch easy>=medium) — reported not fixed
Ruling: autoplay/test bot defaults to hard via ?bot= ; tournament seed 6 chosen because hard bot wins all 5 (found by headless search)
Final review: fresh reviewer (fable) — 3 Important, 7 Minor
Final: fixed #1 units trapped in new footprint — review#1 RED->GREEN, suite 49/49
Final: fixed #2 relics dropped on blocked tile / built over — review#2, review#2b RED->GREEN
Final: fixed #3 stall with only houses left + no resign — review#3, review#3b RED->GREEN; Resign button verified in browser
Final: minor (deferred): info panel shows live HP of enemy after it leaves vision (hud.js ui.inspect)
Final: minor (deferred): carried relics count as held (round text says 'in your Town Center')
Final: minor (deferred): window resize listener leaks per match (main.js)
Final: minor (deferred): '.'/'h' hotkeys throw uncaught TypeError on menu screen (input.js onKey, ui.game null)
Final: minor (deferred): clicking a relic shows HP NaN
Final: minor (deferred): queued units not refunded when producer dies
Final: minor (deferred): ?round= out of range throws
Note: after fixes, Relics ends by relics in only 1/12 bot games (was 5/12): conquest now fires sooner
Model upgrade (bounded, approved): new src/render/models.js (procedural baked vertex-colored models: 12 unit types w/ articulated limbs+horse+catapult, 11 building types w/ scaffolding, varied trees/rocks/bushes, relic shrine), shadows, hit-pop, facing; view.js integrates; fixed HP bar tilt. npm test 49/49; autotour seed 6 champion, 0 errors, peak 603 draw calls
Not verified: animations only seen as still frames (no video), no real-GPU fps measurement
Phone/touch UI (bounded, approved): touch gestures in input.js (tap select/order, drag pan, pinch, box-select toggle, place ghost+confirm), phone layout both orientations (safe-area, overlays, 48px targets), game menu, camera framing by width in portrait, compact menus, bracket buttons above list. Verified in Chrome iPhone-17-Pro emulation (402x874, 874x402 @3x) with dispatched TouchEvents; desktop regression re-run OK; npm test 49/49; phone autotour champion 0 errors. NOT verified: real iPhone/Safari (WebGL, safe-area, real touch feel), multi-touch on hardware.
Resolved deferred minors: resize listener leak, hotkeys on menu (guard added)
Command tiles (bounded, approved): liquid-glass tiles with hand-drawn SVG icons (src/ui/icons.js) + hover description cards (src/ui/tips.js, DESC text; stats/cost derived from data tables; test/ui-tiles.test.js). Disabled tiles use .off + aria-disabled (not [disabled]) so they still get hover; click handler ignores .off. #bottom 152->168px so 3 rows of build tiles fit (toast 170->186). Tooltips are desktop-only (hidden under body.touch, no hover on phones). Market text says trading is not in the game yet (it only counts toward Age-up).
Not verified: real iPhone touch (emulated only); backdrop-filter fallback in browsers without it (plain translucent fill expected); full 5-round autotour not run to the end (sampled ~16.5k ticks of round 1, no errors)
