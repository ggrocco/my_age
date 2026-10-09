// Explicit preferences, not device-model guesses: browsers do not reliably expose the GPU.
export const QUALITY = Object.freeze({
  balanced: Object.freeze({ label: 'Balanced', pixelRatio: 1.5, maxPixels: 2000000, shadows: 1024, grass: 2500, ao: 0, samples: 8 }),
  high: Object.freeze({ label: 'High', pixelRatio: 2, maxPixels: 4000000, shadows: 2048, grass: 8000, ao: 0.5, samples: 12 }),
  ultra: Object.freeze({ label: 'Ultra', pixelRatio: 2.5, maxPixels: 8000000, shadows: 4096, grass: 14000, ao: 0.75, samples: 24 }),
});
const KEY = 'age-of-knockout.graphics';
export const validQuality = value => Object.hasOwn(QUALITY, value);
export function readQuality(search = '', storage) {
  const requested = new URLSearchParams(search).get('quality');
  if (validQuality(requested)) return requested;
  try { const saved = storage?.getItem(KEY); if (validQuality(saved)) return saved; } catch { /* Private browsing may deny storage. */ }
  return 'high';
}
export function saveQuality(value, storage) {
  if (!validQuality(value)) return false;
  try { if (!storage) return false; storage.setItem(KEY, value); return true; }
  catch { return false; /* The setting still applies to this session. */ }
}
export function renderPixelRatio(width, height, deviceRatio, preset) {
  return Math.min(Math.max(1, deviceRatio || 1), preset.pixelRatio,
    Math.sqrt(preset.maxPixels / (Math.max(1, width) * Math.max(1, height))));
}
