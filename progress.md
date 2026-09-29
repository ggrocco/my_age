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
