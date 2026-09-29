// UNVERIFIED approximations of AoE1 values. buildTime in sec (single builder).
const c = (food = 0, wood = 0, gold = 0, stone = 0) => ({ food, wood, gold, stone });
export const BUILDINGS = {
  town_center:       { name: 'Town Center', hp: 600, cost: c(0, 200, 0, 100), size: 3, buildTime: 60, age: 'stone', trains: ['villager'], drops: ['food', 'wood', 'gold', 'stone'], pop: 10, sight: 8 },
  house:             { name: 'House', hp: 75, cost: c(0, 30), size: 2, buildTime: 15, age: 'stone', pop: 4, sight: 3 },
  granary:           { name: 'Granary', hp: 200, cost: c(0, 120), size: 2, buildTime: 25, age: 'stone', drops: ['food'], sight: 4 },
  storage_pit:       { name: 'Storage Pit', hp: 200, cost: c(0, 120), size: 2, buildTime: 25, age: 'stone', drops: ['wood', 'gold', 'stone'], sight: 4 },
  farm:              { name: 'Farm', hp: 50, cost: c(0, 60), size: 2, buildTime: 15, age: 'stone', gatherType: 'food', amount: 400, sight: 2, extra: true },
  barracks:          { name: 'Barracks', hp: 350, cost: c(0, 125), size: 3, buildTime: 30, age: 'stone', trains: ['clubman', 'slinger', 'axeman', 'spearman', 'hoplite', 'swordsman'], sight: 4 },
  archery_range:     { name: 'Archery Range', hp: 350, cost: c(0, 150), size: 3, buildTime: 40, age: 'tool', trains: ['bowman'], sight: 4 },
  stable:            { name: 'Stable', hp: 350, cost: c(0, 150), size: 3, buildTime: 40, age: 'tool', trains: ['scout', 'horse_archer'], sight: 4 },
  market:            { name: 'Market', hp: 350, cost: c(0, 150), size: 3, buildTime: 40, age: 'tool', sight: 4 },
  government_center: { name: 'Government Center', hp: 500, cost: c(0, 175, 0, 100), size: 3, buildTime: 60, age: 'bronze', trains: ['catapult'], drops: ['food', 'wood', 'gold', 'stone'], sight: 5 },
  wonder:            { name: 'Wonder', hp: 1500, cost: c(0, 1000, 1000, 1000), size: 4, buildTime: 200, age: 'bronze', sight: 6 },
};
