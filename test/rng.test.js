import test from 'node:test'; import assert from 'node:assert/strict';
import { makeRng } from '../src/sim/rng.js';
test('same seed same sequence', () => {
  const a = makeRng(7), b = makeRng(7);
  for (let i = 0; i < 5; i++) assert.equal(a.next(), b.next());
});
test('different seeds differ', () => {
  assert.notEqual(makeRng(1).next(), makeRng(2).next());
});
test('int in range', () => {
  const r = makeRng(3);
  for (let i = 0; i < 200; i++) { const v = r.int(5); assert.ok(v >= 0 && v < 5 && Number.isInteger(v)); }
});
