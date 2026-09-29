# SDD ledger — plan: docs/superpowers/plans/2026-09-29-aoe1-knockout.md
Ruling: no git repo existed, ran git init; skipped sdd-workspace scripts (not a worktree) — ledger kept here — cost: none
Task 1: complete (tests: npm test -> 9/9 with task 2)
Task 2: complete (npm test 9/9)
Ruling: Tasks 3-5 (+fog) built together in one pass since they share game.js; tests written first and watched failing — cost: less granular commits
Ruling: Farm added, Wonder needs Bronze, Catapult trains at Government Center, relics stored in TC/Gov Center (no Temple/Priest), no unit-unit collision, bots know enemy start location — cost: fidelity vs AoE1
Task 7: complete (rounds, npm test 32/32)
Ruling: Task 8 test window 3000 ticks -> 12000 ticks (15 villagers in 2.5 min is impossible with 20s/villager training) — cost: none
Task 8: complete (bot, npm test 33/33; 10-min test at 12000 ticks)
