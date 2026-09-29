// UNVERIFIED approximations of AoE1 values. speed = tiles/sec, range = tiles, trainTime = sec.
const c = (food = 0, wood = 0, gold = 0, stone = 0) => ({ food, wood, gold, stone });
export const UNITS = {
  villager:     { name: 'Villager', hp: 25, atk: 3, armor: 0, range: 0.9, speed: 1.6, cost: c(50), trainTime: 20, age: 'stone', sight: 5, cls: 'civ' },
  clubman:      { name: 'Clubman', hp: 40, atk: 5, armor: 0, range: 0.9, speed: 1.7, cost: c(50), trainTime: 26, age: 'stone', sight: 5, cls: 'inf' },
  axeman:       { name: 'Axeman', hp: 50, atk: 7, armor: 0, range: 0.9, speed: 1.7, cost: c(50, 20), trainTime: 26, age: 'tool', sight: 5, cls: 'inf' },
  slinger:      { name: 'Slinger', hp: 25, atk: 3, armor: 0, range: 6, speed: 1.7, cost: c(40, 0, 0, 10), trainTime: 26, age: 'stone', sight: 7, cls: 'archer' },
  bowman:       { name: 'Bowman', hp: 35, atk: 4, armor: 0, range: 7, speed: 1.7, cost: c(40, 20), trainTime: 30, age: 'tool', sight: 8, cls: 'archer' },
  spearman:     { name: 'Spearman', hp: 60, atk: 6, armor: 1, range: 0.9, speed: 1.7, cost: c(50, 30), trainTime: 26, age: 'tool', sight: 5, cls: 'inf' },
  hoplite:      { name: 'Hoplite', hp: 75, atk: 9, armor: 3, range: 0.9, speed: 1.6, cost: c(60, 0, 40), trainTime: 30, age: 'bronze', sight: 5, cls: 'inf' },
  swordsman:    { name: 'Swordsman', hp: 100, atk: 12, armor: 3, range: 0.9, speed: 1.6, cost: c(60, 0, 40), trainTime: 30, age: 'iron', sight: 5, cls: 'inf' },
  scout:        { name: 'Scout', hp: 60, atk: 3, armor: 0, range: 0.9, speed: 3.2, cost: c(100), trainTime: 30, age: 'tool', sight: 10, cls: 'cav' },
  horse_archer: { name: 'Horse Archer', hp: 50, atk: 5, armor: 0, range: 6, speed: 2.8, cost: c(50, 0, 70), trainTime: 34, age: 'bronze', sight: 8, cls: 'cav' },
  catapult:     { name: 'Catapult', hp: 75, atk: 50, armor: 0, range: 9, speed: 0.9, cost: c(0, 150, 75), trainTime: 60, age: 'iron', sight: 8, cls: 'siege', splash: 1.5 },
  drone:        { name: 'Combat Drone', hp: 45, atk: 6, armor: 1, range: 7, speed: 3.0, cost: c(60, 0, 80), trainTime: 28, age: 'future', sight: 9, cls: 'archer' },
  mech:         { name: 'Mech Walker', hp: 200, atk: 20, armor: 5, range: 0.9, speed: 1.5, cost: c(120, 0, 90), trainTime: 36, age: 'future', sight: 6, cls: 'inf' },
  railgun:      { name: 'Railgun', hp: 90, atk: 80, armor: 0, range: 11, speed: 1.0, cost: c(0, 120, 150), trainTime: 55, age: 'future', sight: 9, cls: 'siege', splash: 1.2 },
  king:         { name: 'King', hp: 120, atk: 5, armor: 2, range: 0.9, speed: 1.4, cost: c(), trainTime: 1, age: 'stone', sight: 6, cls: 'civ', trainable: false },
};
