import assert from 'node:assert/strict';
import { analyzePpg, makeSyntheticPpg } from '../signal.js';

const cases = [60, 76, 90, 110];
for (const expectedBpm of cases) {
  const samples = makeSyntheticPpg(32, expectedBpm, 30);
  const result = analyzePpg(samples);
  assert.notEqual(result.bpm, null, `No pulse estimate for ${expectedBpm} BPM signal`);
  assert.ok(Math.abs(result.bpm - expectedBpm) <= 4, `Expected near ${expectedBpm}, got ${result.bpm}`);
  assert.ok(result.sampleCount >= 900, 'Synthetic sample count unexpectedly low');
  assert.equal(result.quality, 'good', 'Clean synthetic signal should pass software quality checks');
  console.log(`PASS: expected ${expectedBpm} BPM; detected ${result.bpm.toFixed(1)} BPM; quality=${result.qualityScore}/100`);
}

// Check a jittered timestamp stream and repeated region means. Identical RGB
// averages are deliberately retained; they are not proof of duplicate frames.
const irregular = makeSyntheticPpg(32, 76, 30).map((sample, index, all) => {
  const copy = { ...sample, t: sample.t + 2.5 * Math.sin(index * 1.7) };
  if (index % 3 === 0 && index > 0) {
    copy.r = all[index - 1].r;
    copy.g = all[index - 1].g;
    copy.b = all[index - 1].b;
  }
  return copy;
});
const irregularResult = analyzePpg(irregular);
assert.notEqual(irregularResult.bpm, null, 'Irregular timestamp signal should still produce a rate estimate');
assert.ok(Math.abs(irregularResult.bpm - 76) <= 5, `Expected near 76 BPM, got ${irregularResult.bpm}`);
assert.equal(irregularResult.sampleCount, irregular.length, 'Identical RGB averages must not cause samples to be dropped');
console.log(`PASS: jittered synthetic stream; detected ${irregularResult.bpm.toFixed(1)} BPM; retained ${irregularResult.sampleCount} samples`);

console.log('\nThese are synthetic software tests only, not camera-device or clinical validation.');
