import test from 'node:test';
import assert from 'node:assert/strict';
import { QUALITY, readQuality, saveQuality, renderPixelRatio } from '../src/render/quality.js';
import { createLightingEffects } from '../src/render/lighting.js';

test('graphics defaults to High and accepts only supported URL presets', () => {
  assert.equal(readQuality(), 'high');
  for (const name of Object.keys(QUALITY)) assert.equal(readQuality(`?quality=${name}`), name);
  for (const name of ['constructor', '__proto__', 'invalid', '']) assert.equal(readQuality(`?quality=${name}`), 'high');
});

test('graphics preference persists, with an explicit URL taking precedence', () => {
  const data = new Map(), storage = { getItem: k => data.get(k), setItem: (k, v) => data.set(k, v) };
  assert.equal(saveQuality('balanced', storage), true);
  assert.equal(readQuality('', storage), 'balanced');
  assert.equal(readQuality('?quality=ultra', storage), 'ultra');
  assert.equal(saveQuality('invalid', storage), false);
  assert.equal(readQuality('', storage), 'balanced');
});

test('unavailable browser storage does not prevent choosing graphics settings', () => {
  const storage = { getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Quota'); } };
  assert.equal(readQuality('', storage), 'high');
  assert.equal(readQuality('?quality=ultra', storage), 'ultra');
  assert.equal(saveQuality('ultra', storage), false);
});

test('render resolution respects pixel budgets on retina desktops and phones', () => {
  for (const preset of Object.values(QUALITY)) for (const [w, h, dpr] of [[402, 874, 3], [874, 402, 3], [2560, 1440, 2], [7680, 4320, 2]]) {
    const ratio = renderPixelRatio(w, h, dpr, preset);
    assert.ok(ratio > 0 && ratio <= dpr && ratio <= preset.pixelRatio);
    assert.ok(w * h * ratio * ratio <= preset.maxPixels + 1);
  }
  assert.equal(renderPixelRatio(402, 874, 3, QUALITY.high), 2);
  assert.equal(renderPixelRatio(402, 874, 3, QUALITY.ultra), 2.5);
  assert.ok(Number.isFinite(renderPixelRatio(0, 0, 1, QUALITY.high)));
});

test('Balanced and browsers without float render targets use the direct-render fallback', () => {
  const scene = {}, camera = {}; let renders = 0;
  const renderer = { extensions: { has: () => false }, render(s, c) { assert.equal(s, scene); assert.equal(c, camera); renders++; } };
  for (const preset of [QUALITY.balanced, QUALITY.high, QUALITY.ultra]) {
    const effects = createLightingEffects(renderer, scene, camera, preset);
    assert.equal(effects.enabled, false);
    effects.resize(402, 874); effects.render(); effects.dispose();
  }
  assert.equal(renders, 3);
});
