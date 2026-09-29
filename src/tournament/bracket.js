import { makeRng } from '../sim/rng.js';
import { ROUNDS } from '../rounds/index.js';
import { simulateMatch } from './sim.js';

export const NAMES = ['You', 'Ramses', 'Hammurabi', 'Sargon', 'Nebuchadnezzar', 'Darius', 'Xerxes', 'Cyrus', 'Leonidas', 'Pericles', 'Alexander', 'Ptolemy',
  'Hannibal', 'Scipio', 'Caesar', 'Augustus', 'Attila', 'Boudica', 'Shalmaneser', 'Tiglath', 'Ashurbanipal', 'Thutmose', 'Akhenaten', 'Minos',
  'Agamemnon', 'Themistocles', 'Philip', 'Seleucus', 'Antiochus', 'Mithridates', 'Vercingetorix', 'Arminius'];
// Difficulty of the opponent the human faces in each round.
export const HUMAN_OPPONENT = ['easy', 'easy', 'medium', 'medium', 'hard'];

export function createTournament(seed = 1) {
  const rng = makeRng(seed);
  const players = NAMES.map((name, id) => ({ id, name, difficulty: id === 0 ? 'human' : ['easy', 'medium', 'hard'][rng.int(3)] }));
  const t = {
    seed, roundIndex: 0, alive: [...players], history: [], over: false, champion: null,
    get round() { return ROUNDS[this.roundIndex]; },
    get human() { return this.alive[0]; },
    get opponent() { const o = this.alive[1]; return { ...o, difficulty: HUMAN_OPPONENT[this.roundIndex] }; },
    // Same as resolve() but simulates one off-screen match per macrotask so a UI stays responsive.
    async resolveAsync(humanWon, { onProgress, simulate = simulateMatch } = {}) {
      if (!humanWon) return this.resolve(false);
      const ri = this.roundIndex, round = ROUNDS[ri], cache = new Map(), total = (this.alive.length - 2) / 2; let done = 0;
      for (let i = 2; i < this.alive.length; i += 2) {
        await new Promise(r => setTimeout(r, 0));
        const s = this.seed * 1000 + ri * 50 + i; cache.set(s, simulate(round.id, s, [this.alive[i].difficulty, this.alive[i + 1].difficulty]));
        onProgress?.(++done, total);
      }
      return this.resolve(humanWon, (id, s) => cache.get(s));
    },
    // Record the outcome of the human's match, simulate every other match of the round, advance.
    resolve(humanWon, simulate = simulateMatch) {
      if (this.over) throw new Error('tournament is over');
      const ri = this.roundIndex, round = ROUNDS[ri], next = [], results = [];
      results.push({ a: this.alive[0].name, b: this.alive[1].name, winner: humanWon ? this.alive[0].name : this.alive[1].name, human: true });
      if (!humanWon) { this.history.push({ round: round.id, results }); this.over = true; this.lostIn = ri; return this; }
      next.push(this.alive[0]);
      for (let i = 2; i < this.alive.length; i += 2) {
        const a = this.alive[i], b = this.alive[i + 1];
        const m = simulate(round.id, seed * 1000 + ri * 50 + i, [a.difficulty, b.difficulty]);
        const w = m.winner === 1 ? b : a; next.push(w); results.push({ a: a.name, b: b.name, winner: w.name, reason: m.reason });
      }
      this.history.push({ round: round.id, results });
      this.alive = next; this.roundIndex++;
      if (this.alive.length === 1) { this.over = true; this.champion = this.alive[0]; }
      return this;
    },
  };
  return t;
}
