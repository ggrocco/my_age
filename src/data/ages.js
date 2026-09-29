export const AGES = ['stone', 'tool', 'bronze', 'iron'];
// Cost to advance INTO the age; seconds of research.
export const AGE_COST = {
  tool: { cost: { food: 500, wood: 0, gold: 0, stone: 0 }, time: 30 },
  bronze: { cost: { food: 800, wood: 0, gold: 400, stone: 0 }, time: 40 },
  iron: { cost: { food: 1000, wood: 0, gold: 800, stone: 0 }, time: 50 },
};
export const ageIndex = a => AGES.indexOf(a);
